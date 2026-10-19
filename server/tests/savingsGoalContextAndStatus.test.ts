import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, sliceContext } from '../services/intentClassifier';
import { generateDeterministicCoachResponse } from '../services/coachFallbackEngine';
import { validateCoachNumbers, extractAllowedNumbers } from '../services/coachNumberValidator';
import { CoachContext } from '../services/coachContextBuilder';

function createMockContext(overrides?: Partial<CoachContext>): CoachContext {
  const base: CoachContext = {
    metadata: {
      today: '2026-10-19',
      dataWindow: {
        currentMonth: '2026-10',
        previousMonths: ['2026-09'],
        hasData: true,
        totalTransactions: 6,
        historicalMonthsCount: 2,
      },
    },
    snapshot: {
      available: true,
      currentBalance: 12500,
      monthlyIncome: 35000,
      monthlySpending: 22000,
      netSavings: 13000,
      savingsRate: 37.1,
      expenseRatio: 62.9,
      netCashFlow: 13000,
      isBalanceEstimated: false,
      hasRecordedIncome: true,
      hasRecordedExpenses: true,
      hasProfileIncome: false,
      facts: {},
    },
    spending: {
      available: true,
      totalSpending: 22000,
      topCategory: {
        category: 'Food & Dining',
        amount: 8000,
        percentage: 36.4,
        momChangePercentage: 0,
      },
      topCategories: [
        { category: 'Food & Dining', amount: 8000, percentage: 36.4, momChangePercentage: 0 },
        { category: 'Utilities', amount: 5000, percentage: 22.7, momChangePercentage: 0 },
        { category: 'Health', amount: 4000, percentage: 18.2, momChangePercentage: 0 },
      ],
      lowestCategory: {
        category: 'Health',
        amount: 4000,
        percentage: 18.2,
        momChangePercentage: 0,
      },
      zeroSpendingCategories: [],
      categoryTotals: {
        'Food & Dining': 8000,
        'Utilities': 5000,
        'Health': 4000,
      },
      categoryPercentages: {
        'Food & Dining': 36.4,
        'Utilities': 22.7,
        'Health': 18.2,
      },
      discretionaryTotal: 8000,
      essentialTotal: 14000,
      discretionaryPercentage: 36.4,
      essentialPercentage: 63.6,
      merchants: {
        highestMerchant: null,
        lowestMerchant: null,
        merchantTotals: {},
      },
      extrema: {
        largestExpense: null,
        smallestExpense: null,
      },
      comparison: {
        previousMonth: '2026-09',
        previousSpending: 20000,
        difference: 2000,
        percentageChange: 10,
        direction: 'higher',
      },
      anomalies: [],
      anomaliesCount: 0,
      facts: {},
    },
    goals: {
      available: true,
      totalGoals: 1,
      totalTargetAmount: 20000,
      totalSavedAmount: 0,
      totalRemainingAmount: 20000,
      items: [
        {
          id: 'goal-laptop-1',
          title: 'New Laptop',
          targetAmount: 20000,
          currentAmount: 0,
          progressPercentage: 0,
          remainingAmount: 20000,
          deadline: '2026-12-31',
          requiredMonthlyContribution: 6667,
          isOnTrack: false,
          scenarioSummary: 'Target: ৳20,000 by 2026-12-31',
        },
      ],
      facts: {},
    },
    cashFlow: {
      available: true,
      startingBalance: 12500,
      forecastMonthEndBalance: 25500,
      shortfall: 0,
      confidenceLevel: 'Medium',
      recommendedWeeklyReduction: 0,
      recommendedBuffer: 3000,
      upcomingBills: 0,
      safeSpendingLimitWeekly: 2375,
      safeSpendingLimitRemaining: 9500,
      uncommittedDiscretionaryPool: 9500,
      committedFunds: 3000,
      remainingDaysInMonth: 12,
      isBalanceEstimated: false,
      isForecastSufficient: true,
      forecastAssumptions: [],
      facts: {},
    },
    health: {
      score: 78,
      band: 'Good',
      percentile: 72,
      savingConsistency: 85,
      spendingControl: 75,
      cashFlowStability: 80,
      goalProgress: 0,
      available: true,
      confidence: 'Medium',
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

  return {
    ...base,
    ...overrides,
    snapshot: { ...base.snapshot, ...overrides?.snapshot },
    goals: overrides?.goals ? { ...base.goals, ...overrides.goals } : base.goals,
    spending: { ...base.spending, ...overrides?.spending },
  };
}

describe('Savings Goals Context & Financial Status Suite', () => {
  it('Case 1: "What\'s my financial status?" includes the active ৳20,000 savings goal target', () => {
    const query = "What's my financial status?";
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'financial_status');

    const ctx = createMockContext();
    const sliced = sliceContext(ctx, intentRes);

    // Context must retain goals facts
    assert.ok(sliced.facts['goals.goal1.title'], 'goals.goal1.title fact should be present');
    assert.strictEqual(sliced.facts['goals.goal1.targetAmount'], 20000);
    assert.strictEqual(sliced.facts['goals.goal1.currentAmount'], 0);
    assert.strictEqual(sliced.facts['goals.goal1.remainingAmount'], 20000);

    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);
    assert.ok(response.answer.includes('New Laptop'), 'Should mention the goal title');
    assert.ok(response.answer.includes('20,000'), 'Should mention the ৳20,000 target amount');
    assert.ok(response.answer.includes('Existing Savings Goals & Progress'), 'Should have savings goals section');
  });

  it('Case 2: Differentiates clearly between Target, Current Saved, Current Balance, and Net Monthly Surplus', () => {
    const query = 'How am I doing financially?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'financial_status');

    const ctx = createMockContext();
    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);

    // Target is ৳20,000
    assert.ok(response.answer.includes('Target ৳20,000') || response.answer.includes('৳20,000'), 'Target amount recognized');
    // Saved is ৳0
    assert.ok(response.answer.includes('Saved: ৳0') || response.answer.includes('0% with no contributions logged'), 'Saved amount recognized as 0');
    // Current Balance is ৳12,500
    assert.ok(response.answer.includes('Current Balance**: ৳12,500'), 'Current balance distinct');
    // Net Savings is ৳13,000
    assert.ok(response.answer.includes('Net Savings**: ৳13,000'), 'Net savings distinct');
  });

  it('Case 3: Honest progress representation when current amount is 0 (0% progress, no contributions logged)', () => {
    const query = 'How is my savings goal progressing?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'savings_goal_progress');

    const ctx = createMockContext();
    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);

    assert.ok(
      response.answer.includes('0%') || response.answer.includes('no contributions logged'),
      'Must honestly state 0% progress and no contributions logged'
    );
    // Must NOT state that the user has saved ৳20,000
    assert.ok(!response.answer.includes('Saved: ৳20,000'), 'Must not claim target is already saved');
  });

  it('Case 4: Correct math for Remaining Amount (Target - Current Saved)', () => {
    const query = 'How much more do I need to save?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'savings_goal_progress');

    // Test with partial progress: Target 20000, Saved 5000 -> Remaining 15000
    const ctx = createMockContext({
      goals: {
        available: true,
        totalGoals: 1,
        totalTargetAmount: 20000,
        totalSavedAmount: 5000,
        totalRemainingAmount: 15000,
        items: [
          {
            id: 'goal-laptop-1',
            title: 'New Laptop',
            targetAmount: 20000,
            currentAmount: 5000,
            progressPercentage: 25,
            remainingAmount: 15000,
            deadline: '2026-12-31',
            requiredMonthlyContribution: 5000,
            isOnTrack: true,
            scenarioSummary: 'Target: ৳20,000 by 2026-12-31',
          },
        ],
        facts: {},
      },
    });

    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);
    assert.ok(response.answer.includes('15,000'), 'Must cite remaining gap of ৳15,000');
    assert.ok(response.answer.includes('5,000'), 'Must cite current saved of ৳5,000');
    assert.ok(response.answer.includes('20,000'), 'Must cite target of ৳20,000');
  });

  it('Case 5: Handles multiple goals deterministically and lists all goals', () => {
    const query = 'What are my current savings goals?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'savings_goal_progress');

    const ctx = createMockContext({
      goals: {
        available: true,
        totalGoals: 2,
        totalTargetAmount: 50000,
        totalSavedAmount: 10000,
        totalRemainingAmount: 40000,
        items: [
          {
            id: 'goal-1',
            title: 'Emergency Fund',
            targetAmount: 30000,
            currentAmount: 10000,
            progressPercentage: 33.3,
            remainingAmount: 20000,
            deadline: '2027-01-31',
            requiredMonthlyContribution: 6667,
            isOnTrack: true,
            scenarioSummary: 'Emergency fund',
          },
          {
            id: 'goal-2',
            title: 'New Laptop',
            targetAmount: 20000,
            currentAmount: 0,
            progressPercentage: 0,
            remainingAmount: 20000,
            deadline: '2026-12-31',
            requiredMonthlyContribution: 6667,
            isOnTrack: false,
            scenarioSummary: 'Laptop fund',
          },
        ],
        facts: {},
      },
    });

    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);
    assert.ok(response.answer.includes('Emergency Fund'), 'Must list Emergency Fund');
    assert.ok(response.answer.includes('New Laptop'), 'Must list New Laptop');
    assert.ok(response.answer.includes('50,000'), 'Must show total target of ৳50,000');
    assert.ok(response.answer.includes('40,000'), 'Must show total remaining of ৳40,000');
  });

  it('Case 6: Handles zero active savings goals gracefully without hallucination', () => {
    const query = "What's my financial status?";
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'financial_status');

    const ctx = createMockContext({
      goals: {
        available: false,
        totalGoals: 0,
        totalTargetAmount: 0,
        totalSavedAmount: 0,
        totalRemainingAmount: 0,
        items: [],
        facts: {},
      },
    });

    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);
    assert.ok(
      response.answer.includes('No active savings goals currently recorded'),
      'Must state no active savings goals are recorded'
    );
    assert.ok(
      !response.answer.includes('Laptop') && !response.answer.includes('Emergency'),
      'Must not invent or hallucinate any goal names'
    );
  });

  it('Case 7: "Can I afford my savings goal?" evaluates surplus vs required monthly contribution', () => {
    const query = 'Can I afford my savings goal?';
    const intentRes = classifyIntent(query);
    assert.strictEqual(intentRes.intent, 'savings_goal_progress');

    // Surplus is ৳13,000/month, required is ৳6,667/month -> Feasible!
    const ctx = createMockContext();
    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', query);

    assert.ok(
      response.answer.includes('Yes, you can comfortably afford your savings goal target') ||
      response.answer.includes('comfortably afford'),
      'Should evaluate affordability positively when surplus exceeds required pace'
    );
    assert.ok(response.answer.includes('6,667'), 'Should report required monthly pace');
    assert.ok(response.answer.includes('13,000'), 'Should report net monthly cash flow surplus');
  });

  it('Case 8: Bengali queries ("আমার আর্থিক অবস্থা কেমন?", "আমার সঞ্চয় লক্ষ্য কেমন চলছে?") work fluently', () => {
    const q1 = 'আমার আর্থিক অবস্থা কেমন?';
    const res1 = classifyIntent(q1);
    assert.strictEqual(res1.intent, 'financial_status');

    const ctx = createMockContext();
    const resp1 = generateDeterministicCoachResponse(res1, ctx, 'bn', q1);
    assert.ok(resp1.answer.includes('আর্থিক অবস্থান ও ক্যাশ-ফ্লো'), 'Should contain BN financial position heading');
    assert.ok(resp1.answer.includes('সক্রিয় সঞ্চয় লক্ষ্য ও অগ্রগতি'), 'Should contain BN savings goals heading');
    assert.ok(resp1.answer.includes('New Laptop'), 'Should mention the goal title');
    assert.ok(resp1.answer.includes('২০,০০০') || resp1.answer.includes('20,000'), 'Should include target amount');

    const q2 = 'আমার সঞ্চয় লক্ষ্য কেমন চলছে?';
    const res2 = classifyIntent(q2);
    assert.strictEqual(res2.intent, 'savings_goal_progress');
    const resp2 = generateDeterministicCoachResponse(res2, ctx, 'bn', q2);
    assert.ok(resp2.answer.includes('অগ্রগতি'), 'Should contain BN progress wording');
    assert.ok(resp2.answer.includes('অবশিষ্ট ঘাটতি'), 'Should contain BN remaining gap wording');
  });

  it('Case 9: Number validator recognizes all goals metrics as allowed numbers', () => {
    const ctx = createMockContext();
    const allowed = extractAllowedNumbers(ctx);

    assert.ok(allowed.has(20000), '20000 (target & remaining) must be in allowed numbers');
    assert.ok(allowed.has(0), '0 (currentAmount) must be in allowed numbers');
    assert.ok(allowed.has(6667), '6667 (requiredMonthlyContribution) must be in allowed numbers');
    assert.ok(allowed.has(12500), '12500 (currentBalance) must be in allowed numbers');
    assert.ok(allowed.has(13000), '13000 (netSavings) must be in allowed numbers');

    // A response using these exact numbers must pass validation
    const testText = 'Target ৳20,000 | Saved: ৳0 | Remaining: ৳20,000 | Monthly Pace: ৳6,667 | Balance: ৳12,500';
    const valResult = validateCoachNumbers(testText, ctx);
    assert.strictEqual(valResult.valid, true, 'Valid response figures must pass number validation');
  });

  it('Case 10: Safe handling of missing optional goal fields (no deadline, no category)', () => {
    const ctx = createMockContext({
      goals: {
        available: true,
        totalGoals: 1,
        totalTargetAmount: 15000,
        totalSavedAmount: 3000,
        totalRemainingAmount: 12000,
        items: [
          {
            id: 'goal-minimal',
            title: 'General Savings',
            targetAmount: 15000,
            currentAmount: 3000,
            progressPercentage: 20,
            remainingAmount: 12000,
            deadline: '',
            requiredMonthlyContribution: 2000,
            isOnTrack: false,
            scenarioSummary: '',
          },
        ],
        facts: {},
      },
    });

    const intentRes = classifyIntent("What's my financial status?");
    const response = generateDeterministicCoachResponse(intentRes, ctx, 'en', "What's my financial status?");

    assert.ok(response.answer.includes('General Savings'), 'Must handle minimal goal without error');
    assert.ok(response.answer.includes('15,000'), 'Target amount shown');
    assert.ok(response.answer.includes('3,000'), 'Saved amount shown');
    assert.ok(response.answer.includes('12,000'), 'Remaining amount shown');
  });
});
