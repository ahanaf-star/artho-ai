import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyIntent, parseSavingsTarget } from '../services/intentClassifier';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { buildCoachContextFromData, CoachContext } from '../services/coachContextBuilder';
import { Transaction, SavingsGoal } from '../../src/types/financial';

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

function createMockContext(params: {
  transactions: Transaction[];
  goals?: SavingsGoal[];
  profileMonthlyIncome?: number;
  profileMonthlyIncomeCurrency?: string;
  activeMonth?: string;
}): CoachContext {
  const activeMonth = params.activeMonth || '2026-10';
  const transactions = params.transactions || [];
  const goals = params.goals || [];
  const user = {
    monthlyIncome: params.profileMonthlyIncome,
    monthlyIncomeCurrency: params.profileMonthlyIncomeCurrency,
    linkedAccounts: [],
  };
  return buildCoachContextFromData(transactions, goals, user, { targetMonth: activeMonth, today: `${activeMonth}-18` });
}

describe('Income Intent Handling & Baseline Reasoning Regression Suite', () => {
  // 1. Baseline ৳1,000,000 with no income transactions
  it('Scenario 1: Baseline ৳1,000,000 with no income transactions', async () => {
    const query = 'Analyze my income';
    const ctx = createMockContext({
      transactions: [
        createTx({ id: '1', type: 'expense', amount: 0, category: 'Living Costs', date: '2026-10-01' }),
      ],
      profileMonthlyIncome: 1000000,
      profileMonthlyIncomeCurrency: 'BDT',
    });

    const intentResult = classifyIntent(query);
    assert.strictEqual(intentResult.intent, 'income_total', 'Query must classify as income_total');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('1,000,000'), 'Must cite expected monthly baseline of ৳1,000,000');
    assert.ok(res.answer.includes('baseline') || res.answer.includes('benchmark'), 'Must describe baseline as expected/benchmark');
    assert.ok(res.answer.includes('no actual income transactions have been logged') || res.answer.includes('Recorded Inflows (October 2026): ৳0'), 'Must clarify no income logged');
    assert.ok(!res.answer.includes('৳1/month'), 'Must NEVER manufacture a ৳1/month savings target');
    assert.ok(!res.answer.includes('0/week'), 'Must NEVER manufacture a ৳0/week savings target');
  });

  // 2. Baseline with recorded income
  it('Scenario 2: Baseline with recorded income', async () => {
    const query = 'Analyze my income';
    const ctx = createMockContext({
      transactions: [
        createTx({ id: '1', type: 'income', amount: 60000, category: 'Salary & Professional', date: '2026-10-05' }),
        createTx({ id: '2', type: 'expense', amount: 20000, category: 'Food & Groceries', date: '2026-10-08' }),
      ],
      profileMonthlyIncome: 1000000,
      profileMonthlyIncomeCurrency: 'BDT',
    });

    const intentResult = classifyIntent(query);
    assert.strictEqual(intentResult.intent, 'income_total');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('60,000'), 'Must cite recorded income of ৳60,000');
    assert.ok(res.answer.includes('1,000,000'), 'Must cite profile baseline of ৳1,000,000');
    assert.ok(res.answer.includes('20,000'), 'Must cite recorded expenses of ৳20,000');
    assert.ok(res.answer.includes('40,000'), 'Must cite net cash surplus of ৳40,000');
    assert.ok(!res.answer.includes('৳1/month'), 'Must not invent savings target');
  });

  // 3. No active savings goals
  it('Scenario 3: No active savings goals', async () => {
    const query = 'How are my savings goals progressing?';
    const ctx = createMockContext({
      transactions: [],
      goals: [],
    });

    const intentResult = classifyIntent(query);
    assert.strictEqual(intentResult.intent, 'savings_goal_progress');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('do not have any active savings goals'), 'Must state no active savings goals set');
    assert.ok(!res.answer.includes('৳1/month'), 'Must never manufacture a ৳1 goal');
  });

  // 4. No explicitly requested savings target
  it('Scenario 4: No explicitly requested savings target', async () => {
    const query = 'How can I save more?';
    const ctx = createMockContext({
      transactions: [
        createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
        createTx({ id: '2', type: 'expense', amount: 20000, category: 'Food & Groceries', date: '2026-10-05' }),
      ],
      goals: [],
      profileMonthlyIncome: 50000,
    });

    const intentResult = classifyIntent(query);
    assert.strictEqual(intentResult.intent, 'savings_plan');
    assert.strictEqual(intentResult.parsedPlan, undefined, 'Must not parse a savings target when none was specified');

    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('do not have any active savings goals recorded'), 'Must state no active savings goals recorded');
    assert.ok(res.answer.includes('30,000'), 'Must mention existing monthly surplus of ৳30,000');
    assert.ok(!res.answer.includes('৳1/month'), 'Must NEVER manufacture a ৳1/month target');
    assert.ok(!res.answer.includes('0/week'), 'Must NEVER manufacture a ৳0/week target');
  });

  // 5. A genuine saved savings goal
  it('Scenario 5: A genuine saved savings goal', async () => {
    const query = 'How can I save more?';
    const ctx = createMockContext({
      transactions: [
        createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
      ],
      goals: [
        {
          id: 'goal-emergency',
          title: 'Emergency Fund',
          targetAmount: 60000,
          currentAmount: 15000,
          deadline: '2026-12-31',
          monthlyPace: 15000,
          accountVault: 'General Savings',
          status: 'On Track',
          category: 'Emergency',
          color: '#10B981',
          icon: '🛡️',
        },
      ],
    });

    const intentResult = classifyIntent(query);
    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('Emergency Fund'), 'Must reference active goal Emergency Fund');
    assert.ok(res.answer.includes('60,000'), 'Must cite target amount ৳60,000');
    assert.ok(res.answer.includes('15,000'), 'Must cite current amount ৳15,000');
    assert.ok(!res.answer.includes('৳1/month'), 'Must not manufacture ৳1 target');
  });

  // 6. Income-analysis questions
  it('Scenario 6: Income-analysis questions', () => {
    const incomeQueries = [
      'Analyze my income',
      'Income analysis',
      'Review my income',
      'What is my income?',
      'How is my income this month?',
      'Check my income',
      'My income overview',
      'আমার আয় বিশ্লেষণ কর',
      'আমার আয়ের হিসাব দাও',
    ];

    for (const q of incomeQueries) {
      const parsed = parseSavingsTarget(q, 0);
      assert.strictEqual(parsed, undefined, `Query "${q}" must not parse as a savings plan target`);

      const res = classifyIntent(q);
      assert.strictEqual(res.intent, 'income_total', `Query "${q}" must classify as income_total, got: ${res.intent}`);
    }
  });

  // 7. Explicit savings-plan requests
  it('Scenario 7: Explicit savings-plan requests', () => {
    const plan1 = parseSavingsTarget('How can I save 6000 tk per month?', 10000);
    assert.ok(plan1, 'Must parse plan 1');
    assert.strictEqual(plan1.targetAmount, 6000);
    assert.strictEqual(plan1.monthlyTarget, 6000);
    assert.strictEqual(plan1.weeklyTarget, 1500);

    const plan2 = parseSavingsTarget('Can I save 1 lac per month?', 50000);
    assert.ok(plan2, 'Must parse 1 lac per month');
    assert.strictEqual(plan2.targetAmount, 100000, '1 lac must equal 100,000 BDT, not 1');
    assert.strictEqual(plan2.monthlyTarget, 100000);
    assert.strictEqual(plan2.weeklyTarget, 25000);

    const plan3 = parseSavingsTarget('Save ৳30,000 in 6 months', 20000);
    assert.ok(plan3, 'Must parse fixed duration plan');
    assert.strictEqual(plan3.targetAmount, 30000);
    assert.strictEqual(plan3.monthsDuration, 6);
    assert.strictEqual(plan3.monthlyTarget, 5000);
    assert.strictEqual(plan3.weeklyTarget, 1250);

    const plan4 = parseSavingsTarget('আমি প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব?', 5000);
    assert.ok(plan4, 'Must parse Bengali recurring plan');
    assert.strictEqual(plan4.targetAmount, 6000);
    assert.strictEqual(plan4.monthlyTarget, 6000);
    assert.strictEqual(plan4.weeklyTarget, 1500);
  });

  // 8. Zero transaction values
  it('Scenario 8: Zero transaction values', async () => {
    const ctx = createMockContext({
      transactions: [],
      profileMonthlyIncome: 0,
    });

    const query = 'Analyze my income';
    const intentResult = classifyIntent(query);
    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(!res.answer.includes('NaN'), 'Answer must not contain NaN');
    assert.ok(!res.answer.includes('null'), 'Answer must not contain null');
    assert.ok(res.answer.includes('No income transactions have been recorded'), 'Must state no income recorded');
  });

  // 9. Currency mismatch
  it('Scenario 9: Currency mismatch', async () => {
    const query = 'Analyze my income';
    const ctx = createMockContext({
      transactions: [
        createTx({ id: '1', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-02' }),
      ],
      profileMonthlyIncome: 1000,
      profileMonthlyIncomeCurrency: 'USD',
    });

    const intentResult = classifyIntent(query);
    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('$1,000'), 'Must cite baseline with $ currency symbol');
    assert.ok(res.answer.includes('50,000'), 'Must cite recorded income in BDT');
    assert.ok(res.answer.includes('USD') || res.answer.includes('native currency'), 'Must note currency difference without inventing FX rate');
  });

  // 10. Monthly date-range filtering
  it('Scenario 10: Monthly date-range filtering', async () => {
    const septTx = createTx({ id: '1', type: 'income', amount: 80000, category: 'Salary & Professional', date: '2026-09-15' });
    const octTx = createTx({ id: '2', type: 'expense', amount: 5000, category: 'Living Costs', date: '2026-10-05' });

    // Active month is October 2026
    const ctx = createMockContext({
      transactions: [septTx, octTx],
      profileMonthlyIncome: 1000000,
      activeMonth: '2026-10',
    });

    assert.strictEqual(ctx.snapshot.monthlyIncome, 0, 'October 2026 income must be 0; September income must not bleed over');
    assert.strictEqual(ctx.snapshot.monthlySpending, 5000, 'October 2026 spending must be 5000');

    const query = 'Analyze my income';
    const intentResult = classifyIntent(query);
    const res = await executeCoachInquiry({
      userId: 'test-user',
      query,
      language: 'en',
      fullContext: ctx,
      intentResult,
      aiClient: null,
    });

    assert.ok(res.answer.includes('Recorded Inflows (October 2026): ৳0') || res.answer.includes('no actual income transactions have been logged'), 'Must confirm 0 income for October 2026');
    assert.ok(res.answer.includes('5,000'), 'Must cite ৳5,000 recorded expenses for October 2026');
  });
});
