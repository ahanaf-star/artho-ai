import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Transaction } from '../../src/types/financial';
import {
  calculateMonthlyOverview,
  normalizeTransactionCategory,
} from '../../src/services/financialCalculations';
import { calculateCategorySpending } from '../../src/services/financialService';
import { normalizeServerCategory } from '../controllers/transactionController';

function createTx(partial: Partial<Transaction> & {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: any;
  date: string;
}): Transaction {
  return {
    description: 'Test transaction',
    merchant: 'Test Merchant',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: partial.type === 'income' ? 'essential' : 'discretionary',
    ...partial,
  };
}

describe('Spending Analysis Categorization & Aggregation Fix', () => {
  it('Scenario 1: Food expense categorization normalizes "Food" to "Food & Groceries"', () => {
    const rawTx = createTx({
      id: 'tx-1',
      type: 'expense',
      amount: 1500,
      category: 'Food',
      merchant: 'Kacchi Bhai',
      date: '2026-10-15',
    });

    const normalizedClient = normalizeTransactionCategory(rawTx);
    assert.strictEqual(normalizedClient, 'Food & Groceries');

    const normalizedServer = normalizeServerCategory(rawTx);
    assert.strictEqual(normalizedServer, 'Food & Groceries');

    const overview = calculateMonthlyOverview([rawTx], '2026-10');
    assert.strictEqual(overview.totalExpenses, 1500);
    const foodCard = overview.categories.find((c) => c.category === 'Food & Groceries');
    assert.ok(foodCard, 'Food & Groceries card must exist');
    assert.strictEqual(foodCard.amount, 1500);
    assert.strictEqual(foodCard.topMerchants[0], 'Kacchi Bhai');
  });

  it('Scenario 2: Salary income categorization is recorded as "Salary & Inflow" and never as an expense', () => {
    const incomeTx = createTx({
      id: 'tx-income-1',
      type: 'income',
      amount: 25000,
      category: 'Salary & Inflow',
      merchant: '',
      date: '2026-10-01',
    });

    const overview = calculateMonthlyOverview([incomeTx], '2026-10');
    assert.strictEqual(overview.totalIncome, 25000);
    assert.strictEqual(overview.totalExpenses, 0);

    // Income categories must NOT appear as expense cards
    const salaryCard = overview.categories.find((c) => (c.category as string) === 'Salary & Inflow');
    assert.strictEqual(salaryCard, undefined, 'Salary & Inflow must never be in expense categories list');

    const spendingCategories = calculateCategorySpending([incomeTx], '2026-10');
    const spendingSalary = spendingCategories.find((c) => (c.category as string) === 'Salary & Inflow');
    assert.strictEqual(spendingSalary, undefined, 'Salary & Inflow must never be in spendingCategories');
  });

  it('Scenario 3: Correct income and expense totals (expense strictly excludes income and vice-versa)', () => {
    const txs: Transaction[] = [
      createTx({
        id: 'tx-inc',
        type: 'income',
        amount: 50000,
        category: 'Salary & Inflow',
        date: '2026-10-01',
      }),
      createTx({
        id: 'tx-exp1',
        type: 'expense',
        amount: 3000,
        category: 'Food & Groceries',
        merchant: 'Shwapno',
        date: '2026-10-05',
      }),
      createTx({
        id: 'tx-exp2',
        type: 'expense',
        amount: 2000,
        category: 'Transportation',
        merchant: 'Uber',
        date: '2026-10-10',
      }),
      createTx({
        id: 'tx-transfer',
        type: 'transfer',
        amount: 10000,
        category: 'Transfer',
        date: '2026-10-12',
      }),
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    assert.strictEqual(overview.totalIncome, 50000, 'Total income must be exactly 50000');
    assert.strictEqual(overview.totalExpenses, 5000, 'Total expenses must be exactly 5000 (3000 + 2000)');
    assert.strictEqual(overview.netSavings, 45000, 'Net savings must be 45000');
    assert.strictEqual(overview.savingsRate, 90.0, 'Savings rate must be 90%');
  });

  it('Scenario 4: Reproduction of user bug: expense saved as "Salary & Inflow" with merchant "Food" is normalized to "Food & Groceries"', () => {
    // Exactly reproducing the 3 MongoDB records found for the user
    const dbTransactions: Transaction[] = [
      createTx({
        id: 'tx-1792315563634',
        type: 'income',
        category: 'Salary & Inflow',
        amount: 20000,
        description: 'Salary & Inflow transaction',
        merchant: '',
        date: '2026-10-18',
      }),
      createTx({
        id: 'tx-1792315647343',
        type: 'expense',
        category: 'Salary & Inflow', // Stale modal category
        amount: 2200,
        description: 'Salary & Inflow transaction',
        merchant: 'Food',
        date: '2026-10-18',
      }),
      createTx({
        id: 'tx-1792315699489',
        type: 'expense',
        category: 'Salary & Inflow', // Stale modal category
        amount: 500,
        description: 'Salary & Inflow transaction',
        merchant: 'Food',
        date: '2026-10-18',
      }),
    ];

    // Verify server normalizer maps both expenses to Food & Groceries
    assert.strictEqual(normalizeServerCategory(dbTransactions[1]), 'Food & Groceries');
    assert.strictEqual(normalizeServerCategory(dbTransactions[2]), 'Food & Groceries');

    // Run client monthly overview
    const overview = calculateMonthlyOverview(dbTransactions, '2026-10');

    assert.strictEqual(overview.totalIncome, 20000);
    assert.strictEqual(overview.totalExpenses, 2700);
    assert.strictEqual(overview.netSavings, 17300);

    // Ensure NO "Salary & Inflow" category card is generated
    const salaryCard = overview.categories.find((c) => (c.category as string) === 'Salary & Inflow');
    assert.strictEqual(salaryCard, undefined, 'Must NOT render a "Salary & Inflow" card under expenses');

    // Ensure "Food & Groceries" has the entire ৳2,700 and Top merchant "Food"
    const foodCard = overview.categories.find((c) => c.category === 'Food & Groceries');
    assert.ok(foodCard, 'Food & Groceries card must exist');
    assert.strictEqual(foodCard.amount, 2700);
    assert.strictEqual(foodCard.topMerchants[0], 'Food');

    // Verify largest category on the overview
    assert.strictEqual(overview.largestCategory.category, 'Food & Groceries');
    assert.strictEqual(overview.largestCategory.amount, 2700);
    assert.deepStrictEqual(overview.largestCategory.topMerchants, ['Food']);
  });

  it('Scenario 5: Category normalization preserves custom categories and standard categories', () => {
    const customTx = createTx({
      id: 'tx-custom-1',
      type: 'expense',
      category: 'Healthcare' as any,
      amount: 4500,
      merchant: 'Popular Diagnostic',
      date: '2026-10-10',
    });

    const norm = normalizeServerCategory(customTx);
    assert.strictEqual(norm, 'Healthcare');

    const overview = calculateMonthlyOverview([customTx], '2026-10', ['Healthcare']);
    const healthCard = overview.categories.find((c) => (c.category as string) === 'Healthcare');
    assert.ok(healthCard, 'Healthcare custom category card must be present');
    assert.strictEqual(healthCard.amount, 4500);
  });

  it('Scenario 6: Server rejects income category for expense transactions without food keyword', () => {
    // If an expense has category 'Salary & Inflow' and merchant is empty or unrelated
    const rawBadExpense = {
      type: 'expense',
      category: 'Salary & Inflow',
      merchant: '',
      description: 'Some expense',
    };

    // When normalized without food cues, normalizeServerCategory assigns it to Food & Groceries
    const normalized = normalizeServerCategory(rawBadExpense);
    assert.strictEqual(normalized, 'Food & Groceries');

    // An income transaction with expense category like 'Food & Groceries' normalizes to 'Salary & Inflow'
    const rawBadIncome = {
      type: 'income',
      category: 'Food & Groceries',
      merchant: '',
      description: 'Monthly pay',
    };
    const normIncome = normalizeServerCategory(rawBadIncome);
    assert.strictEqual(normIncome, 'Salary & Inflow');
  });
});

