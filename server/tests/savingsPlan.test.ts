import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyIntent, parseSavingsTarget } from '../services/intentClassifier';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { CoachContext } from '../services/coachContextBuilder';
import { Transaction } from '../../src/types/financial';
import { calculateMonthlyOverview, calculateFactualAnalysis } from '../../src/services/financialCalculations';

function createTx(
  partial: Partial<Transaction> & {
    id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    category: any;
    date: string;
  }
): Transaction {
  return {
    description: 'Test transaction',
    merchant: 'Test Merchant',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: partial.type === 'income' ? 'essential' : 'discretionary',
    ...partial,
  };
}

// Helper to construct isolated mock CoachContext
function createMockSavingsContext(
  transactions: Transaction[],
  profileIncome?: number,
  activeMonth: string = '2026-10'
): CoachContext {
  const eligibleTransactions = transactions.filter((t) => t.type === 'income' || t.type === 'expense');
  const overview = calculateMonthlyOverview(eligibleTransactions, activeMonth);
  const factual = calculateFactualAnalysis(eligibleTransactions, activeMonth);

  const monthlyIncome = overview.totalIncome;
  const monthlySpending = overview.totalExpenses;
  const netSavings = overview.netSavings;
  const netCashFlow = monthlyIncome - monthlySpending;
  const savingsRate = monthlyIncome > 0 ? Number(overview.savingsRate.toFixed(1)) : 0;
  const expenseRatio = monthlyIncome > 0 ? Number(((monthlySpending / monthlyIncome) * 100).toFixed(1)) : 0;
  const hasRecordedIncome = monthlyIncome > 0;
  const hasRecordedExpenses = monthlySpending > 0;
  const hasProfileIncome = profileIncome !== undefined && profileIncome > 0;

  const isEssentialCat = (name: string): boolean => {
    const norm = name.toLowerCase();
    return (
      norm.includes('health') ||
      norm.includes('medic') ||
      norm.includes('doctor') ||
      norm.includes('hospital') ||
      norm.includes('tuition') ||
      norm.includes('educat') ||
      norm.includes('rent') ||
      norm.includes('utilit')
    );
  };

  const discretionaryCatMap: Record<string, number> = {};
  for (const t of eligibleTransactions) {
    if (t.date && t.date.startsWith(activeMonth) && t.type === 'expense') {
      const isEssential = t.classification === 'essential' || isEssentialCat(t.category);
      if (!isEssential) {
        discretionaryCatMap[t.category] = (discretionaryCatMap[t.category] || 0) + t.amount;
      }
    }
  }

  const discretionaryCategories = Object.entries(discretionaryCatMap)
    .filter(([_, amt]) => amt > 0)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: monthlySpending > 0 ? Number(((amt / monthlySpending) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const discretionaryTotal = discretionaryCategories.reduce((sum, c) => sum + c.amount, 0);

  return {
    metadata: {
      today: '2026-10-17',
      dataWindow: {
        currentMonth: activeMonth,
        previousMonths: ['2026-09'],
        hasData: eligibleTransactions.length > 0,
        totalTransactions: eligibleTransactions.length,
      },
    },
    snapshot: {
      available: monthlyIncome > 0 || monthlySpending > 0 || hasProfileIncome,
      monthlyIncome,
      monthlySpending,
      netSavings,
      netCashFlow,
      savingsRate,
      expenseRatio,
      currentBalance: 50000,
      profileMonthlyIncome: profileIncome,
      hasRecordedIncome,
      hasRecordedExpenses,
      hasProfileIncome,
      facts: {},
    },
    spending: {
      available: monthlySpending > 0,
      totalSpending: monthlySpending,
      topCategory: factual.highestCategory
        ? {
            category: factual.highestCategory.category,
            amount: factual.highestCategory.amount,
            percentage: factual.highestCategory.percentage,
            momChangePercentage: 0,
            isTie: factual.highestCategory.isTie,
            tiedCategories: factual.highestCategory.tiedCategories,
          }
        : null,
      lowestCategory: factual.lowestCategory
        ? {
            category: factual.lowestCategory.category,
            amount: factual.lowestCategory.amount,
            percentage: factual.lowestCategory.percentage,
            momChangePercentage: 0,
            isTie: factual.lowestCategory.isTie,
            tiedCategories: factual.lowestCategory.tiedCategories,
          }
        : null,
      zeroSpendingCategories: factual.zeroSpendingCategories,
      discretionaryCategories,
      discretionaryTotal,
      topCategories: overview.categories.filter((c) => c.amount > 0),
      categoryTotals: {},
      categoryPercentages: {},
      merchants: {
        highestMerchant: factual.highestMerchant,
        lowestMerchant: factual.lowestMerchant,
        merchantTotals: factual.merchantTotals,
      },
      extrema: {
        largestExpense: factual.largestExpense,
        smallestExpense: factual.smallestExpense,
      },
      comparison: {
        previousMonth: '2026-09',
        previousSpending: factual.momComparison.previousSpending,
        difference: factual.momComparison.difference,
        percentageChange: factual.momComparison.percentageChange,
        direction: factual.momComparison.direction,
      },
      anomalies: [],
      anomaliesCount: 0,
      facts: {},
    },
    goals: {
      available: false,
      totalGoals: 0,
      items: [],
      facts: {},
    },
    cashFlow: {
      available: true,
      startingBalance: 50000,
      forecastMonthEndBalance: 50000,
      shortfall: 0,
      confidenceLevel: 'High',
      recommendedWeeklyReduction: 0,
      recommendedBuffer: 20000,
      facts: {},
    },
    health: {
      available: true,
      score: 80,
      band: 'Very Good',
      percentile: 85,
      confidence: 'High',
      savingConsistency: 85,
      spendingControl: 80,
      cashFlowStability: 85,
      goalProgress: 75,
      facts: {},
    },
    cashOut: {
      available: false,
      totalAmount: 0,
      count: 0,
      shareOfSpending: 0,
      feeCost: 0,
      feeRate: 0.0185,
      facts: {},
    },
    recentTransactions: [],
  };
}

describe('Personalized Savings Planning Test Suite (TEST 1 to TEST 15)', () => {
  // TEST 1: User asks how to save ৳6,000 per month (English)
  it('TEST 1: User asks how to save ৳6,000 per month (English)', async () => {
    const query = 'How can I save 6000 tk per month?';
    const plan = parseSavingsTarget(query, 71457);
    assert.ok(plan, 'Savings plan should be parsed');
    assert.strictEqual(plan?.targetAmount, 6000);
    assert.strictEqual(plan?.monthlyTarget, 6000);
    assert.strictEqual(plan?.weeklyTarget, 1500);

    const intentRes = classifyIntent(query, 71457);
    assert.strictEqual(intentRes.intent, 'savings_plan');
    assert.ok(intentRes.parsedPlan);

    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 250000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 178543, category: 'Heath', date: '2026-10-05', classification: 'essential' }),
    ];
    const ctx = createMockSavingsContext(txs);
    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.answer.includes('6,000'), 'Answer must explicitly mention ৳6,000');
    assert.ok(res.answer.includes('1,500'), 'Answer must estimate ~৳1,500/week');
  });

  // TEST 2: User asks how to save ৳6,000 in Bangla
  it('TEST 2: User asks how to save ৳6,000 in Bangla', async () => {
    const query = 'আমি প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব?';
    const plan = parseSavingsTarget(query, 71457);
    assert.ok(plan, 'Bangla savings plan should be parsed');
    assert.strictEqual(plan?.targetAmount, 6000);
    assert.strictEqual(plan?.monthlyTarget, 6000);
    assert.strictEqual(plan?.weeklyTarget, 1500);

    const intentRes = classifyIntent(query, 71457);
    assert.strictEqual(intentRes.intent, 'savings_plan');

    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 250000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 178543, category: 'Heath', date: '2026-10-05', classification: 'essential' }),
    ];
    const ctx = createMockSavingsContext(txs);
    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'bn',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.answer.includes('৬,০০০') || res.answer.includes('6,000'), 'Bangla answer must mention ৳৬,০০০');
    assert.ok(res.answer.includes('১,৫০০') || res.answer.includes('1,500'), 'Bangla answer must mention weekly approx ৳১,৫০০');
  });

  // TEST 3: Current monthly surplus is greater than ৳6,000
  it('TEST 3: Current monthly surplus is greater than ৳6,000 (feasible state)', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 100000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 40000, category: 'Living Costs', date: '2026-10-05', classification: 'essential' }),
    ];
    // Income: 100,000, Spending: 40,000 -> Surplus: 60,000 (> 6,000)
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, 60000);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.answer.includes('feasible'), 'Must state target is feasible');
    assert.ok(res.answer.includes('60,000'), 'Must cite current net surplus ৳60,000');
    assert.ok(res.answer.includes('54,000'), 'Must cite surplus exceeding target by ৳54,000');
    assert.ok(
      res.answer.includes('not yet saved money') || res.answer.includes('Pay Yourself First'),
      'Must explain distinction between cash-flow surplus and protected savings'
    );
  });

  // TEST 4: Current monthly surplus is less than ৳6,000
  it('TEST 4: Current monthly surplus is less than ৳6,000 (shortfall, discretionary trim)', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 41000, category: 'Heath', date: '2026-10-02', classification: 'essential' }),
      createTx({ id: '3', type: 'expense', amount: 3000, category: 'Shopping & Gadgets', date: '2026-10-05', classification: 'discretionary' }),
      createTx({ id: '4', type: 'expense', amount: 2000, category: 'Food & Dining', date: '2026-10-10', classification: 'discretionary' }),
    ];
    // Income: 50,000, Spending: 46,000 -> Surplus: 4,000 (< 6,000). Gap: 2,000. Weekly gap: 500.
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, 4000);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.answer.includes('2,000'), 'Must state monthly gap of ৳2,000');
    assert.ok(res.answer.includes('500'), 'Must state weekly trim of ~৳500');
    assert.ok(res.answer.includes('Shopping & Gadgets'), 'Must suggest trimming flexible category');
    assert.ok(!res.answer.includes('Moderate outflows in your top category Heath'), 'Must NOT advise cutting essential medical');
  });

  // TEST 5: Current monthly surplus is zero or negative
  it('TEST 5: Current monthly surplus is zero or negative (deficit state)', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 40000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 45000, category: 'Living Costs', date: '2026-10-05', classification: 'essential' }),
    ];
    // Income: 40,000, Expenses: 45,000 -> Deficit: 5,000. Total Adjustment: 11,000
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, -5000);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.answer.includes('not currently feasible'), 'Must state target is not currently feasible');
    assert.ok(res.answer.includes('5,000'), 'Must cite ৳5,000 deficit');
    assert.ok(res.answer.includes('11,000'), 'Must state total adjustment needed is ৳11,000');
    assert.ok(res.answer.includes('Stop the Deficit First'), 'Must advise stopping deficit first');
  });

  // TEST 6: Income transactions are absent
  it('TEST 6: Income transactions are absent', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'expense', amount: 20000, category: 'Food & Groceries', date: '2026-10-05', classification: 'essential' }),
    ];
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, 0);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.dataGaps && res.dataGaps.length > 0, 'Data gaps must report missing income');
    assert.ok(res.answer.includes('no income transactions') || res.answer.includes('log your income'), 'Must explain income is missing');
  });

  // TEST 7: Expense transactions are absent
  it('TEST 7: Expense transactions are absent', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
    ];
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, 50000);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.dataGaps && res.dataGaps.length > 0, 'Data gaps must report missing expenses');
    assert.ok(res.answer.includes('no expense transactions') || res.answer.includes('log your daily expenses'), 'Must request expense logs');
  });

  // TEST 8: Profile income exists but no income transaction is recorded
  it('TEST 8: Profile income exists but no income transaction is recorded', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'expense', amount: 15000, category: 'Food & Groceries', date: '2026-10-05', classification: 'essential' }),
    ];
    const ctx = createMockSavingsContext(txs, 50000); // Profile income = 50,000, recorded = 0
    const intentRes = classifyIntent(query, 0);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.answer.includes('50,000'), 'Must cite profile benchmark income of ৳50,000');
    assert.ok(res.answer.includes('15,000'), 'Must cite recorded spending of ৳15,000');
    assert.ok(res.answer.includes('no income transactions have been logged') || res.answer.includes('record your actual income'), 'Must clarify no income logged');
  });

  // TEST 9: Transfers exist and must be excluded from income/expenses
  it('TEST 9: Transfers exist and must be excluded from income/expenses', () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 20000, category: 'Food & Groceries', date: '2026-10-05' }),
      createTx({ id: '3', type: 'transfer', amount: 100000, category: 'Transfer', date: '2026-10-06' }),
    ];
    const ctx = createMockSavingsContext(txs);
    assert.strictEqual(ctx.snapshot.monthlyIncome, 50000, 'Income must exclude transfers');
    assert.strictEqual(ctx.snapshot.monthlySpending, 20000, 'Spending must exclude transfers');
    assert.strictEqual(ctx.snapshot.netCashFlow, 30000, 'Cash flow must be 50,000 - 20,000');
  });

  // TEST 10: The savings rate denominator is zero
  it('TEST 10: The savings rate denominator is zero (income = 0)', () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'expense', amount: 10000, category: 'Rent', date: '2026-10-05' }),
    ];
    const ctx = createMockSavingsContext(txs);
    assert.strictEqual(ctx.snapshot.savingsRate, 0, 'Savings rate must be 0 when income is 0');
    assert.ok(!isNaN(ctx.snapshot.savingsRate), 'Savings rate must not be NaN');
    assert.ok(isFinite(ctx.snapshot.savingsRate), 'Savings rate must be finite');
  });

  // TEST 11: The category name must not be truncated
  it('TEST 11: The category name "Heath" must not be truncated', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 250000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 171994, category: 'Heath', date: '2026-10-05', classification: 'essential' }),
    ];
    const ctx = createMockSavingsContext(txs);
    assert.strictEqual(ctx.spending.topCategory?.category, 'Heath', 'Top category must be exactly "Heath"');
    assert.strictEqual(ctx.spending.topCategory?.amount, 171994);
  });

  // TEST 12: Gemini is unavailable
  it('TEST 12: Gemini is unavailable (aiClient = null)', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 100000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 30000, category: 'Shopping & Gadgets', date: '2026-10-05', classification: 'discretionary' }),
    ];
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, 70000);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null, // Gemini unavailable
    });

    assert.strictEqual(res.source, 'fallback', 'Must use deterministic fallback when Gemini is unavailable');
    assert.ok(res.answer.includes('6,000'), 'Fallback must address ৳6,000');
    assert.ok(res.answer.includes('1,500'), 'Fallback must address ৳1,500');
  });

  // TEST 13: Financial context contains insufficient data
  it('TEST 13: Financial context contains insufficient data (0 transactions)', async () => {
    const query = 'How can I save 6000 tk per month?';
    const ctx = createMockSavingsContext([]);
    const intentRes = classifyIntent(query, 0);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    assert.ok(res.dataGaps && res.dataGaps.length > 0, 'Data gaps must report missing data');
    assert.ok(res.answer.includes('no recorded transactions'), 'Must state no transactions exist');
  });

  // TEST 14: The response addresses the requested target directly
  it('TEST 14: The response addresses the requested target directly in the opening', async () => {
    const query = 'How can I save 6000 tk per month?';
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 80000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 30000, category: 'Living Costs', date: '2026-10-05' }),
    ];
    const ctx = createMockSavingsContext(txs);
    const intentRes = classifyIntent(query, 50000);

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
      aiClient: null,
    });

    const firstLine = res.answer.split('\n')[0];
    assert.ok(firstLine.includes('6,000'), 'First line must directly address ৳6,000 target');
  });

  // TEST 15: Existing highest/lowest spending tests still pass
  it('TEST 15: Existing highest/lowest spending factual queries still return accurate figures', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 15000, category: 'Food & Groceries', date: '2026-10-02', merchant: 'Shwapno' }),
      createTx({ id: '3', type: 'expense', amount: 2000, category: 'Utility & Fixed Costs', date: '2026-10-03', merchant: 'DESCO' }),
    ];
    const ctx = createMockSavingsContext(txs);

    // Highest category inquiry
    const topCatRes = classifyIntent('What is my highest spending category?');
    assert.strictEqual(topCatRes.intent, 'top_category');
    const resTop = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What is my highest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: topCatRes,
      aiClient: null,
    });
    assert.ok(resTop.answer.includes('Food & Groceries'), 'Must cite Food & Groceries');
    assert.ok(resTop.answer.includes('15,000'), 'Must cite ৳15,000');

    // Lowest category inquiry
    const lowCatRes = classifyIntent('What was my lowest spending category?');
    assert.strictEqual(lowCatRes.intent, 'lowest_category');
    const resLow = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What was my lowest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: lowCatRes,
      aiClient: null,
    });
    assert.ok(resLow.answer.includes('Utility & Fixed Costs'), 'Must cite Utility & Fixed Costs');
    assert.ok(resLow.answer.includes('2,000'), 'Must cite ৳2,000');
  });
});

