import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCashFlowForecast,
  getDetailedForecast,
  calculateSafeSpendingLimit,
} from '../../src/services/forecastService';
import { buildCoachContextFromData } from '../services/coachContextBuilder';
import { generateDeterministicCoachResponse } from '../services/coachFallbackEngine';
import { validateCoachNumbers } from '../services/coachNumberValidator';
import { Transaction, SavingsGoal, RecurringObligation } from '../../src/types/financial';

test('Cash Flow Forecast & Safe Spending Consistency Suite', async (suite) => {
  // Helper to create test transactions
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

  // =========================================================================
  // 1. Income ৳50,000 and expense ৳2,000 (The Reported Live Issue)
  // =========================================================================
  await suite.test('1. Income ৳50,000 and expense ৳2,000: No phantom burn, no arbitrary ৳7,200 buffer', () => {
    const txs: Transaction[] = [
      createTx({
        id: 'tx-live-inc',
        type: 'income',
        amount: 50000,
        category: 'Salary & Professional',
        date: '2026-10-01',
        merchant: 'Employer',
      }),
      createTx({
        id: 'tx-live-exp',
        type: 'expense',
        amount: 2000,
        category: 'Education & Learning',
        date: '2026-10-05',
        merchant: 'University',
      }),
    ];

    const ctx = buildCoachContextFromData(txs, [], null, {
      targetMonth: '2026-10',
      today: '2026-10-18',
    });

    // 1.1 Balance derivation & estimation flag
    assert.equal(ctx.snapshot.currentBalance, 48000, 'Current balance should be 48,000');
    assert.equal(ctx.snapshot.isBalanceEstimated, true, 'Balance must be flagged as estimated (no linked accounts)');
    assert.equal(ctx.cashFlow.isBalanceEstimated, true, 'CashFlow must flag balance as estimated');

    // 1.2 Data sufficiency: 1 expense transaction is insufficient for statistical daily burn
    assert.equal(ctx.cashFlow.isForecastSufficient, false, 'Forecast must flag insufficient data (< 3 expenses)');

    // 1.3 Month-end forecast must NOT invent 30 days of burn (45,990)
    assert.equal(
      ctx.cashFlow.forecastMonthEndBalance,
      48000,
      'Month-end balance must be 48,000 without invented future daily burn (was falsely 45,990)'
    );

    // 1.4 Safety buffer must NOT be an arbitrary 15% of starting balance (was falsely 7,200)
    assert.equal(
      ctx.cashFlow.recommendedBuffer,
      0,
      'Recommended buffer must be 0 without recurring obligations or baseline burn (was falsely 7,200)'
    );

    // 1.5 Safe spending limit
    assert.equal(ctx.cashFlow.uncommittedDiscretionaryPool, 48000, 'Uncommitted discretionary pool is 48,000');
    assert(ctx.cashFlow.safeSpendingLimitWeekly! > 0, 'Weekly safe spending limit calculated');

    // 1.6 Fallback engine output checks (English & Bengali)
    const enRes = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctx,
      'en',
      'What will my month-end balance be?'
    );
    assert(enRes.answer.includes('estimated net cash of ৳48,000'), 'Must label 48,000 as estimated net cash in English');
    assert(enRes.answer.includes('48,000'), 'Must cite 48,000 month-end balance');
    assert(!enRes.answer.includes('45,990'), 'Must NOT cite false 45,990 forecast');
    assert(!enRes.answer.includes('7,200'), 'Must NOT cite false 7,200 buffer');
    assert(enRes.answer.includes('No recurring obligations'), 'Must explain absence of buffer requirement');
    assert(enRes.answer.includes('Data Limitation'), 'Must disclose data limitation for unrecorded living costs');

    const bnRes = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctx,
      'bn',
      'মাস শেষে আমার ব্যালেন্স কত থাকবে?'
    );
    assert(bnRes.answer.includes('আনুমানিক নিট উদ্বৃত্ত ৳48,000'), 'Must label 48,000 as estimated in Bengali');
    assert(!bnRes.answer.includes('45,990'), 'Bengali must NOT cite 45,990');
    assert(!bnRes.answer.includes('7,200'), 'Bengali must NOT cite 7,200');

    // 1.7 Number validator enforces semantic constraints
    const validation = validateCoachNumbers(enRes.answer, ctx);
    assert.equal(validation.valid, true, `Validator should pass truthful fallback: ${validation.reason}`);
  });

  // =========================================================================
  // 2. Missing Opening Balance
  // =========================================================================
  await suite.test('2. Missing opening balance: Flags estimated balance and disclaims unlinked accounts', () => {
    const txs: Transaction[] = [
      createTx({ id: 'tx-2a', type: 'income', amount: 30000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: 'tx-2b', type: 'expense', amount: 10000, category: 'Food & Groceries', date: '2026-10-02' }),
    ];

    // User with no linked accounts
    const userWithoutAccounts = { id: 'u-no-acc', linkedAccounts: [] };
    const ctx = buildCoachContextFromData(txs, [], userWithoutAccounts, { targetMonth: '2026-10', today: '2026-10-18' });

    assert.equal(ctx.snapshot.isBalanceEstimated, true);
    assert.equal(ctx.cashFlow.isBalanceEstimated, true);
    assert.equal(ctx.snapshot.currentBalance, 20000);

    const factLabel = ctx.cashFlow.facts['cashFlow.startingBalance']?.labelEn;
    assert.ok(factLabel?.includes('Estimated'), 'Starting balance label must indicate Estimated');

    // Reject claims of "verified bank balance" when accounts are missing
    const fakeClaim = 'Your verified bank balance is ৳20,000.';
    const valResult = validateCoachNumbers(fakeClaim, ctx);
    assert.equal(valResult.valid, false, 'Validator must reject verified bank balance claims when unlinked');
    assert.ok(valResult.reason?.includes('claims a verified bank balance'));
  });

  // =========================================================================
  // 3. Existing Opening Balance
  // =========================================================================
  await suite.test('3. Existing opening balance: Recognizes verified linked accounts balance', () => {
    const userWithAccounts = {
      id: 'u-acc',
      linkedAccounts: [
        { name: 'City Bank', balance: 35000, accountNumber: '001', type: 'Bank' },
        { name: 'bKash', balance: 15000, accountNumber: '018', type: 'MFS' },
      ],
    };

    const ctx = buildCoachContextFromData([], [], userWithAccounts, { targetMonth: '2026-10', today: '2026-10-18' });

    assert.equal(ctx.snapshot.currentBalance, 50000, 'Sum of linked accounts is 50,000');
    assert.equal(ctx.snapshot.isBalanceEstimated, false, 'Balance is verified, not estimated');
    assert.equal(ctx.cashFlow.isBalanceEstimated, false);

    const enRes = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctx,
      'en',
      'What is my month-end balance?'
    );
    assert(enRes.answer.includes('verified liquid balance of **৳50,000**'), 'Must state verified liquid balance');
  });

  // =========================================================================
  // 4. Upcoming Bills
  // =========================================================================
  await suite.test('4. Upcoming bills: Deducted in forecast, factored in safety buffer, protected from safe spending', () => {
    const userWithBills = {
      id: 'u-bills',
      linkedAccounts: [{ name: 'Bank', balance: 60000, accountNumber: '001', type: 'Bank' }],
      recurringObligations: [
        { id: 'obl-1', name: 'Apartment Rent', amount: 20000, dueDay: 25, isEnabled: true },
        { id: 'obl-2', name: 'Internet Bill', amount: 1500, dueDay: 20, isEnabled: true },
        { id: 'obl-3', name: 'Gym Membership', amount: 3000, dueDay: 15, isEnabled: false }, // Disabled
      ],
    };

    const ctx = buildCoachContextFromData([], [], userWithBills, { targetMonth: '2026-10', today: '2026-10-18' });

    // 4.1 Upcoming bills sum excludes disabled
    assert.equal(ctx.cashFlow.upcomingBills, 21500, 'Upcoming bills must be 20000 + 1500 = 21,500');

    // 4.2 Forecast month end reflects deduction of upcoming bills
    assert.equal(ctx.cashFlow.forecastMonthEndBalance, 38500, '60,000 - 21,500 = 38,500');

    // 4.3 Safety buffer incorporates upcoming bills
    assert.equal(ctx.cashFlow.recommendedBuffer, 21500, 'Buffer covers scheduled bills (21,500)');

    // 4.4 Safe spending limit protects scheduled bills and safety buffer
    assert.equal(ctx.cashFlow.committedFunds, 43000, 'Committed = 21,500 (bills) + 21,500 (buffer) = 43,000');
    assert.equal(ctx.cashFlow.uncommittedDiscretionaryPool, 17000, 'Uncommitted pool = 60,000 - 43,000 = 17,000');

    const enRes = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctx,
      'en',
      'What is my safe spending limit?'
    );
    assert(enRes.answer.includes('17,000'), 'Must report 17,000 uncommitted pool');
    assert(enRes.answer.includes('38,500'), 'Must report 38,500 projected month-end balance');
  });

  // =========================================================================
  // 5. No Transaction History
  // =========================================================================
  await suite.test('5. No transaction history: Zero fake numbers, flags Insufficient Data', () => {
    const freshForecast = getDetailedForecast(0, false, [], []);

    assert.equal(freshForecast.startingBalance, 0);
    assert.equal(freshForecast.projectedMonthEnd, 0);
    assert.equal(freshForecast.upcomingBills, 0);
    assert.equal(freshForecast.recommendedBuffer, 0);
    assert.equal(freshForecast.dailyBurn, 0);
    assert.equal(freshForecast.forecastConfidence, 'Insufficient Data');
    assert.equal(freshForecast.isDataSufficient, false);

    const safeSpending = calculateSafeSpendingLimit({
      availableBalance: 0,
      isBalanceEstimated: false,
      upcomingBills: 0,
      monthlyGoalCommitments: 0,
      safetyBuffer: 0,
    });
    assert.equal(safeSpending.uncommittedDiscretionaryPool, 0);
    assert.equal(safeSpending.safeSpendingLimitWeekly, 0);
  });

  // =========================================================================
  // 6. Insufficient Forecast Data
  // =========================================================================
  await suite.test('6. Insufficient forecast data: Does not extrapolate daily burn when expenses < 3', () => {
    const sparseTxs: Transaction[] = [
      createTx({ id: 'tx-s1', type: 'income', amount: 40000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: 'tx-s2', type: 'expense', amount: 3000, category: 'Utilities & Bills', date: '2026-10-04' }),
    ];

    const forecast = getDetailedForecast(37000, false, sparseTxs, []);

    // 6.1 Daily burn must be 0, not 3,000 / 30 = 100/day
    assert.equal(forecast.dailyBurn, 0, 'Daily burn must be 0 for sparse data (< 3 expenses)');
    assert.equal(forecast.isDataSufficient, false, 'isDataSufficient must be false');
    assert.equal(forecast.projectedMonthEnd, 37000, 'Month end remains 37,000 without invented daily expenses');
    assert.ok(forecast.assumptions.some((a) => a.includes('Zero daily burn projected due to sparse expense history')));
  });

  // =========================================================================
  // 7. Month-End Forecast Consistency
  // =========================================================================
  await suite.test('7. Month-end forecast consistency: Context, fallback engine, and validator are synchronized', () => {
    // Mature user with 4 expenses (sufficient data)
    const matureTxs: Transaction[] = [
      createTx({ id: 'tx-m1', type: 'income', amount: 80000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: 'tx-m2', type: 'expense', amount: 20000, category: 'Rent & Living', date: '2026-10-02' }),
      createTx({ id: 'tx-m3', type: 'expense', amount: 10000, category: 'Food & Groceries', date: '2026-10-05' }),
      createTx({ id: 'tx-m4', type: 'expense', amount: 5000, category: 'Utilities & Bills', date: '2026-10-10' }),
      createTx({ id: 'tx-m5', type: 'expense', amount: 5000, category: 'Dining & Eating Out', date: '2026-10-12' }),
    ];
    const user = {
      id: 'u-mature',
      linkedAccounts: [{ name: 'City Bank', balance: 50000, accountNumber: '001', type: 'Bank' }],
    };

    const ctx = buildCoachContextFromData(matureTxs, [], user, { targetMonth: '2026-10', today: '2026-10-18' });

    assert.equal(ctx.cashFlow.isForecastSufficient, true, 'Data should be sufficient with 4 expenses');
    const expectedMonthEnd = ctx.cashFlow.forecastMonthEndBalance;

    const res = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctx,
      'en',
      'What will my month-end balance be?'
    );

    assert.ok(
      res.answer.includes(expectedMonthEnd.toLocaleString()),
      `AI response must include exact calculated month-end balance: ${expectedMonthEnd}`
    );

    const validation = validateCoachNumbers(res.answer, ctx);
    assert.equal(validation.valid, true, `Validator should pass: ${validation.reason}`);
  });

  // =========================================================================
  // 8. Safety Buffer Calculation
  // =========================================================================
  await suite.test('8. Safety buffer calculation: Authoritative rule vs arbitrary 15% check', () => {
    // 8.1 No bills, 0 burn -> buffer is 0
    const b1 = getDetailedForecast(100000, false, [], []).recommendedBuffer;
    assert.equal(b1, 0, 'Buffer must be 0 with no bills and no burn (NOT 15% of 100k = 15,000)');

    // 8.2 No bills, 1 expense (insufficient data) -> buffer is 0
    const singleExp = [createTx({ id: 's-1', type: 'expense', amount: 5000, category: 'Food & Groceries', date: '2026-10-01' })];
    const b2 = getDetailedForecast(48000, false, singleExp, []).recommendedBuffer;
    assert.equal(b2, 0, 'Buffer must be 0 for single expense without bills (NOT 7,200)');

    // 8.3 Upcoming bills = 20,000, 0 burn -> buffer is 20,000
    const bills: RecurringObligation[] = [{ id: 'b-1', name: 'Rent', amount: 20000, dueDay: 25, isEnabled: true, recurrenceRule: 'monthly' }];
    const b3 = getDetailedForecast(50000, false, [], bills).recommendedBuffer;
    assert.equal(b3, 20000, 'Buffer must match upcoming bills');

    // 8.4 Upcoming bills = 20,000, daily burn with 3 expenses = 1,000/day -> buffer is 20,000 + 7 * 1,000 = 27,000
    const threeExps = [
      createTx({ id: 'e-1', type: 'expense', amount: 10000, category: 'Rent & Living', date: '2026-10-01' }),
      createTx({ id: 'e-2', type: 'expense', amount: 10000, category: 'Food & Groceries', date: '2026-10-05' }),
      createTx({ id: 'e-3', type: 'expense', amount: 10000, category: 'Utilities & Bills', date: '2026-10-10' }),
    ];
    // total = 30,000 -> dailyBurn = 1,000
    const b4 = getDetailedForecast(50000, false, threeExps, bills).recommendedBuffer;
    assert.equal(b4, 27000, 'Buffer must be 20,000 + 7 * 1,000 = 27,000');
  });

  // =========================================================================
  // 9. Weekly Spending Limit Calculation
  // =========================================================================
  await suite.test('9. Weekly spending limit calculation: Protects committed funds and handles zero headroom', () => {
    // 9.1 Balance 40,000, upcoming bills 15,000, goals 5,000, buffer 15,000 -> Pool 5,000
    const res1 = calculateSafeSpendingLimit({
      availableBalance: 40000,
      isBalanceEstimated: false,
      upcomingBills: 15000,
      monthlyGoalCommitments: 5000,
      safetyBuffer: 15000,
      remainingDaysInMonth: 14,
      expenseTransactionCount: 4,
    });
    assert.equal(res1.committedFunds, 35000);
    assert.equal(res1.uncommittedDiscretionaryPool, 5000);
    assert.equal(res1.safeSpendingLimitWeekly, 2500); // 5,000 / 2 weeks = 2,500/week

    // 9.2 Balance 20,000, upcoming bills 25,000 -> Pool 0, Weekly limit 0
    const res2 = calculateSafeSpendingLimit({
      availableBalance: 20000,
      isBalanceEstimated: false,
      upcomingBills: 25000,
      monthlyGoalCommitments: 0,
      safetyBuffer: 0,
      remainingDaysInMonth: 14,
    });
    assert.equal(res2.committedFunds, 25000);
    assert.equal(res2.uncommittedDiscretionaryPool, 0);
    assert.equal(res2.safeSpendingLimitWeekly, 0);

    // 9.3 Validator rejects recommending positive weekly spending when uncommitted pool is 0
    const mockCtx = buildCoachContextFromData([], [], {
      linkedAccounts: [{ name: 'Bank', balance: 10000, accountNumber: '1', type: 'Bank' }],
      recurringObligations: [{ id: 'r1', name: 'Rent', amount: 15000, dueDay: 25, isEnabled: true }],
    });
    assert.equal(mockCtx.cashFlow.uncommittedDiscretionaryPool, 0);

    const falseClaim = 'Your safe personal weekly spending limit is ৳5,000.';
    const valRes = validateCoachNumbers(falseClaim, mockCtx);
    assert.equal(valRes.valid, false, 'Validator must reject positive spending recommendation when pool is 0');
    assert.ok(valRes.reason?.includes('recommends positive weekly spending when available balance is fully committed'));
  });

  // =========================================================================
  // 10. Multiple Authenticated Users with Different Financial Data
  // =========================================================================
  await suite.test('10. Multiple authenticated users: Contexts and recommendations are strictly isolated', () => {
    // User A: Single transaction, unlinked accounts
    const userA = { id: 'user-a', name: 'Alice', linkedAccounts: [] };
    const txsA: Transaction[] = [
      createTx({ id: 'tx-a1', userId: 'user-a', type: 'income', amount: 50000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: 'tx-a2', userId: 'user-a', type: 'expense', amount: 2000, category: 'Education & Learning', date: '2026-10-05' }),
    ];
    const ctxA = buildCoachContextFromData(txsA, [], userA, { targetMonth: '2026-10', today: '2026-10-18' });

    // User B: Multi-account, verified bank balance, large rent obligation
    const userB = {
      id: 'user-b',
      name: 'Bob',
      linkedAccounts: [
        { name: 'City Bank', balance: 80000, accountNumber: 'B01', type: 'Bank' },
        { name: 'bKash', balance: 15000, accountNumber: 'B02', type: 'MFS' },
      ],
      recurringObligations: [
        { id: 'b-rent', name: 'House Rent', amount: 35000, dueDay: 25, isEnabled: true },
      ],
    };
    const goalsB: SavingsGoal[] = [
      {
        id: 'g-b1',
        userId: 'user-b',
        title: 'Hajj Fund',
        targetAmount: 300000,
        currentAmount: 50000,
        deadline: '2027-06-01',
        status: 'On Track',
        progressPercentage: 16.7,
        remainingAmount: 250000,
        requiredMonthlyContribution: 15000,
      } as any,
    ];
    const txsB: Transaction[] = [
      createTx({ id: 'tx-b1', userId: 'user-b', type: 'income', amount: 120000, category: 'Salary & Professional', date: '2026-10-01' }),
      createTx({ id: 'tx-b2', userId: 'user-b', type: 'expense', amount: 35000, category: 'Rent & Living', date: '2026-10-03' }),
      createTx({ id: 'tx-b3', userId: 'user-b', type: 'expense', amount: 15000, category: 'Food & Groceries', date: '2026-10-06' }),
      createTx({ id: 'tx-b4', userId: 'user-b', type: 'expense', amount: 8000, category: 'Utilities & Bills', date: '2026-10-08' }),
    ];
    const ctxB = buildCoachContextFromData(txsB, goalsB, userB, { targetMonth: '2026-10', today: '2026-10-18' });

    // Assert User A state
    assert.equal(ctxA.snapshot.currentBalance, 48000);
    assert.equal(ctxA.snapshot.isBalanceEstimated, true);
    assert.equal(ctxA.cashFlow.upcomingBills, 0);
    assert.equal(ctxA.cashFlow.recommendedBuffer, 0);
    assert.equal(ctxA.cashFlow.isForecastSufficient, false);

    // Assert User B state
    assert.equal(ctxB.snapshot.currentBalance, 95000); // 80k + 15k
    assert.equal(ctxB.snapshot.isBalanceEstimated, false);
    assert.equal(ctxB.cashFlow.upcomingBills, 35000);
    assert.equal(ctxB.cashFlow.isForecastSufficient, true);
    assert(ctxB.cashFlow.recommendedBuffer >= 35000);

    // Generate responses for both and verify zero data contamination
    const resA = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctxA,
      'en',
      'What is my month-end balance?'
    );
    const resB = generateDeterministicCoachResponse(
      { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [] },
      ctxB,
      'en',
      'What is my month-end balance?'
    );

    // User A response must NOT have User B data
    assert(!resA.answer.includes('95,000'), 'User A must not leak User B balance');
    assert(!resA.answer.includes('35,000'), 'User A must not leak User B rent');
    assert(resA.answer.includes('48,000'), 'User A must cite own 48,000 balance');

    // User B response must NOT have User A data
    assert(!resB.answer.includes('48,000'), 'User B must not leak User A balance');
    assert(resB.answer.includes('95,000'), 'User B must cite own 95,000 balance');
  });
});
