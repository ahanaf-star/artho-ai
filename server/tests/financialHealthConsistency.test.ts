import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { buildCoachContextFromData, CoachContext } from '../services/coachContextBuilder';
import { validateCoachNumbers } from '../services/coachNumberValidator';
import { calculateFinancialHealthScore } from '../../src/services/financialCalculations';
import { Transaction, SavingsGoal } from '../../src/types/financial';

function createTwoTransactionsContext(): CoachContext {
  const txs: Transaction[] = [
    {
      id: 'tx-inc-50k',
      type: 'income',
      amount: 50000,
      category: 'Salary & Inflow',
      merchant: 'Tech Employer Inc',
      description: 'Monthly Salary',
      date: '2026-10-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-exp-2k-edu',
      type: 'expense',
      amount: 2000,
      category: 'Education',
      merchant: 'City School',
      description: 'School tuition',
      date: '2026-10-05',
      account: 'bKash',
      paymentMethod: 'QR',
      classification: 'essential',
    },
  ];

  return buildCoachContextFromData(txs, [], null, {
    targetMonth: '2026-10',
    today: '2026-10-18',
  });
}

function createSufficientDataContext(): CoachContext {
  const txs: Transaction[] = [
    {
      id: 'tx-1',
      type: 'income',
      amount: 50000,
      category: 'Salary & Inflow',
      merchant: 'Tech Employer Inc',
      description: 'Monthly Salary',
      date: '2026-07-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 20000,
      category: 'Food & Groceries',
      merchant: 'Shwapno',
      description: 'Groceries',
      date: '2026-07-05',
      account: 'bKash',
      paymentMethod: 'QR',
      classification: 'essential',
    },
    {
      id: 'tx-3',
      type: 'income',
      amount: 50000,
      category: 'Salary & Inflow',
      merchant: 'Tech Employer Inc',
      description: 'Monthly Salary',
      date: '2026-08-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-4',
      type: 'expense',
      amount: 22000,
      category: 'Food & Groceries',
      merchant: 'Shwapno',
      description: 'Groceries',
      date: '2026-08-05',
      account: 'bKash',
      paymentMethod: 'QR',
      classification: 'essential',
    },
    {
      id: 'tx-5',
      type: 'income',
      amount: 50000,
      category: 'Salary & Inflow',
      merchant: 'Tech Employer Inc',
      description: 'Monthly Salary',
      date: '2026-09-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-6',
      type: 'expense',
      amount: 21000,
      category: 'Food & Groceries',
      merchant: 'Shwapno',
      description: 'Groceries',
      date: '2026-09-05',
      account: 'bKash',
      paymentMethod: 'QR',
      classification: 'essential',
    },
    {
      id: 'tx-7',
      type: 'income',
      amount: 50000,
      category: 'Salary & Inflow',
      merchant: 'Tech Employer Inc',
      description: 'Monthly Salary',
      date: '2026-10-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-8',
      type: 'expense',
      amount: 20000,
      category: 'Food & Groceries',
      merchant: 'Shwapno',
      description: 'Groceries',
      date: '2026-10-05',
      account: 'bKash',
      paymentMethod: 'QR',
      classification: 'essential',
    },
  ];

  const goals: SavingsGoal[] = [
    {
      id: 'goal-emg',
      title: 'Emergency Fund',
      targetAmount: 100000,
      currentAmount: 60000,
      deadline: '2027-01-01',
      monthlyPace: 5000,
      category: 'Emergency Fund',
      accountVault: 'City Bank Vault',
      status: 'On Track',
      icon: 'shield',
    },
  ];

  return buildCoachContextFromData(txs, goals, null, {
    targetMonth: '2026-10',
    today: '2026-10-18',
  });
}

function createInsufficientDataContext(): CoachContext {
  return buildCoachContextFromData([], [], null, {
    targetMonth: '2026-10',
    today: '2026-10-18',
  });
}

test('Financial Health Score Consistency & Data Sufficiency Test Suite', async (suite) => {
  // =========================================================================
  // SCENARIO 1: Two transactions with incomplete financial history
  // =========================================================================
  await suite.test('1. Two transactions with incomplete financial history (Low Confidence)', async (t) => {
    await t.test('1.1: Calculation produces numeric score (100) with Low confidence', () => {
      const txs: Transaction[] = [
        {
          id: 't1',
          type: 'income',
          amount: 50000,
          category: 'Salary & Inflow',
          merchant: 'Tech Corp',
          description: 'Salary',
          account: 'City Bank',
          paymentMethod: 'Bank Transfer',
          date: '2026-10-01',
          classification: 'essential',
        },
        {
          id: 't2',
          type: 'expense',
          amount: 2000,
          category: 'Education',
          merchant: 'City School',
          description: 'School tuition',
          account: 'bKash',
          paymentMethod: 'QR',
          date: '2026-10-05',
          classification: 'essential',
        },
      ];
      const result = calculateFinancialHealthScore({
        transactions: txs,
        goals: [],
        monthlyIncome: 50000,
        asOfDate: '2026-10-05',
      });

      assert.equal(result.score, 100, 'Score is legitimately 100 based on available 60% weight');
      assert.equal(result.category, 'Excellent');
      assert.equal(result.confidence, 'low', 'Confidence is low due to limited 1-month history');
      assert.equal(result.status, 'ok');
    });

    await t.test('1.2: AI Coach displays score as Preliminary and explains the limitation (English)', async () => {
      const ctx = createTwoTransactionsContext();
      const res = await executeCoachInquiry({
        query: 'What is my financial health score?',
        fullContext: ctx,
        language: 'en',
      });

      // Must display the score (100/100)
      assert.match(res.answer, /100\s*\/\s*100/);
      // Must explicitly flag it as Preliminary
      assert.match(res.answer, /Preliminary/i);
      // Must explain the data limitation / limited history
      assert.match(res.answer, /limited history|initial baseline|limited transaction/i);
      // Must not display "null%" for missing goal progress
      assert.doesNotMatch(res.answer, /null%/);
      assert.match(res.answer, /No Active Goals|Insufficient Data/i);
    });

    await t.test('1.3: AI Coach displays score as Preliminary in Bengali', async () => {
      const ctx = createTwoTransactionsContext();
      const res = await executeCoachInquiry({
        query: 'আমার হেলথ স্কোর কত?',
        fullContext: ctx,
        language: 'bn',
      });

      assert.match(res.answer, /100\s*\/\s*(?:100|১০০)|১০০\s*\/\s*১০০/);
      assert.match(res.answer, /প্রাথমিক/);
      assert.match(res.answer, /সীমিত তথ্যের কারণে|প্রাথমিক মূল্যায়ন/);
      assert.doesNotMatch(res.answer, /null%/);
    });

    await t.test('1.4: Health recommendations header cites preliminary score when low confidence', async () => {
      const ctx = createTwoTransactionsContext();
      const res = await executeCoachInquiry({
        query: 'What are the 3 most important actions I should take to improve my financial health?',
        fullContext: ctx,
        language: 'en',
      });

      assert.match(res.answer, /Preliminary due to limited history/);
      assert.match(res.answer, /100\/100/);
    });
  });

  // =========================================================================
  // SCENARIO 2: Valid score with sufficient data (High/Medium Confidence)
  // =========================================================================
  await suite.test('2. Valid score with sufficient data (>= 3 months, full goals)', async (t) => {
    const sufficientCtx = createSufficientDataContext();

    await t.test('2.1: Calculation returns High confidence for 3+ months of data', () => {
      assert.equal(sufficientCtx.health.confidence, 'High');
      assert.equal(sufficientCtx.health.available, true);
      assert(sufficientCtx.health.score !== null && sufficientCtx.health.score > 0);
    });

    await t.test('2.2: AI Coach reports verified score without preliminary caveats (English)', async () => {
      const res = await executeCoachInquiry({
        query: 'What is my financial health score?',
        fullContext: sufficientCtx,
        language: 'en',
      });

      assert(sufficientCtx.health.score !== null);
      assert.match(res.answer, new RegExp(`${sufficientCtx.health.score}\\s*\\/\\s*100`));
      assert.doesNotMatch(res.answer, /Preliminary due to limited history/);
      assert.doesNotMatch(res.answer, /Note on Preliminary Status/);
    });

    await t.test('2.3: AI Coach reports verified score in Bengali without preliminary caveats', async () => {
      const res = await executeCoachInquiry({
        query: 'আমার হেলথ স্কোর কত?',
        fullContext: sufficientCtx,
        language: 'bn',
      });

      assert(sufficientCtx.health.score !== null);
      assert.match(res.answer, new RegExp(`${sufficientCtx.health.score}\\s*\\/\\s*(?:100|১০০)`));
      assert.doesNotMatch(res.answer, /সীমিত তথ্যের কারণে প্রাথমিক/);
    });

    await t.test('2.4: Recommendations header shows confirmed score without preliminary warning', async () => {
      const res = await executeCoachInquiry({
        query: 'What are the 3 most important actions I should take to improve my financial health?',
        fullContext: sufficientCtx,
        language: 'en',
      });

      assert(sufficientCtx.health.score !== null);
      assert.match(res.answer, new RegExp(`Financial Health Score:\\s*\\*\\*${sufficientCtx.health.score}\\/100\\*\\*`));
      assert.doesNotMatch(res.answer, /Preliminary due to limited history/);
    });
  });

  // =========================================================================
  // SCENARIO 3: Insufficient data / null score
  // =========================================================================
  await suite.test('3. Insufficient data / null score (0 transactions or weight < 0.50)', async (t) => {
    const insufficientCtx = createInsufficientDataContext();

    await t.test('3.1: Calculation returns score: null and status: insufficient_data', () => {
      const result = calculateFinancialHealthScore({
        transactions: [],
        goals: [],
        monthlyIncome: 0,
      });

      assert.equal(result.score, null, 'Score must be null');
      assert.equal(result.status, 'insufficient_data');
      assert.equal(result.category, null);
    });

    await t.test('3.2: AI Coach NEVER displays 100/100 or Excellent; explains insufficient data clearly (English)', async () => {
      const res = await executeCoachInquiry({
        query: 'What is my financial health score?',
        fullContext: insufficientCtx,
        language: 'en',
      });

      // Must NEVER display 100/100 or Excellent
      assert.doesNotMatch(res.answer, /100\s*\/\s*100/);
      assert.doesNotMatch(res.answer, /Rating:\s*\*\*Excellent\*\*/i);
      // Must not display "null / 100"
      assert.doesNotMatch(res.answer, /null\s*\/\s*100/i);
      // Must clearly state insufficient data
      assert.match(res.answer, /insufficient transaction data/i);
      assert.match(res.answer, /To unlock a reliable score/i);
    });

    await t.test('3.3: AI Coach explains insufficient data in Bengali without inventing score', async () => {
      const res = await executeCoachInquiry({
        query: 'আমার হেলথ স্কোর কত?',
        fullContext: insufficientCtx,
        language: 'bn',
      });

      assert.doesNotMatch(res.answer, /১০০\s*\/\s*১০০/);
      assert.doesNotMatch(res.answer, /100\s*\/\s*100/);
      assert.doesNotMatch(res.answer, /চমৎকার/);
      assert.doesNotMatch(res.answer, /null\s*\/\s*১০০/);
      assert.match(res.answer, /পর্যাপ্ত লেনদেনের তথ্য নেই|পর্যাপ্ত তথ্য নেই/);
      assert.match(res.answer, /নির্ভরযোগ্য হেলথ স্কোর পেতে/);
    });

    await t.test('3.4: Health recommendations header shows Pending Data, never 100/100', async () => {
      const res = await executeCoachInquiry({
        query: 'What are the 3 most important actions I should take to improve my financial health?',
        fullContext: insufficientCtx,
        language: 'en',
      });

      assert.doesNotMatch(res.answer, /100\/100/);
      assert.doesNotMatch(res.answer, /Rating:\s*\*\*Excellent\*\*/i);
      assert.match(res.answer, /Pending Data|insufficient transactions/);
    });

    await t.test('3.5: Number validator rejects any hallucinated 100/100 or Excellent rating when data is insufficient', () => {
      const hallucinatedAnswer = 'Your Financial Health Score is 100/100, Rating: Excellent. You have great savings!';
      const validation = validateCoachNumbers(hallucinatedAnswer, insufficientCtx);

      assert.equal(validation.valid, false, 'Validator must reject claiming 100/100 when calculation is insufficient_data');
      assert.match(validation.reason!, /Semantic contradiction.*insufficient data/i);
    });
  });
});
