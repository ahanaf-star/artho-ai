import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyIntent } from '../services/intentClassifier';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { CoachContext } from '../services/coachContextBuilder';
import { Transaction } from '../../src/types/financial';
import { calculateMonthlyOverview, calculateFactualAnalysis } from '../../src/services/financialCalculations';
import { validateCoachNumbers } from '../services/coachNumberValidator';
import { generateDeterministicCoachResponse } from '../services/coachFallbackEngine';

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

function createLiveUserContext(
  extraTransactions: Transaction[] = [],
  historicalMonthsCount: number = 1
): CoachContext {
  const baseTxs: Transaction[] = [
    createTx({
      id: 'tx-1',
      type: 'income',
      amount: 250000,
      category: 'Salary',
      merchant: 'Employer Inc',
      date: '2026-10-01',
      classification: 'essential',
    }),
    createTx({
      id: 'tx-1792232297959',
      type: 'expense',
      amount: 170000,
      category: 'Heath',
      merchant: 'Patient',
      date: '2026-10-17',
      classification: 'essential',
    }),
    createTx({
      id: 'tx-3',
      type: 'expense',
      amount: 1994,
      category: 'Heath',
      merchant: 'Pharmacy',
      date: '2026-10-17',
      classification: 'essential',
    }),
    createTx({
      id: 'tx-4',
      type: 'expense',
      amount: 550,
      category: 'Electricity',
      merchant: 'DESCO',
      date: '2026-10-17',
      classification: 'essential',
    }),
    createTx({
      id: 'tx-5',
      type: 'expense',
      amount: 6999,
      category: 'Education',
      merchant: 'School',
      date: '2026-10-17',
      classification: 'essential',
    }),
  ];

  const allTxs = [...baseTxs, ...extraTransactions];
  const activeMonth = '2026-10';
  const overview = calculateMonthlyOverview(allTxs, activeMonth);
  const factual = calculateFactualAnalysis(allTxs, activeMonth);

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
      norm.includes('utilit') ||
      norm.includes('electric')
    );
  };

  const discretionaryCatMap: Record<string, number> = {};
  const essentialCatMap: Record<string, number> = {};

  for (const t of allTxs) {
    if (t.date && t.date.startsWith(activeMonth) && t.type === 'expense') {
      const isEss = t.classification === 'essential' || isEssentialCat(t.category);
      if (!isEss) {
        discretionaryCatMap[t.category] = (discretionaryCatMap[t.category] || 0) + t.amount;
      } else {
        essentialCatMap[t.category] = (essentialCatMap[t.category] || 0) + t.amount;
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

  const essentialCategories = Object.entries(essentialCatMap)
    .filter(([_, amt]) => amt > 0)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: monthlySpending > 0 ? Number(((amt / monthlySpending) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const discretionaryTotal = discretionaryCategories.reduce((s, c) => s + c.amount, 0);
  const essentialTotal = essentialCategories.reduce((s, c) => s + c.amount, 0);
  const essentialPercentage = monthlySpending > 0 ? Number(((essentialTotal / monthlySpending) * 100).toFixed(1)) : 0;
  const discretionaryPercentage = monthlySpending > 0 ? Number(((discretionaryTotal / monthlySpending) * 100).toFixed(1)) : 0;

  const lowestCategorySummary = factual.lowestCategory
    ? overview.categories.find((c) => c.category.toLowerCase() === factual.lowestCategory!.category.toLowerCase())
    : null;

  const topCategorySummary = factual.highestCategory
    ? overview.categories.find((c) => c.category.toLowerCase() === factual.highestCategory!.category.toLowerCase())
    : null;

  return {
    metadata: {
      today: '2026-10-17',
      dataWindow: {
        currentMonth: activeMonth,
        previousMonths: historicalMonthsCount > 1 ? ['2026-09'] : [],
        hasData: true,
        totalTransactions: allTxs.length,
        historicalMonthsCount,
      },
    },
    snapshot: {
      available: true,
      monthlyIncome,
      monthlySpending,
      netSavings,
      netCashFlow,
      savingsRate,
      expenseRatio,
      currentBalance: 50000,
      profileMonthlyIncome: 250000,
      hasRecordedIncome: true,
      hasRecordedExpenses: true,
      hasProfileIncome: true,
      facts: {},
    },
    spending: {
      available: true,
      totalSpending: monthlySpending,
      topCategory: factual.highestCategory
        ? {
            category: factual.highestCategory.category,
            amount: factual.highestCategory.amount,
            percentage: factual.highestCategory.percentage,
            momChangePercentage: topCategorySummary?.momChangePercentage || 0,
            hasMomComparison: Boolean(topCategorySummary?.hasMomComparison),
            isTie: factual.highestCategory.isTie,
            tiedCategories: factual.highestCategory.tiedCategories,
          }
        : null,
      lowestCategory: factual.lowestCategory
        ? {
            category: factual.lowestCategory.category,
            amount: factual.lowestCategory.amount,
            percentage: factual.lowestCategory.percentage,
            momChangePercentage: lowestCategorySummary?.momChangePercentage || 0,
            hasMomComparison: Boolean(lowestCategorySummary?.hasMomComparison),
            isTie: factual.lowestCategory.isTie,
            tiedCategories: factual.lowestCategory.tiedCategories,
          }
        : null,
      zeroSpendingCategories: factual.zeroSpendingCategories,
      discretionaryCategories,
      discretionaryTotal,
      essentialCategories,
      essentialTotal,
      essentialPercentage,
      discretionaryPercentage,
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
    cashFlow: {
      available: true,
      startingBalance: 50000,
      forecastMonthEndBalance: 120457,
      shortfall: 0,
      confidenceLevel: 'High',
      recommendedWeeklyReduction: 0,
      recommendedBuffer: 30000,
      facts: {},
    },
    goals: {
      available: true,
      totalGoals: 0,
      items: [],
      facts: {},
    },
    health: {
      available: true,
      score: 78,
      band: 'Good',
      percentile: 74,
      confidence: 'High',
      savingConsistency: 80,
      spendingControl: 75,
      cashFlowStability: 85,
      goalProgress: 72,
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
    recentTransactions: baseTxs.slice(0, 3).map((t) => ({
      type: t.type,
      amount: t.amount,
      category: t.category,
      date: t.date,
    })),
  };
}

async function askCoach(query: string, ctx: CoachContext, language: 'en' | 'bn' = 'en') {
  const intentResult = classifyIntent(query);
  return executeCoachInquiry({
    userId: 'usr-1792231957345-1cjx',
    query,
    language,
    fullContext: ctx,
    intentResult,
    aiClient: null,
  });
}

describe('AI Coach Live Testing Regression Suite (Issues 1 to 5 & Benchmark Validation)', () => {
  // =========================================================================
  // ISSUE 1: Lowest Spending Category & MoM Comparison Verification
  // =========================================================================
  describe('Issue 1: Lowest Spending Category MoM Comparison', () => {
    it('1.1: Omits MoM change when prior-month category record does NOT exist (no fake +11%)', async () => {
      const ctx = createLiveUserContext([], 1);
      assert.strictEqual(ctx.spending.lowestCategory?.category, 'Electricity');
      assert.strictEqual(ctx.spending.lowestCategory?.amount, 550);
      assert.strictEqual(ctx.spending.lowestCategory?.hasMomComparison, false);

      const res = await askCoach('What is my lowest spending category?', ctx, 'en');

      assert.ok(res.answer.includes('Electricity'), 'Must cite Electricity');
      assert.ok(res.answer.includes('550'), 'Must cite ৳550');
      assert.ok(!res.answer.includes('+11%'), 'Must NOT fabricate +11% MoM change');
      assert.ok(!res.answer.includes('compared to last month'), 'Must NOT claim comparison to last month when no prior record exists');
    });

    it('1.2: Accurately calculates and reports MoM change when genuine prior-month data exists', async () => {
      // Add a September transaction for Electricity of ৳500
      const septTx = createTx({
        id: 'tx-sept-elec',
        type: 'expense',
        amount: 500,
        category: 'Electricity',
        date: '2026-09-15',
        classification: 'essential',
      });
      const ctx = createLiveUserContext([septTx], 2);
      assert.strictEqual(ctx.spending.lowestCategory?.hasMomComparison, true);

      const res = await askCoach('What is my lowest spending category?', ctx, 'en');

      assert.ok(res.answer.includes('Electricity'));
      assert.ok(res.answer.includes('550'));
      assert.ok(res.answer.includes('10%') || res.answer.includes('+10%'), 'Must reflect real +10% MoM increase (from ৳500 to ৳550)');
    });

    it('1.3: financialCalculations does NOT fabricate entry.amount * 0.9 for missing categories', () => {
      const txs: Transaction[] = [
        createTx({
          id: 'tx-1',
          type: 'expense',
          amount: 550,
          category: 'Electricity',
          date: '2026-10-17',
        }),
      ];
      const overview = calculateMonthlyOverview(txs, '2026-10');
      const elecSummary = overview.categories.find((c) => c.category === 'Electricity');
      assert.ok(elecSummary);
      assert.strictEqual(elecSummary?.hasMomComparison, false);
      assert.strictEqual(elecSummary?.momChangePercentage, 0);
    });
  });

  // =========================================================================
  // ISSUE 2: Monthly Budget Advice
  // =========================================================================
  describe('Issue 2: Monthly Budget Advice & Healthcare Protection', () => {
    it('2.1: Protects essential healthcare spending (Heath: ৳171,994) and does NOT suggest cutting it', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach('Can you give me a realistic monthly budget based on my spending?', ctx, 'en');

      assert.ok(!res.answer.toLowerCase().includes('cut heath'), 'Must never suggest cutting Heath');
      assert.ok(!res.answer.toLowerCase().includes('trim heath'), 'Must never suggest trimming Heath');
      assert.ok(!res.answer.toLowerCase().includes('reduce heath'), 'Must never suggest reducing Heath');
      assert.ok(res.answer.includes('Essential & Committed Obligations') || res.answer.includes('essential'), 'Must categorize obligations as essential');
    });

    it('2.2: Reports ৳0 discretionary spending when no discretionary transactions exist (no fabricated outings)', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach('Can you give me a realistic monthly budget based on my spending?', ctx, 'en');

      assert.ok(!res.answer.includes('29,916'), 'Must NOT hallucinate ৳29,916/week trim');
      assert.ok(!res.answer.includes('outings and deliveries'), 'Must NOT invent discretionary outings and deliveries when 0 exist');
      assert.ok(res.answer.includes('৳0 recorded') || res.answer.includes('No discretionary spending'), 'Must acknowledge ৳0 discretionary spending');
    });

    it('2.3: Provides a realistic proposed budget separating essential commitments, discretionary allowance, and savings allocation', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach('Can you give me a realistic monthly budget based on my spending?', ctx, 'en');

      // Verify essential commitments (৳179,543 / 71.8%)
      assert.ok(res.answer.includes('179,543'), 'Must cite ৳179,543 essential commitments');
      // Verify savings allocation (৳70,457)
      assert.ok(res.answer.includes('70,457'), 'Must cite ৳70,457 savings allocation');
      assert.ok(res.answer.includes('Pay Yourself First') || res.answer.includes('savings allocation'), 'Must suggest Pay Yourself First or savings allocation');
      // Verify assumptions & limitations noted
      assert.ok(res.answer.includes('Assumptions') || res.answer.includes('Limitations') || res.answer.includes('Caveats'), 'Must state budget assumptions or caveats');
    });

    it('2.4: Targets only actual discretionary categories when discretionary spending exists', async () => {
      const discTx1 = createTx({
        id: 'tx-disc-1',
        type: 'expense',
        amount: 4000,
        category: 'Dining Out',
        date: '2026-10-10',
        classification: 'discretionary',
      });
      const discTx2 = createTx({
        id: 'tx-disc-2',
        type: 'expense',
        amount: 2000,
        category: 'Entertainment',
        date: '2026-10-12',
        classification: 'discretionary',
      });

      const ctx = createLiveUserContext([discTx1, discTx2], 1);
      const res = await askCoach('Can you give me a realistic monthly budget?', ctx, 'en');

      assert.ok(res.answer.includes('Dining Out'), 'Must cite actual Dining Out category');
      assert.ok(res.answer.includes('Entertainment'), 'Must cite actual Entertainment category');
      assert.ok(!res.answer.toLowerCase().includes('cut heath'), 'Must still protect essential healthcare');
    });
  });

  // =========================================================================
  // ISSUE 3: Largest Individual Expense Verification
  // =========================================================================
  describe('Issue 3: Largest Individual Expense Field Verification', () => {
    it('3.1: Identifies ৳170,000 in Heath on 2026-10-17 with merchant Patient', async () => {
      const ctx = createLiveUserContext([], 1);
      assert.strictEqual(ctx.spending.extrema?.largestExpense?.amount, 170000);
      assert.strictEqual(ctx.spending.extrema?.largestExpense?.category, 'Heath');
      assert.strictEqual(ctx.spending.extrema?.largestExpense?.merchant, 'Patient');
      assert.strictEqual(ctx.spending.extrema?.largestExpense?.date, '2026-10-17');

      const res = await askCoach('What was my largest individual expense?', ctx, 'en');

      assert.ok(res.answer.includes('170,000'), 'Must cite ৳170,000');
      assert.ok(res.answer.includes('Heath'), 'Must cite Heath');
      assert.ok(res.answer.includes('Patient'), 'Must cite merchant Patient');
      assert.ok(res.answer.includes('2026-10-17'), 'Must cite date 2026-10-17');
    });

    it('3.2: Works accurately in Bengali language', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach('আমার একক সর্বোচ্চ খরচ কত ছিল?', ctx, 'bn');

      assert.ok(res.answer.includes('170,000') || res.answer.includes('১৭০,০০০'), 'Must cite 170,000 in Bengali answer');
      assert.ok(res.answer.includes('Heath'), 'Must cite Heath');
      assert.ok(res.answer.includes('Patient'), 'Must cite Patient');
    });
  });

  // =========================================================================
  // ISSUE 4: Six-Month Financial Projection
  // =========================================================================
  describe('Issue 4: Six-Month Financial Projection', () => {
    it('4.1: Correctly classifies 6-month projection query intent', () => {
      const query = 'Can you accurately predict my financial position for the next six months based on my current data?';
      const classified = classifyIntent(query);
      assert.strictEqual(classified.intent, 'financial_projection');
    });

    it('4.2: Handles insufficient data (<3 months) with limitation warning & illustrative scenario', async () => {
      const ctx = createLiveUserContext([], 1); // 1 month of history
      const res = await askCoach(
        'Can you accurately predict my financial position for the next six months based on my current data?',
        ctx,
        'en'
      );

      // Limitation disclaimer
      assert.ok(
        res.answer.includes('Data Sufficiency & Limitation') ||
        res.answer.includes('at least 3 months') ||
        res.answer.includes('guaranteed forecast'),
        'Must include explicit data limitation disclaimer for <3 months'
      );

      // Illustrative scenario: 6 * 250,000 = 1,500,000
      assert.ok(res.answer.includes('1,500,000'), 'Must calculate 6-month projected income: ৳1,500,000');
      // 6 * 179,543 = 1,077,258
      assert.ok(res.answer.includes('1,077,258'), 'Must calculate 6-month projected outflow: ৳1,077,258');
      // 6 * 70,457 = 422,742
      assert.ok(res.answer.includes('422,742'), 'Must calculate 6-month projected net surplus: ৳422,742');

      // Notes episodic medical caveat for Heath
      assert.ok(
        res.answer.includes('Heath') || res.answer.includes('medical'),
        'Must note that Heath spending may be a one-time medical expense'
      );
    });

    it('4.3: Produces forecast without limitation warning when >= 3 months of history exist', async () => {
      const ctx = createLiveUserContext([], 4); // 4 months of history
      const res = await askCoach(
        'Can you accurately predict my financial position for the next six months based on my current data?',
        ctx,
        'en'
      );

      assert.ok(res.answer.includes('Based on your verified multi-month historical transaction records'), 'Must use multi-month forecast');
      assert.ok(!res.answer.includes('cannot be presented as a guaranteed forecast'), 'Should not treat as insufficient data');
      assert.ok(res.answer.includes('1,500,000'));
      assert.ok(res.answer.includes('1,077,258'));
      assert.ok(res.answer.includes('422,742'));
    });

    it('4.4: Handles 6-month projection query in Bengali with data limitation warning', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach(
        'আগামী ৬ মাসের জন্য আমার আর্থিক অবস্থা কেমন হতে পারে?',
        ctx,
        'bn'
      );

      assert.ok(res.answer.includes('১,৫০০,০০০') || res.answer.includes('1,500,000'), 'Must include 6-month projected income');
      assert.ok(res.answer.includes('১,০৭৭,২৫৮') || res.answer.includes('1,077,258'), 'Must include 6-month projected expense');
      assert.ok(res.answer.includes('৪২২,৭৪২') || res.answer.includes('422,742'), 'Must include 6-month projected surplus');
      assert.ok(res.answer.includes('৩ মাসের') || res.answer.includes('সীমাবদ্ধতা'), 'Must mention data limitation in Bengali');
    });
  });

  // =========================================================================
  // ISSUE 5: Personalized Financial Recommendations
  // =========================================================================
  describe('Issue 5: Personalized Financial Recommendations', () => {
    it('5.1: Classifies actionable health recommendation queries as health_recommendations', () => {
      const query = 'what are the three most useful actions I should take to improve my financial health?';
      const classified = classifyIntent(query);
      assert.strictEqual(classified.intent, 'health_recommendations');
    });

    it('5.2: Returns exactly three prioritized, numbered recommendations grounded in real user records', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach(
        'what are the three most useful actions I should take to improve my financial health?',
        ctx,
        'en'
      );

      // Must have exactly three numbered items
      assert.ok(res.answer.includes('1. **Build a Dedicated Emergency Healthcare Reserve**') || res.answer.includes('1.'), 'Must include item 1');
      assert.ok(res.answer.includes('2. **Automate "Pay Yourself First"') || res.answer.includes('2.'), 'Must include item 2');
      assert.ok(res.answer.includes('3. **Track Discretionary Spending') || res.answer.includes('3.'), 'Must include item 3');
      assert.ok(!res.answer.includes('4.'), 'Must NOT exceed three recommendations');

      // Action 1 grounds in Heath
      assert.ok(res.answer.includes('Heath') || res.answer.includes('171,994'), 'Action 1 must cite Heath data');
      // Action 2 grounds in monthly surplus
      assert.ok(res.answer.includes('70,457'), 'Action 2 must cite verified monthly surplus of ৳70,457');
      // Action 3 grounds in 100% essential spending
      assert.ok(res.answer.includes('179,543'), 'Action 3 must cite total spending of ৳179,543');
    });

    it('5.3: Recommendations protect essential healthcare and provide clear financial rationales', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach(
        'what are the three most useful actions I should take to improve my financial health?',
        ctx,
        'en'
      );

      assert.ok(res.answer.includes('Financial Rationale'), 'Must provide financial rationale for each action');
      assert.ok(!res.answer.toLowerCase().includes('cut heath'), 'Must never suggest cutting essential healthcare');
    });

    it('5.4: Works seamlessly in Bengali', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach(
        'আমার আর্থিক স্বাস্থ্য উন্নত করতে কোন ৩টি পদক্ষেপ নেওয়া উচিত?',
        ctx,
        'bn'
      );

      assert.ok(res.answer.includes('১.') && res.answer.includes('২.') && res.answer.includes('৩.'), 'Must contain 3 numbered points in Bengali');
      assert.ok(res.answer.includes('তহবিল') || res.answer.includes('চিকিৎসা'), 'Must mention emergency medical reserve');
      assert.ok(res.answer.includes('Pay Yourself First') || res.answer.includes('আয়ের শুরুতেই সঞ্চয়'), 'Must mention Pay Yourself First');
    });
  });

  // =========================================================================
  // BENCHMARK CLAIM VALIDATION: Removal of Fake Peer Percentiles
  // =========================================================================
  describe('Benchmark Validation: Removal of Unsupported Dhaka Peer Percentiles', () => {
    it('6.1: Financial health score response does NOT claim outperforming peers in Dhaka', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach('What is my financial health score?', ctx, 'en');

      assert.ok(!res.answer.includes('peers in Dhaka'), 'Must NOT claim comparison to peers in Dhaka');
      assert.ok(!res.answer.includes('digital wallets'), 'Must NOT mention digital wallet peer benchmark');
      assert.ok(!res.answer.includes('outperforming 53%'), 'Must NOT include unverified peer percentage');

      // Genuine score and pillars preserved
      assert.ok(res.answer.includes('78 / 100'), 'Must preserve authentic score 78/100');
      assert.ok(res.answer.includes('Good'), 'Must preserve authentic band Good');
      assert.ok(res.answer.includes('Saving Consistency: 80%'), 'Must preserve diagnostic pillars');
    });

    it('6.2: Bengali health score response does NOT claim peer comparisons', async () => {
      const ctx = createLiveUserContext([], 1);
      const res = await askCoach('আমার ফাইন্যান্সিয়াল হেলথ স্কোর কত?', ctx, 'bn');

      assert.ok(!res.answer.includes('ঢাকার') && !res.answer.includes('সহকর্মীদের'), 'Must not claim Dhaka peer benchmark in Bengali');
      assert.ok(res.answer.includes('৭৮') || res.answer.includes('78'), 'Must preserve score in Bengali');
    });
  });

  // =========================================================================
  // NUMBER VALIDATOR & DETERMINISTIC INTEGRITY
  // =========================================================================
  describe('Number Validator & Projection Allowlist', () => {
    it('7.1: Number validator allows valid 6-month projected figures', () => {
      const ctx = createLiveUserContext([], 1);
      const validProjectionAnswer =
        'Your 6-month projected income is ৳1,500,000, projected expenses are ৳1,077,258, and projected savings are ৳422,742.';

      const result = validateCoachNumbers(validProjectionAnswer, ctx);
      assert.strictEqual(result.valid, true, `Validation failed with unverified numbers: ${result.unrecognizedNumbers?.join(', ')}`);
    });

    it('7.2: Number validator rejects arbitrary hallucinated numbers', () => {
      const ctx = createLiveUserContext([], 1);
      const fakeAnswer = 'You will save ৳999,888 and reduce your expenses by ৳33,444 next month.';
      const result = validateCoachNumbers(fakeAnswer, ctx);
      assert.strictEqual(result.valid, false, 'Should reject ungrounded figures');
      assert.ok(result.unrecognizedNumbers?.includes(999888));
      assert.ok(result.unrecognizedNumbers?.includes(33444));
    });

    it('7.3: Fallback engine produces deterministic output when aiClient is null', () => {
      const ctx = createLiveUserContext([], 1);
      const intents: Array<{ query: string; expectedSubstring: string }> = [
        { query: 'What is my lowest spending category?', expectedSubstring: 'Electricity' },
        { query: 'Can you give me a realistic monthly budget?', expectedSubstring: '179,543' },
        { query: 'What was my largest individual expense?', expectedSubstring: '170,000' },
        { query: 'Can you accurately predict my financial position for the next six months?', expectedSubstring: '1,500,000' },
        { query: 'what are the three most useful actions I should take to improve my financial health?', expectedSubstring: 'Emergency Healthcare Reserve' },
      ];

      for (const item of intents) {
        const classified = classifyIntent(item.query);
        const fb = generateDeterministicCoachResponse(classified, ctx, 'en');
        assert.ok(fb.answer.includes(item.expectedSubstring), `Fallback for "${item.query}" must include "${item.expectedSubstring}"`);
        assert.strictEqual(fb.source, 'fallback');
      }
    });
  });
});
