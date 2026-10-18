import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateCategorySpending,
  getHighestSpendingCategory,
  getLowestSpendingCategory,
  getHighestSpendingMerchant,
  getLowestSpendingMerchant,
  getLargestIndividualExpense,
  getSmallestIndividualExpense,
  calculateFactualAnalysis,
} from '../../src/services/financialCalculations';
import { classifyIntent, sliceContext } from '../services/intentClassifier';
import { generateDeterministicCoachResponse } from '../services/coachFallbackEngine';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { validateCoachNumbers } from '../services/coachNumberValidator';
import { CoachContext } from '../services/coachContextBuilder';
import { Transaction } from '../../src/types/financial';

// Fixture 1: Standard monthly ledger with distinct highest and lowest
const FIXTURE_STANDARD_TXS: Transaction[] = [
  {
    id: 'tx-inc-1',
    type: 'income',
    amount: 50000,
    category: 'Salary & Professional',
    description: 'Monthly Salary',
    date: '2026-10-01',
    merchant: 'Employer Ltd',
    account: 'City Bank',
    paymentMethod: 'Bank Transfer Direct',
    classification: 'essential',
  },
  {
    id: 'tx-exp-1',
    type: 'expense',
    amount: 8000,
    category: 'Food & Groceries',
    description: 'Monthly grocery run',
    date: '2026-10-05',
    merchant: 'Shwapno',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: 'essential',
  },
  {
    id: 'tx-exp-2',
    type: 'expense',
    amount: 4000,
    category: 'Food & Groceries',
    description: 'Mid-month veggies and fish',
    date: '2026-10-15',
    merchant: 'Agora',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: 'essential',
  },
  {
    id: 'tx-exp-3',
    type: 'expense',
    amount: 7000,
    category: 'Shopping & Gadgets',
    description: 'Wireless Headphones',
    date: '2026-10-10',
    merchant: 'Daraz',
    account: 'City Bank',
    paymentMethod: 'Visa Debit Card',
    classification: 'discretionary',
  },
  {
    id: 'tx-exp-4',
    type: 'expense',
    amount: 2000,
    category: 'Transportation',
    description: 'Airport ride',
    date: '2026-10-08',
    merchant: 'Uber',
    account: 'bKash',
    paymentMethod: 'bKash Direct',
    classification: 'discretionary',
  },
  {
    id: 'tx-exp-5',
    type: 'expense',
    amount: 1000,
    category: 'Transportation',
    description: 'Daily office commute',
    date: '2026-10-12',
    merchant: 'Pathao',
    account: 'bKash',
    paymentMethod: 'bKash Direct',
    classification: 'discretionary',
  },
  {
    id: 'tx-exp-6',
    type: 'expense',
    amount: 1500,
    category: 'Utility & Fixed Costs',
    description: 'Electricity bill',
    date: '2026-10-07',
    merchant: 'DESCO',
    account: 'bKash',
    paymentMethod: 'bKash Bill Pay',
    classification: 'essential',
  },
  // Previous month transaction for MoM comparison (2026-09)
  {
    id: 'tx-prev-1',
    type: 'expense',
    amount: 20000,
    category: 'Food & Groceries',
    description: 'September living expenses',
    date: '2026-09-10',
    merchant: 'Shwapno',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: 'essential',
  },
];

// Helper to construct a typed CoachContext from transactions
function createMockContext(transactions: Transaction[], activeMonth = '2026-10'): CoachContext {
  const factual = calculateFactualAnalysis(transactions, activeMonth);
  const categories = calculateCategorySpending(transactions, activeMonth, '2026-09');

  const topCategoryItem = factual.highestCategory
    ? {
        category: factual.highestCategory.category,
        amount: factual.highestCategory.amount,
        percentage: factual.highestCategory.percentage,
        momChangePercentage: 10,
        isTie: factual.highestCategory.isTie,
        tiedCategories: factual.highestCategory.tiedCategories,
      }
    : null;

  const lowestCategoryItem = factual.lowestCategory
    ? {
        category: factual.lowestCategory.category,
        amount: factual.lowestCategory.amount,
        percentage: factual.lowestCategory.percentage,
        momChangePercentage: -5,
        isTie: factual.lowestCategory.isTie,
        tiedCategories: factual.lowestCategory.tiedCategories,
      }
    : null;

  const categoryTotals: Record<string, number> = {};
  const categoryPercentages: Record<string, number> = {};
  categories.forEach((c) => {
    categoryTotals[c.category] = c.amount;
    categoryPercentages[c.category] = c.percentage;
  });

  return {
    metadata: {
      today: `${activeMonth}-15`,
      dataWindow: {
        currentMonth: activeMonth,
        previousMonths: ['2026-09', '2026-08', '2026-07'],
        hasData: transactions.length > 0,
        totalTransactions: transactions.length,
      },
    },
    snapshot: {
      available: factual.totalExpenses > 0 || factual.totalIncome > 0,
      monthlyIncome: factual.totalIncome,
      monthlySpending: factual.totalExpenses,
      netSavings: factual.netSavings,
      savingsRate: factual.totalIncome > 0 ? Number(((factual.netSavings / factual.totalIncome) * 100).toFixed(1)) : 0,
      expenseRatio: factual.totalIncome > 0 ? Number(((factual.totalExpenses / factual.totalIncome) * 100).toFixed(1)) : 0,
      currentBalance: 35000,
      facts: {},
    },
    spending: {
      available: factual.totalExpenses > 0,
      totalSpending: factual.totalExpenses,
      topCategory: topCategoryItem,
      lowestCategory: lowestCategoryItem,
      zeroSpendingCategories: factual.zeroSpendingCategories,
      topCategories: categories.filter((c) => c.amount > 0),
      categoryTotals,
      categoryPercentages,
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
      startingBalance: 35000,
      forecastMonthEndBalance: 35000,
      shortfall: 0,
      confidenceLevel: 'High',
      recommendedWeeklyReduction: 0,
      recommendedBuffer: 15000,
      facts: {},
    },
    health: {
      available: true,
      score: 75,
      band: 'Good',
      percentile: 80,
      confidence: 'High',
      savingConsistency: 80,
      spendingControl: 75,
      cashFlowStability: 85,
      goalProgress: 60,
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
    recentTransactions: transactions.slice(0, 5).map((t) => ({
      type: t.type,
      amount: t.amount,
      category: t.category,
      date: t.date,
      description: t.description,
    })),
  };
}

describe('Deterministic Financial Extrema & Accuracy Test Suite (TEST A - TEST N)', () => {
  // TEST A: Highest spending category query returns the correct highest category, amount, percentage
  it('TEST A: Highest spending category query returns correct highest category, amount, and percentage', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('What is my highest spending category?');
    assert.strictEqual(intentRes.intent, 'top_category');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What is my highest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Food & Groceries'), 'Answer must mention Food & Groceries');
    assert.ok(res.answer.includes('12,000') || res.answer.includes('12000'), 'Answer must mention ৳12,000');
    assert.ok(res.answer.includes('51.1%'), 'Answer must cite 51.1% of total expenses');
  });

  // TEST B: Lowest spending category query returns the correct lowest category, amount, percentage
  it('TEST B: Lowest spending category query returns correct lowest category, amount, and percentage', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('What was my lowest spending category?');
    assert.strictEqual(intentRes.intent, 'lowest_category');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What was my lowest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Utility & Fixed Costs'), 'Answer must mention Utility & Fixed Costs');
    assert.ok(res.answer.includes('1,500') || res.answer.includes('1500'), 'Answer must mention ৳1,500');
    assert.ok(res.answer.includes('6.4%'), 'Answer must cite 6.4% of total expenses');
  });

  // TEST C: Query asking for lowest spending does NOT return highest spending
  it('TEST C: Query asking for lowest spending does NOT return highest spending', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('What is my lowest expense?');
    assert.strictEqual(intentRes.intent, 'lowest_category');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What is my lowest expense?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    // Lowest is Utility & Fixed Costs (1500), highest is Food & Groceries (12000)
    assert.ok(!res.answer.includes('Food & Groceries'), 'Lowest spending answer must NOT cite Food & Groceries');
    assert.ok(!res.answer.includes('12,000'), 'Lowest spending answer must NOT cite ৳12,000');
    assert.ok(res.answer.includes('Utility & Fixed Costs'), 'Lowest spending answer must identify Utility & Fixed Costs');
  });

  // TEST D: Query asking for highest spending does NOT return lowest spending
  it('TEST D: Query asking for highest spending does NOT return lowest spending', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('What is my biggest expense category?');
    assert.strictEqual(intentRes.intent, 'top_category');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What is my biggest expense category?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(!res.answer.includes('Utility & Fixed Costs'), 'Top spending answer must NOT cite Utility & Fixed Costs');
    assert.ok(!res.answer.includes('1,500'), 'Top spending answer must NOT cite ৳1,500');
    assert.ok(res.answer.includes('Food & Groceries'), 'Top spending answer must identify Food & Groceries');
  });

  // TEST E: Positive lowest spending is correctly reported when zero-spending categories exist
  it('TEST E: Positive lowest spending is correctly reported when zero-spending categories exist', () => {
    const categories = calculateCategorySpending(FIXTURE_STANDARD_TXS, '2026-10', '2026-09');
    // Entertainment & Others and Cash-out have 0 spend
    const zeroCats = categories.filter((c) => c.amount === 0);
    assert.ok(zeroCats.length > 0, 'Zero-spend categories must exist in categories list');

    // Lowest positive must exclude 0 by default
    const lowestPositive = getLowestSpendingCategory(categories, false);
    assert.ok(lowestPositive !== null);
    assert.strictEqual(lowestPositive.category, 'Utility & Fixed Costs');
    assert.strictEqual(lowestPositive.amount, 1500);
  });

  // TEST F: Ties in highest or lowest spending are reported transparently
  it('TEST F: Ties in highest or lowest spending are reported transparently', async () => {
    const tiedTxs: Transaction[] = [
      {
        id: 't1',
        type: 'expense',
        amount: 5000,
        category: 'Food & Groceries',
        description: 'Groceries',
        date: '2026-10-01',
        merchant: 'Shwapno',
        account: 'bKash',
        paymentMethod: 'bKash',
        classification: 'essential',
      },
      {
        id: 't2',
        type: 'expense',
        amount: 5000,
        category: 'Transportation',
        description: 'Fuel',
        date: '2026-10-02',
        merchant: 'Filling Station',
        account: 'bKash',
        paymentMethod: 'bKash',
        classification: 'essential',
      },
      {
        id: 't3',
        type: 'expense',
        amount: 2000,
        category: 'Shopping & Gadgets',
        description: 'Clothes',
        date: '2026-10-03',
        merchant: 'Daraz',
        account: 'bKash',
        paymentMethod: 'bKash',
        classification: 'discretionary',
      },
      {
        id: 't4',
        type: 'expense',
        amount: 2000,
        category: 'Utility & Fixed Costs',
        description: 'Internet',
        date: '2026-10-04',
        merchant: 'Carnival',
        account: 'bKash',
        paymentMethod: 'bKash',
        classification: 'essential',
      },
    ];

    const ctx = createMockContext(tiedTxs);
    assert.strictEqual(ctx.spending.topCategory?.isTie, true, 'Top category should detect tie');
    assert.strictEqual(ctx.spending.lowestCategory?.isTie, true, 'Lowest category should detect tie');

    // Check lowest category tie response
    const lowRes = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What is my lowest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: { intent: 'lowest_category', confidence: 0.95, matchedKeywords: ['lowest category'] },
    });
    assert.ok(lowRes.answer.toLowerCase().includes('tied between'), 'Response must explain tie');
    assert.ok(lowRes.answer.includes('Shopping & Gadgets') && lowRes.answer.includes('Utility & Fixed Costs'));
  });

  // TEST G: Highest spending merchant query returns the correct merchant and amount
  it('TEST G: Highest spending merchant query returns the correct merchant and amount', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('Which merchant did I spend the most at?');
    assert.strictEqual(intentRes.intent, 'highest_merchant');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'Which merchant did I spend the most at?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Shwapno'), 'Answer must mention Shwapno');
    assert.ok(res.answer.includes('8,000') || res.answer.includes('8000'), 'Answer must mention ৳8,000');
  });

  // TEST H: Lowest spending merchant query returns the correct merchant and amount
  it('TEST H: Lowest spending merchant query returns the correct merchant and amount', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('Which merchant did I spend the least at?');
    assert.strictEqual(intentRes.intent, 'lowest_merchant');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'Which merchant did I spend the least at?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Pathao'), 'Answer must mention Pathao');
    assert.ok(res.answer.includes('1,000') || res.answer.includes('1000'), 'Answer must mention ৳1,000');
  });

  // TEST I: Largest individual expense transaction query returns correct transaction, category, and date
  it('TEST I: Largest individual expense query returns correct transaction, category, and date', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('What was my largest individual expense?');
    assert.strictEqual(intentRes.intent, 'largest_expense');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What was my largest individual expense?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('8,000') || res.answer.includes('8000'), 'Must cite ৳8,000');
    assert.ok(res.answer.includes('Food & Groceries'), 'Must cite Food & Groceries');
    assert.ok(res.answer.includes('2026-10-05'), 'Must cite date 2026-10-05');
  });

  // TEST J: Smallest individual expense transaction query returns correct transaction, category, and date
  it('TEST J: Smallest individual expense query returns correct transaction, category, and date', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('What was my smallest single expense?');
    assert.strictEqual(intentRes.intent, 'smallest_expense');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What was my smallest single expense?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('1,000') || res.answer.includes('1000'), 'Must cite ৳1,000');
    assert.ok(res.answer.includes('Transportation'), 'Must cite Transportation');
    assert.ok(res.answer.includes('2026-10-12'), 'Must cite date 2026-10-12');
  });

  // TEST K: Zero-spending categories query correctly identifies categories with no expenses
  it('TEST K: Zero-spending categories query correctly identifies categories with no expenses', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('Which categories had zero spending?');
    assert.strictEqual(intentRes.intent, 'zero_spending');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'Which categories had zero spending?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Entertainment & Others') || res.answer.includes('Cash-out & Bank Fees'));
  });

  // TEST L: Month-over-month comparison accurately compares spending across months
  it('TEST L: Month-over-month comparison accurately compares spending across months', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    const intentRes = classifyIntent('Did I spend more than last month?');
    assert.strictEqual(intentRes.intent, 'mom_comparison');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query: 'Did I spend more than last month?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    // 2026-10: 23,500 vs 2026-09: 20,000 (+3,500, +17.5%)
    assert.ok(res.answer.includes('17.5%'), 'Answer must mention 17.5% increase');
    assert.ok(res.answer.includes('3,500') || res.answer.includes('3500'), 'Answer must cite ৳3,500 difference');
    assert.ok(res.answer.includes('20,000') || res.answer.includes('20000'), 'Answer must cite previous month spending ৳20,000');
  });

  // TEST M: Insufficient data produces a helpful, accurate, graceful response
  it('TEST M: Insufficient data produces a helpful, accurate, graceful response', async () => {
    const ctx = createMockContext([]);
    const intentRes = classifyIntent('What was my lowest spending category?');

    const res = await executeCoachInquiry({
      userId: 'test-user-empty',
      query: 'What was my lowest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.dataGaps.length > 0, 'Data gaps must be recorded');
    assert.ok(res.answer.toLowerCase().includes('no positive expense') || res.answer.toLowerCase().includes('no categorized'));
  });

  // TEST N: Both English and Bangla queries return verified factual numbers
  it('TEST N: Both English and Bangla queries return verified factual numbers', async () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);

    // English lowest category
    const enRes = await executeCoachInquiry({
      userId: 'test-user',
      query: 'What is my lowest spending category?',
      language: 'en',
      fullContext: ctx,
      intentResult: { intent: 'lowest_category', confidence: 0.95, matchedKeywords: ['lowest spending'] },
    });
    assert.ok(enRes.answer.includes('Utility & Fixed Costs'));
    assert.ok(enRes.answer.includes('1,500'));

    // Bangla lowest category
    const bnIntent = classifyIntent('আমার সর্বনিম্ন খরচের খাত কোনটি?');
    assert.strictEqual(bnIntent.intent, 'lowest_category');

    const bnRes = await executeCoachInquiry({
      userId: 'test-user',
      query: 'আমার সর্বনিম্ন খরচের খাত কোনটি?',
      language: 'bn',
      fullContext: ctx,
      intentResult: bnIntent,
    });
    assert.ok(bnRes.answer.includes('Utility & Fixed Costs'));
    assert.ok(bnRes.answer.includes('১,৫০০') || bnRes.answer.includes('1,500'));
    assert.ok(bnRes.answer.includes('সর্বনিম্ন খরচের খাত হলো'));
  });

  // Semantic contradiction test: validateCoachNumbers rejects claiming top category as lowest
  it('Semantic contradiction validation rejects claiming highest category when lowest was requested', () => {
    const ctx = createMockContext(FIXTURE_STANDARD_TXS);
    // Hallucinated answer claiming Food & Groceries (highest) is the lowest category
    const contradictoryAnswer = 'Your lowest spending category is Food & Groceries with ৳12,000 spent.';
    const val = validateCoachNumbers(contradictoryAnswer, ctx, [], 'lowest_category');
    assert.strictEqual(val.valid, false, 'Contradictory answer must be rejected');
    assert.ok(val.reason?.includes('Semantic contradiction'), `Expected contradiction reason, got ${val.reason}`);
  });

  // Prompt 10: User bug verification - "Which category I spend lowest money?"
  it('Prompt 10 regression: "Which category I spend lowest money?" correctly identifies lowest category and never claims data is unavailable', async () => {
    // Exact scenario from prompt: Health ৳2500, Food ৳1200, Transport ৳1000 = Total ৳4700
    const promptScenarioTxs: Transaction[] = [
      {
        id: 'tx-health-1',
        type: 'expense',
        amount: 2500,
        category: 'Health',
        description: 'Doctor consultation & medicine',
        date: '2026-10-02',
        merchant: 'Square Hospital',
        account: 'bKash',
        paymentMethod: 'bKash Direct',
        classification: 'essential',
      },
      {
        id: 'tx-food-1',
        type: 'expense',
        amount: 1200,
        category: 'Food & Groceries',
        description: 'Bazaar vegetables & groceries',
        date: '2026-10-05',
        merchant: 'Karwan Bazar',
        account: 'bKash',
        paymentMethod: 'bKash Direct',
        classification: 'essential',
      },
      {
        id: 'tx-transport-1',
        type: 'expense',
        amount: 1000,
        category: 'Transportation',
        description: 'Commute and rides',
        date: '2026-10-08',
        merchant: 'Pathao',
        account: 'bKash',
        paymentMethod: 'bKash Direct',
        classification: 'discretionary',
      },
      {
        id: 'tx-income-1',
        type: 'income',
        amount: 30000,
        category: 'Salary & Professional',
        description: 'Monthly income',
        date: '2026-10-01',
        merchant: 'Employer',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
    ];

    const ctx = createMockContext(promptScenarioTxs);
    assert.strictEqual(ctx.spending.totalSpending, 4700, 'Total spending must be 4700');
    assert.strictEqual(ctx.spending.topCategory?.category, 'Health', 'Top category must be Health');
    assert.strictEqual(ctx.spending.topCategory?.amount, 2500, 'Top category amount must be 2500');
    assert.strictEqual(ctx.spending.lowestCategory?.category, 'Transportation', 'Lowest category must be Transportation');
    assert.strictEqual(ctx.spending.lowestCategory?.amount, 1000, 'Lowest category amount must be 1000');

    const query = 'Which category I spend lowest money?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'lowest_category', 'Intent must be lowest_category');

    const res = await executeCoachInquiry({
      userId: 'test-user-prompt10',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(!res.answer.toLowerCase().includes('data on your lowest spending category is currently unavailable'),
      'Must NOT claim lowest spending category data is unavailable');
    assert.ok(res.answer.includes('Transportation'), 'Answer must identify Transportation as lowest category');
    assert.ok(res.answer.includes('1,000'), 'Answer must cite ৳1,000 for Transportation');
  });

  it('Single category spending: correctly reports single category 100% share without error', async () => {
    const singleCatTxs: Transaction[] = [
      {
        id: 'tx-single-1',
        type: 'expense',
        amount: 2500,
        category: 'Health',
        description: 'Medicine purchase',
        date: '2026-10-03',
        merchant: 'Lazz Pharma',
        account: 'bKash',
        paymentMethod: 'bKash Direct',
        classification: 'essential',
      },
    ];

    const ctx = createMockContext(singleCatTxs);
    const query = 'Which category did I spend the least on?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'lowest_category');

    const res = await executeCoachInquiry({
      userId: 'test-user-single',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Health'), 'Answer must mention Health');
    assert.ok(res.answer.includes('2,500'), 'Answer must cite ৳2,500');
    assert.ok(res.answer.includes('100%'), 'Answer must indicate 100% of spending');
  });

  it('Specific category inquiry: "How much did I spend on Health?" correctly returns Health amount and percentage', async () => {
    const multiCatTxs: Transaction[] = [
      {
        id: 'tx-health-1',
        type: 'expense',
        amount: 2500,
        category: 'Health',
        description: 'Medicine',
        date: '2026-10-04',
        merchant: 'Pharmacy',
        account: 'bKash',
        paymentMethod: 'bKash Direct',
        classification: 'essential',
      },
      {
        id: 'tx-food-1',
        type: 'expense',
        amount: 2200,
        category: 'Food & Groceries',
        description: 'Food',
        date: '2026-10-05',
        merchant: 'Shwapno',
        account: 'bKash',
        paymentMethod: 'bKash Direct',
        classification: 'essential',
      },
    ];

    const ctx = createMockContext(multiCatTxs);
    const query = 'How much did I spend on Health?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'category_spending');
    assert.strictEqual(intentRes.matchedCategory, 'Health');

    const res = await executeCoachInquiry({
      userId: 'test-user-cat',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult: intentRes,
    });

    assert.ok(res.answer.includes('Health'), 'Answer must mention Health');
    assert.ok(res.answer.includes('2,500'), 'Answer must cite ৳2,500');
    assert.ok(res.answer.includes('53.2%'), 'Answer must cite correct percentage (2500/4700 = 53.2%)');
  });

  it('Income transactions are strictly excluded from spending extrema and category breakdowns', () => {
    const txsWithLargeIncome: Transaction[] = [
      {
        id: 'tx-inc-huge',
        type: 'income',
        amount: 500000,
        category: 'Salary & Professional',
        description: 'Major contract bonus',
        date: '2026-10-01',
        merchant: 'Client Direct',
        account: 'City Bank',
        paymentMethod: 'Wire',
        classification: 'essential',
      },
      {
        id: 'tx-exp-1',
        type: 'expense',
        amount: 2000,
        category: 'Food & Groceries',
        description: 'Dinner',
        date: '2026-10-02',
        merchant: 'KFC',
        account: 'bKash',
        paymentMethod: 'bKash QR',
        classification: 'discretionary',
      },
      {
        id: 'tx-exp-2',
        type: 'expense',
        amount: 500,
        category: 'Transportation',
        description: 'Rickshaw fare',
        date: '2026-10-03',
        merchant: 'General Merchant',
        account: 'bKash',
        paymentMethod: 'Cash',
        classification: 'discretionary',
      },
    ];

    const factual = calculateFactualAnalysis(txsWithLargeIncome, '2026-10');
    assert.strictEqual(factual.totalIncome, 500000, 'Income must be 500,000');
    assert.strictEqual(factual.totalExpenses, 2500, 'Expenses must be 2,500');
    assert.strictEqual(factual.highestCategory?.category, 'Food & Groceries', 'Top expense category must be Food & Groceries, NOT Salary');
    assert.strictEqual(factual.highestCategory?.amount, 2000);
    assert.strictEqual(factual.lowestCategory?.category, 'Transportation', 'Lowest expense category must be Transportation, NOT Salary');
    assert.strictEqual(factual.lowestCategory?.amount, 500);
  });
});
