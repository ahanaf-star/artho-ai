import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, parseSavingsTarget } from '../services/intentClassifier';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { generateDeterministicCoachResponse } from '../services/coachFallbackEngine';
import { validateCoachNumbers } from '../services/coachNumberValidator';
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
    merchant: 'Merchant',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: partial.type === 'income' ? 'essential' : 'discretionary',
    ...partial,
  };
}

function buildTestContext(
  transactions: Transaction[],
  profileIncome?: number,
  activeMonth: string = '2026-10',
  currentBalance: number = 25000
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
  const essentialTotal = monthlySpending - discretionaryTotal;

  return {
    metadata: {
      today: '2026-10-18',
      dataWindow: {
        currentMonth: activeMonth,
        today: '2026-10-18',
        hasData: eligibleTransactions.length > 0,
        totalTransactions: eligibleTransactions.length,
        historicalMonthsCount: 1,
      },
    },
    snapshot: {
      monthlyIncome,
      monthlySpending,
      netSavings,
      savingsRate,
      expenseRatio,
      currentBalance,
      profileMonthlyIncome: profileIncome,
      profileMonthlyIncomeCurrency: 'BDT',
      netCashFlow,
    },
    spending: {
      totalSpending: monthlySpending,
      essentialTotal,
      discretionaryTotal,
      topCategory: factual.highestCategory,
      lowestCategory: factual.lowestCategory,
      topCategories: overview.categories.slice(0, 5).map((c) => ({
        category: c.category,
        amount: c.amount,
        percentage: c.percentage,
      })),
      discretionaryCategories,
      essentialCategories: overview.categories
        .filter((c) => isEssentialCat(c.category))
        .map((c) => ({
          category: c.category,
          amount: c.amount,
          percentage: c.percentage,
        })),
      categoryTotals: Object.fromEntries(overview.categories.map((c) => [c.category, c.amount])),
      categoryPercentages: Object.fromEntries(overview.categories.map((c) => [c.category, c.percentage])),
      anomaliesCount: 0,
    },
    cashFlow: {
      startingBalance: currentBalance,
      forecastMonthEndBalance: currentBalance + netCashFlow,
      recommendedBuffer: Math.round(monthlySpending * 0.5),
      recommendedWeeklyReduction: netCashFlow < 0 ? Math.round(Math.abs(netCashFlow) / 4) : 0,
      safeSpendingLimitWeekly: netCashFlow > 0 ? Math.round(netCashFlow / 4) : 0,
      uncommittedDiscretionaryPool: Math.max(0, netCashFlow),
      remainingDaysInMonth: 13,
      upcomingBills: 0,
      committedFunds: 0,
      isBalanceEstimated: false,
      isForecastSufficient: true,
    },
    goals: {
      items: [],
      totalTarget: 0,
      totalCurrent: 0,
    },
    health: {
      score: monthlyIncome > monthlySpending ? 78 : 42,
      band: monthlyIncome > monthlySpending ? 'good' : 'vulnerable',
    },
    cashOut: {
      totalAmount: 0,
      feeCost: 0,
      count: 0,
      providerBreakdown: {},
    },
    recentTransactions: eligibleTransactions.slice(-5),
  } as unknown as CoachContext;
}

describe('AI Financial Planning Assistant — Comprehensive Suite', () => {
  // 1. Personalized savings recommendations based on income and expenses
  it('1. Provides personalized savings recommendations based on income, spending, and surplus', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 60000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 25000, category: 'Housing', classification: 'essential', date: '2026-10-05' }),
      createTx({ id: '3', type: 'expense', amount: 15000, category: 'Food & Dining', classification: 'discretionary', date: '2026-10-10' }),
    ];
    const ctx = buildTestContext(txs, 60000);
    const query = 'How can I save more money this month?';
    const intentRes = classifyIntent(query);
    assert.equal(intentRes.intent, 'savings_plan');

    const res = await executeCoachInquiry({
      query,
      language: 'en',
      fullContext: ctx,
      userName: 'Rahim Uddin',
    });

    assert.ok(res.answer.includes('Assalamu Alaikum Rahim!'));
    assert.ok(res.answer.includes('60,000') || res.answer.includes('20,000'));
    assert.ok(res.answer.includes('surplus') || res.answer.includes('Surplus') || res.answer.includes('savings'));
    assert.ok(res.dataGaps.length <= 1);
  });

  // 2. Future financial goal calculations (8-part structured plan)
  it('2. Formulates an 8-part actionable plan for future goals (e.g. saving for a laptop)', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 20000, category: 'Rent', classification: 'essential', date: '2026-10-05' }),
      createTx({ id: '3', type: 'expense', amount: 10000, category: 'Entertainment', classification: 'discretionary', date: '2026-10-10' }),
    ];
    const ctx = buildTestContext(txs, 50000);
    const query = 'I want to save 50000 in 6 months to buy a laptop';
    const parsed = parseSavingsTarget(query, ctx);
    assert.ok(parsed);
    assert.equal(parsed.targetAmount, 50000);
    assert.equal(parsed.monthsDuration, 6);
    assert.equal(parsed.requiredMonthly, 8333);
    assert.equal(parsed.weeklyTarget, 2083);
    assert.equal(parsed.isFeasible, true);

    const intentRes = classifyIntent(query, ctx.snapshot.netSavings);
    const res = generateDeterministicCoachResponse(intentRes, ctx, 'en', query, 'Ahmed');

    // Verify all 8 structured parts are present
    assert.ok(res.answer.includes('1. **Current Financial Situation**'));
    assert.ok(res.answer.includes('2. **Selected Goal**'));
    assert.ok(res.answer.includes('3. **Target Savings Amount**: **৳50,000**'));
    assert.ok(res.answer.includes('4. **Recommended Timeframe**: **6 months**'));
    assert.ok(res.answer.includes('5. **Required Savings Pace**: **৳8,333/month**'));
    assert.ok(res.answer.includes('6. **Feasibility & Suggested Adjustments**'));
    assert.ok(res.answer.includes('7. **Potential Obstacles**'));
    assert.ok(res.answer.includes('8. **Realistic Next Action**'));
  });

  // 3. Monthly savings requirement calculation (Bengali & English)
  it('3. Calculates monthly and weekly requirements for 1-year and multi-month targets accurately', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 40000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 25000, category: 'Living', date: '2026-10-05' }),
    ];
    const ctx = buildTestContext(txs, 40000);

    // Bengali query: ১ বছরে ৫০ হাজার টাকা
    const queryBn = 'আমি ১ বছরে ৫০ হাজার টাকা সঞ্চয় করতে চাই';
    const parsedBn = parseSavingsTarget(queryBn, ctx);
    assert.ok(parsedBn);
    assert.equal(parsedBn.targetAmount, 50000);
    assert.equal(parsedBn.monthsDuration, 12);
    assert.equal(parsedBn.requiredMonthly, 4167);
    assert.equal(parsedBn.weeklyTarget, 1042);

    const intentResBn = classifyIntent(queryBn, ctx.snapshot.netSavings);
    const resBn = generateDeterministicCoachResponse(intentResBn, ctx, 'bn', queryBn, 'করিম');
    assert.ok(resBn.answer.includes('50,000') || resBn.answer.includes('৫০,০০০'));
    assert.ok(resBn.answer.includes('১২ মাস') || resBn.answer.includes('12'));
    assert.ok(resBn.answer.includes('4,167') || resBn.answer.includes('৪,১৬৭'));
  });

  // 4. Budget planning with insufficient income / spending exceeding income (Deficit)
  it('4. Alerts on budget deficit and provides 3 emergency reduction steps without aggressive savings advice', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 30000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 20000, category: 'Rent', classification: 'essential', date: '2026-10-02' }),
      createTx({ id: '3', type: 'expense', amount: 15000, category: 'Shopping', classification: 'discretionary', date: '2026-10-08' }),
    ]; // Total income: 30,000; Total spending: 35,000 -> Deficit: -5,000
    const ctx = buildTestContext(txs, 30000);
    assert.equal(ctx.snapshot.monthlyIncome, 30000);
    assert.equal(ctx.snapshot.monthlySpending, 35000);
    assert.equal(ctx.snapshot.netCashFlow, -5000);

    const query = 'Help me plan a budget';
    const intentRes = classifyIntent(query);
    assert.equal(intentRes.intent, 'budget_help');

    const res = generateDeterministicCoachResponse(intentRes, ctx, 'en', query, 'Fatima');

    assert.ok(res.answer.includes('Budget Alert: Your spending exceeds your income'));
    assert.ok(res.answer.includes('-৳5,000'));
    assert.ok(res.answer.includes('do not recommend aggressive savings targets'));
    assert.ok(res.answer.includes('3 Immediate Actions to Eliminate Deficit'));
    assert.ok(res.answer.includes('Freeze Discretionary Outflows'));
  });

  // 5. Zero income and negative cash flow edge cases
  it('5. Handles zero income and negative cash flow cleanly with cash burn analysis', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'expense', amount: 12000, category: 'Rent', classification: 'essential', date: '2026-10-03' }),
    ];
    const ctx = buildTestContext(txs, 0, '2026-10', 30000);
    assert.equal(ctx.snapshot.monthlyIncome, 0);
    assert.equal(ctx.snapshot.monthlySpending, 12000);
    assert.equal(ctx.snapshot.netCashFlow, -12000);

    const query = 'Am I spending more than I earn?';
    const intentRes = classifyIntent(query);
    assert.equal(intentRes.intent, 'spending_vs_income');

    const res = generateDeterministicCoachResponse(intentRes, ctx, 'en', query, 'Imran');
    assert.ok(res.answer.includes('Yes, you are spending more than you earn'));
    assert.ok(res.answer.includes('-৳12,000'));
    assert.ok(res.answer.includes('Monthly Burn Rate & Risk'));
  });

  // 6. Missing transaction history (Illustrative starter budget)
  it('6. Provides clearly labeled illustrative starter budget using ৳30,000 example when ledger is empty', async () => {
    const ctx = buildTestContext([], 0, '2026-10', 0);
    assert.equal(ctx.snapshot.monthlyIncome, 0);
    assert.equal(ctx.snapshot.monthlySpending, 0);

    const query = 'How should I allocate my monthly income across categories?';
    const intentRes = classifyIntent(query);
    assert.equal(intentRes.intent, 'budget_help');

    const res = generateDeterministicCoachResponse(intentRes, ctx, 'en', query, 'Nabila');
    assert.ok(res.dataGaps.includes('No transaction history recorded for budget planning'));
    assert.ok(res.answer.includes('50/30/20 Rule Illustrative Starter Budget'));
    assert.ok(res.answer.includes('example monthly income of ৳30,000'));
    assert.ok(res.answer.includes('50% Essential Needs (৳15,000)'));
    assert.ok(res.answer.includes('30% Discretionary Wants (৳9,000)'));
    assert.ok(res.answer.includes('20% Savings & Debt Cushion (৳6,000)'));
    assert.ok(res.answer.includes('illustrative starter template'));
  });

  // 7. Lowest expense category and highest expense category questions
  it('7. Accurately determines lowest and highest expense categories deterministically', async () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 2500, category: 'Health', date: '2026-10-02' }),
      createTx({ id: '3', type: 'expense', amount: 1200, category: 'Shopping', date: '2026-10-05' }),
      createTx({ id: '4', type: 'expense', amount: 500, category: 'Food & Dining', date: '2026-10-08' }),
    ];
    const ctx = buildTestContext(txs, 50000);
    assert.equal(ctx.spending.topCategory?.category, 'Health');
    assert.equal(ctx.spending.topCategory?.amount, 2500);
    assert.equal(ctx.spending.lowestCategory?.category, 'Food & Dining');
    assert.equal(ctx.spending.lowestCategory?.amount, 500);

    // Lowest category query
    const lowQuery = 'Which category I spend lowest money?';
    const lowIntent = classifyIntent(lowQuery);
    assert.equal(lowIntent.intent, 'lowest_category');
    const lowRes = generateDeterministicCoachResponse(lowIntent, ctx, 'en', lowQuery);
    assert.ok(lowRes.answer.includes('Food & Dining'));
    assert.ok(lowRes.answer.includes('500'));

    // Top category query
    const topQuery = 'What is my highest spending category?';
    const topIntent = classifyIntent(topQuery);
    assert.equal(topIntent.intent, 'top_category');
    const topRes = generateDeterministicCoachResponse(topIntent, ctx, 'en', topQuery);
    assert.ok(topRes.answer.includes('Health'));
    assert.ok(topRes.answer.includes('2,500'));
  });

  // 8. User-specific financial context isolation (no mock/cross-user data)
  it('8. Isolates financial data and personalized names across distinct user sessions', async () => {
    // User A: Salary ৳45,000, Spending ৳20,000
    const txsA: Transaction[] = [
      createTx({ id: 'a1', type: 'income', amount: 45000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: 'a2', type: 'expense', amount: 20000, category: 'Rent', date: '2026-10-05' }),
    ];
    const ctxA = buildTestContext(txsA, 45000);

    // User B: Salary ৳85,000, Spending ৳50,000
    const txsB: Transaction[] = [
      createTx({ id: 'b1', type: 'income', amount: 85000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: 'b2', type: 'expense', amount: 50000, category: 'Mortgage', date: '2026-10-05' }),
    ];
    const ctxB = buildTestContext(txsB, 85000);

    const query = 'Can you give me an overview?';
    const resA = generateDeterministicCoachResponse(classifyIntent(query), ctxA, 'en', query, 'Rahim Uddin');
    const resB = generateDeterministicCoachResponse(classifyIntent(query), ctxB, 'en', query, 'Karim Khan');

    // Verify User A has User A's greeting and figures, zero User B figures
    assert.ok(resA.answer.includes('Assalamu Alaikum Rahim!'));
    assert.ok(resA.answer.includes('20,000'));
    assert.ok(!resA.answer.includes('85,000'));
    assert.ok(!resA.answer.includes('Karim'));

    // Verify User B has User B's greeting and figures, zero User A figures
    assert.ok(resB.answer.includes('Assalamu Alaikum Karim!'));
    assert.ok(resB.answer.includes('50,000'));
    assert.ok(!resB.answer.includes('45,000'));
    assert.ok(!resB.answer.includes('Rahim'));
  });

  // 9. Number validator rejecting ungrounded or fabricated values
  it('9. Strictly rejects fabricated numbers while approving authentic derivations', () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 20000, category: 'Living', date: '2026-10-05' }),
    ];
    const ctx = buildTestContext(txs, 50000);

    // Hallucinated text with random figure 99999
    const hallucinatedText = 'You earned ৳50,000 and have an unexpected ৳99,999 in crypto investments.';
    const validationFail = validateCoachNumbers(hallucinatedText, ctx, [], 'budget_help', 'budget plan');
    assert.equal(validationFail.valid, false);
    assert.ok(validationFail.reason?.includes('99999'));

    // Legitimate text with valid numbers (50000, 20000, 30000, 25000 for 50% benchmark)
    const authenticText = 'Your income is ৳50,000 and expenses are ৳20,000, leaving net savings of ৳30,000. Your 50% essential benchmark is ৳25,000.';
    const validationPass = validateCoachNumbers(authenticText, ctx, [], 'budget_help', 'budget plan');
    assert.equal(validationPass.valid, true);
  });

  // 10. Dual-language support (English and Bengali parity)
  it('10. Delivers identical financial logic and structure across English and Bengali', () => {
    const txs: Transaction[] = [
      createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary', date: '2026-10-01' }),
      createTx({ id: '2', type: 'expense', amount: 30000, category: 'Living', date: '2026-10-05' }),
    ];
    const ctx = buildTestContext(txs, 50000);

    // English
    const resEn = generateDeterministicCoachResponse(
      { intent: 'spending_vs_income', confidence: 0.95, matchedKeywords: ['spending vs income'] },
      ctx,
      'en',
      'Am I spending more than I earn?',
      'Tanvir'
    );
    assert.ok(resEn.answer.includes('Direct Verdict: No, you are not spending more than you earn'));
    assert.ok(resEn.answer.includes('50,000'));
    assert.ok(resEn.answer.includes('30,000'));
    assert.ok(resEn.answer.includes('20,000'));

    // Bengali
    const resBn = generateDeterministicCoachResponse(
      { intent: 'spending_vs_income', confidence: 0.95, matchedKeywords: ['spending vs income'] },
      ctx,
      'bn',
      'আমি কি আয়ের চেয়ে বেশি খরচ করছি?',
      'তানভীর'
    );
    assert.ok(resBn.answer.includes('সরাসরি সিদ্ধান্ত: না, আপনি আয়ের চেয়ে বেশি খরচ করছেন না'));
    assert.ok(resBn.answer.includes('50,000') || resBn.answer.includes('৫০,০০০'));
    assert.ok(resBn.answer.includes('30,000') || resBn.answer.includes('৩০,০০০'));
    assert.ok(resBn.answer.includes('20,000') || resBn.answer.includes('২০,০০০'));
  });
});
