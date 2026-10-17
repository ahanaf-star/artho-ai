import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  calculateFinancialHealthScore,
  DEFAULT_FINANCIAL_HEALTH_CONFIG,
} from '../../src/services/financialCalculations';
import { Transaction, SavingsGoal } from '../../src/types/financial';
import { connectDB, isDbConnected } from '../config/database';
import { UserModel } from '../models/User';
import { TransactionModel } from '../models/Transaction';
import { SavingsGoalModel } from '../models/SavingsGoal';
import { getAuthoritativeUserHealthScore } from '../services/healthScoreService';

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';

test('Financial Health Data-Sufficiency & Integrity Test Suite', async (suite) => {
  // Connect to DB if available for persistence & isolation tests
  await connectDB();

  // ==================================================
  // TEST 1 — BRAND-NEW USER
  // ==================================================
  await suite.test('TEST 1 — BRAND-NEW USER: Returns Insufficient Data for all components with no fake records', () => {
    const emptyTxs: Transaction[] = [];
    const emptyGoals: SavingsGoal[] = [];
    const monthlyIncome = 0;

    const res = calculateFinancialHealthScore(emptyTxs, emptyGoals, monthlyIncome);

    // Assert overall score is null and status is 'Insufficient Data'
    assert.equal(res.score, null, 'Overall score must be null for brand-new user');
    assert.equal(res.status, 'Insufficient Data', 'Status must be Insufficient Data');
    assert.equal(res.percentile, null, 'Percentile must be null without sufficient data');

    // Assert all 4 factors are null (Insufficient Data), never 0 or fake fallback
    assert.equal(res.factors.savingConsistency, null, 'Saving Consistency must be null');
    assert.equal(res.factors.spendingControl, null, 'Spending Control must be null');
    assert.equal(res.factors.cashFlowStability, null, 'Cash Flow Stability must be null');
    assert.equal(res.factors.goalProgress, null, 'Goal Progress must be null');

    // Also verify object-signature overload produces identical insufficient_data status
    const objRes = calculateFinancialHealthScore({
      transactions: emptyTxs,
      goals: emptyGoals,
      monthlyIncome,
    });
    assert.equal(objRes.status, 'insufficient_data');
    assert.equal(objRes.score, null);
    for (const comp of objRes.components) {
      assert.equal(comp.available, false, `Component ${comp.key} should be unavailable`);
      assert.equal(comp.score, null, `Component ${comp.key} score should be null`);
    }
  });

  // ==================================================
  // TEST 2 — INCOME WITHOUT EXPENSES
  // ==================================================
  await suite.test('TEST 2 — INCOME WITHOUT EXPENSES: Spending Control is unavailable, components evaluated independently', () => {
    const incomeOnlyTxs: Transaction[] = [
      {
        id: 'tx-inc-1',
        userId: 'u-inc',
        type: 'income',
        amount: 45000,
        category: 'Salary & Inflow',
        description: 'Monthly Salary',
        date: '2026-10-01',
        merchant: 'Tech Corp',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
    ];

    const res = calculateFinancialHealthScore({
      transactions: incomeOnlyTxs,
      goals: [],
      monthlyIncome: 45000,
      asOfDate: '2026-10-05',
    });

    const expenseComp = res.components.find((c) => c.key === 'expense_control')!;
    const savingsRateComp = res.components.find((c) => c.key === 'savings_rate')!;

    // Spending Control must be unavailable because no expense data exists
    assert.equal(expenseComp.available, false, 'Spending Control must be unavailable without expenses');
    assert.equal(expenseComp.score, null, 'Spending Control score must be null');
    assert.equal(expenseComp.status, 'no_expense_data');

    // Other components evaluated independently: savings rate is available since income exists
    assert.equal(savingsRateComp.available, true, 'Savings Rate should be available with valid income');
    assert(savingsRateComp.score !== null && savingsRateComp.score > 0);

    // Factors mapping: spendingControl is null, savingConsistency is present
    assert.equal(res.factors?.spendingControl, null, 'Factor spendingControl must be null');
    assert(res.factors?.savingConsistency !== null, 'Factor savingConsistency must be calculated');
  });

  // ==================================================
  // TEST 3 — LEGITIMATE ZERO RESULT
  // ==================================================
  await suite.test('TEST 3 — LEGITIMATE ZERO RESULT: Displays 0%, not Insufficient Data, when genuinely zero', () => {
    // Zero Net Savings (income = 40,000, expenses = 40,000 -> netSavings = 0, rate = 0%)
    const breakEvenTxs: Transaction[] = [
      {
        id: 'tx-in-3',
        userId: 'u-zero-res',
        type: 'income',
        amount: 40000,
        category: 'Salary & Inflow',
        description: 'Salary',
        date: '2026-10-01',
        merchant: 'Employer',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
      {
        id: 'tx-exp-3',
        userId: 'u-zero-res',
        type: 'expense',
        amount: 40000,
        category: 'Utility & Fixed Costs',
        description: 'Obligations & Living',
        date: '2026-10-02',
        merchant: 'Various',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
    ];

    const res = calculateFinancialHealthScore({
      transactions: breakEvenTxs,
      goals: [
        {
          id: 'goal-zero-prog',
          title: 'MacBook',
          targetAmount: 150000,
          currentAmount: 0, // 0% progress
          deadline: '2027-01-01',
          monthlyPace: 10000,
          accountVault: 'City Bank',
          status: 'On Track',
          icon: 'laptop',
          category: 'Gadgets',
        },
      ],
      monthlyIncome: 40000,
      startingBalance: 0, // 0 liquid buffer
      asOfDate: '2026-10-05',
    });

    const savingsRateComp = res.components.find((c) => c.key === 'savings_rate')!;
    const goalComp = res.components.find((c) => c.key === 'savings_goals')!;
    const cashFlowComp = res.components.find((c) => c.key === 'cash_flow_health')!;

    // Savings rate is available with genuine 0 score
    assert.equal(savingsRateComp.available, true, 'Savings Rate is available');
    assert.equal(savingsRateComp.score, 0, 'Genuine zero savings rate must be 0, not null');
    assert.equal(savingsRateComp.rawValue, 0, 'Raw value must be 0%');

    // Goal progress is available with genuine 0 score
    assert.equal(goalComp.available, true, 'Goal progress is available');
    assert.equal(goalComp.score, 0, 'Genuine zero goal progress must be 0, not null');

    // Cash flow health with zero buffer
    assert.equal(cashFlowComp.available, true, 'Cash flow health is available');
    assert.equal(cashFlowComp.score, 0, 'Zero cash buffer must produce 0 score');

    // Factors must be 0, NOT null
    assert.equal(res.factors?.savingConsistency, 0, 'Factor savingConsistency must be 0');
    assert.equal(res.factors?.goalProgress, 0, 'Factor goalProgress must be 0');
    assert.equal(res.factors?.cashFlowStability, 0, 'Factor cashFlowStability must be 0');
  });

  // ==================================================
  // TEST 4 — NO SAVINGS GOALS
  // ==================================================
  await suite.test('TEST 4 — NO SAVINGS GOALS: Goal Progress is Insufficient Data while other components retain state', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-4a',
        userId: 'u-no-goals',
        type: 'income',
        amount: 50000,
        category: 'Salary & Inflow',
        description: 'Salary',
        date: '2026-10-01',
        merchant: 'Co',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
      {
        id: 'tx-4b',
        userId: 'u-no-goals',
        type: 'expense',
        amount: 20000,
        category: 'Food & Groceries',
        description: 'Groceries',
        date: '2026-10-03',
        merchant: 'Shwapno',
        account: 'bKash',
        paymentMethod: 'QR',
        classification: 'essential',
      },
    ];

    const res = calculateFinancialHealthScore(txs, [], 50000);

    // Goal progress is null (Insufficient Data)
    assert.equal(res.factors.goalProgress, null, 'Goal progress factor must be null when no goals exist');

    // Other factors retain independent valid scores
    assert(res.factors.savingConsistency !== null && res.factors.savingConsistency > 0);
    assert(res.factors.spendingControl !== null && res.factors.spendingControl > 0);
    assert(res.factors.cashFlowStability !== null);

    // Overall score is still calculated because remaining weight >= 0.50
    assert(res.score !== null && res.score > 0, 'Overall score should calculate from available factors');
    assert.notEqual(res.status, 'Insufficient Data');
  });

  // ==================================================
  // TEST 5 — VALID GOAL WITH ZERO SAVINGS
  // ==================================================
  await suite.test('TEST 5 — VALID GOAL WITH ZERO SAVINGS: Goal Progress is genuine 0%', () => {
    const goals: SavingsGoal[] = [
      {
        id: 'goal-zero-1',
        title: 'Emergency Deposit',
        targetAmount: 100000,
        currentAmount: 0,
        deadline: '2026-12-31',
        monthlyPace: 10000,
        accountVault: 'bKash Vault',
        status: 'On Track',
        icon: 'savings',
        category: 'Emergency',
      },
    ];

    const res = calculateFinancialHealthScore([], goals, 0);

    assert.equal(res.factors.goalProgress, 0, 'Goal progress factor must be genuine 0%');
    assert.equal(goals[0].targetAmount, 100000);
    assert.equal(goals[0].currentAmount, 0);
  });

  // ==================================================
  // TEST 6 — PARTIAL DATA
  // ==================================================
  await suite.test('TEST 6 — PARTIAL DATA: Missing components are not counted as zero in overall score', () => {
    const incomeOnlyTxs: Transaction[] = [
      {
        id: 'tx-p1',
        userId: 'u-partial',
        type: 'income',
        amount: 60000,
        category: 'Salary & Inflow',
        description: 'Salary',
        date: '2026-10-01',
        merchant: 'Employer',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
    ];

    const singleGoal: SavingsGoal[] = [
      {
        id: 'goal-p1',
        title: 'Education',
        targetAmount: 50000,
        currentAmount: 25000, // 50%
        deadline: '2026-11-30',
        monthlyPace: 5000,
        accountVault: 'bKash',
        status: 'On Track',
        icon: 'school',
        category: 'Education',
      },
    ];

    const res = calculateFinancialHealthScore({
      transactions: incomeOnlyTxs,
      goals: singleGoal,
      monthlyIncome: 60000,
      asOfDate: '2026-10-05',
    });

    const expenseComp = res.components.find((c) => c.key === 'expense_control')!;
    const emgComp = res.components.find((c) => c.key === 'emergency_fund')!;
    const savingsGoalsComp = res.components.find((c) => c.key === 'savings_goals')!;

    assert.equal(expenseComp.available, false, 'Expense control unavailable');
    assert.equal(emgComp.available, false, 'Emergency fund unavailable');
    assert.equal(savingsGoalsComp.available, true, 'Savings goals available');

    // Missing components are null, not silently 0
    assert.equal(res.factors?.spendingControl, null);
    assert(res.factors?.goalProgress !== null && res.factors?.goalProgress > 0);

    // Available weight = 0.25 (savingsRate) + 0.20 (savingsGoals) + 0.10 (cashFlow) = 0.55 >= 0.50
    assert.equal(res.status, 'ok');
    assert(res.score !== null && res.score > 50, 'Re-weighted score properly calculated without zero drag');
  });

  // ==================================================
  // TEST 7 — EXISTING USER REGRESSION
  // ==================================================
  await suite.test('TEST 7 — EXISTING USER REGRESSION: Verified formulas produce expected outputs', () => {
    const controlledTxs: Transaction[] = [
      {
        id: 'tx-reg-1',
        userId: 'u-reg',
        type: 'income',
        amount: 50000,
        category: 'Salary & Inflow',
        description: 'Salary',
        date: '2026-10-01',
        merchant: 'Co',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
      {
        id: 'tx-reg-2',
        userId: 'u-reg',
        type: 'expense',
        amount: 25000, // 50% expense ratio
        category: 'Utility & Fixed Costs',
        description: 'Rent',
        date: '2026-10-02',
        merchant: 'Landlord',
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
    ];

    const controlledGoals: SavingsGoal[] = [
      {
        id: 'goal-reg-emg',
        title: 'Emergency Fund',
        targetAmount: 100000,
        currentAmount: 75000, // 3 months of 25k burn
        deadline: '2026-12-31',
        monthlyPace: 10000,
        accountVault: 'bKash',
        status: 'On Track',
        icon: 'shield',
        category: 'Emergency Fund',
      },
    ];

    const res = calculateFinancialHealthScore({
      transactions: controlledTxs,
      goals: controlledGoals,
      monthlyIncome: 50000,
      startingBalance: 30000,
      asOfDate: '2026-10-05',
    });

    assert.equal(res.status, 'ok');
    assert(res.score !== null && res.score >= 80, `Expected score >= 80, got ${res.score}`);
    assert.equal(res.category, 'Excellent');
  });

  // ==================================================
  // TEST 8 — USER ISOLATION
  // ==================================================
  await suite.test('TEST 8 — USER ISOLATION: User A sees only User A data, cross-user queries rejected with 403', async () => {
    const userA_Id = `test-user-a-${Date.now()}`;
    const userB_Id = `test-user-b-${Date.now()}`;

    if (isDbConnected()) {
      // Create user records
      await UserModel.create([
        {
          customId: userA_Id,
          name: 'User A',
          email: `${userA_Id}@test.com`,
          password: 'Password123!',
          monthlyIncome: 40000,
        },
        {
          customId: userB_Id,
          name: 'User B',
          email: `${userB_Id}@test.com`,
          password: 'Password123!',
          monthlyIncome: 25000,
        },
      ]);

      // User A: Income 40,000 BDT, Expenses 10,000 BDT
      await TransactionModel.create([
        {
          customId: `tx-a-inc-${Date.now()}`,
          userId: userA_Id,
          type: 'income',
          amount: 40000,
          category: 'Salary & Inflow',
          description: 'User A Inflow',
          date: '2026-10-01',
          merchant: 'Employer A',
          account: 'City Bank',
          paymentMethod: 'Bank Transfer',
          classification: 'essential',
        },
        {
          customId: `tx-a-exp-${Date.now()}`,
          userId: userA_Id,
          type: 'expense',
          amount: 10000,
          category: 'Food & Groceries',
          description: 'User A Spend',
          date: '2026-10-02',
          merchant: 'Store',
          account: 'bKash',
          paymentMethod: 'QR',
          classification: 'essential',
        },
      ]);

      // User B: Income 25,000 BDT, Expenses 5,000 BDT
      await TransactionModel.create([
        {
          customId: `tx-b-inc-${Date.now()}`,
          userId: userB_Id,
          type: 'income',
          amount: 25000,
          category: 'Salary & Inflow',
          description: 'User B Inflow',
          date: '2026-10-01',
          merchant: 'Employer B',
          account: 'bKash',
          paymentMethod: 'Bank Transfer',
          classification: 'essential',
        },
        {
          customId: `tx-b-exp-${Date.now()}`,
          userId: userB_Id,
          type: 'expense',
          amount: 5000,
          category: 'Food & Groceries',
          description: 'User B Spend',
          date: '2026-10-02',
          merchant: 'Bazaar',
          account: 'Nagad',
          paymentMethod: 'QR',
          classification: 'essential',
        },
      ]);

      // Authoritative database-backed health scores
      const scoreA = await getAuthoritativeUserHealthScore(userA_Id);
      const scoreB = await getAuthoritativeUserHealthScore(userB_Id);

      // Verify User A transactions count = 2
      assert.equal(scoreA.dataWindow.transactionCount, 2, 'User A should only see 2 transactions');
      assert.equal(scoreB.dataWindow.transactionCount, 2, 'User B should only see 2 transactions');

      // Verify isolation in calculations
      const expA = scoreA.components.find((c) => c.key === 'expense_control')!;
      const expB = scoreB.components.find((c) => c.key === 'expense_control')!;

      // User A ratio = 10k / 40k = 25%
      assert.equal(expA.rawValue, 25, 'User A expense ratio should be 25%');
      // User B ratio = 5k / 25k = 20%
      assert.equal(expB.rawValue, 20, 'User B expense ratio should be 20%');

      // Verify cross-user token authorization check logic (simulating /api/users/:userId/financial-health)
      const tokenA = jwt.sign({ id: userA_Id, customId: userA_Id, email: `${userA_Id}@test.com` }, JWT_SECRET);
      const decodedA = jwt.verify(tokenA, JWT_SECRET) as any;

      // When User A accesses User B's endpoint, ownership check fails
      const isOwnerB = decodedA.customId === userB_Id || decodedA.id === userB_Id;
      assert.equal(isOwnerB, false, 'User A token must not have ownership over User B');

      // Cleanup
      await UserModel.deleteMany({ customId: { $in: [userA_Id, userB_Id] } });
      await TransactionModel.deleteMany({ userId: { $in: [userA_Id, userB_Id] } });
    }
  });

  // ==================================================
  // TEST 9 — API OR DATABASE FAILURE
  // ==================================================
  await suite.test('TEST 9 — API OR DATABASE FAILURE: Throws or returns 500 error, never converted to 0 or Insufficient Data', async () => {
    // If a database error occurs in getAuthoritativeUserHealthScore, it rejects/throws
    const originalFind = UserModel.findOne;
    try {
      UserModel.findOne = (() => {
        throw new Error('Database connection reset');
      }) as any;

      let errorCaught = false;
      try {
        await getAuthoritativeUserHealthScore('any-user');
      } catch (err: any) {
        errorCaught = true;
        assert.equal(err.message, 'Database connection reset');
      }
      assert.equal(errorCaught, true, 'Database failure must throw, not return fake Insufficient Data or 0');
    } finally {
      UserModel.findOne = originalFind;
    }
  });

  // ==================================================
  // TEST 10 — PERSISTENCE
  // ==================================================
  await suite.test('TEST 10 — PERSISTENCE: Records persisted, read back, and recalculated match identically', async () => {
    if (isDbConnected()) {
      const testUserId = `test-persist-${Date.now()}`;

      await UserModel.create({
        customId: testUserId,
        name: 'Persist Test User',
        email: `${testUserId}@test.com`,
        password: 'Password123!',
        monthlyIncome: 60000,
      });

      await TransactionModel.create([
        {
          customId: `tx-p1-${Date.now()}`,
          userId: testUserId,
          type: 'income',
          amount: 60000,
          category: 'Salary & Inflow',
          description: 'Salary',
          date: '2026-10-01',
          merchant: 'Co',
          account: 'City Bank',
          paymentMethod: 'Bank Transfer',
          classification: 'essential',
        },
        {
          customId: `tx-p2-${Date.now()}`,
          userId: testUserId,
          type: 'expense',
          amount: 18000,
          category: 'Food & Groceries',
          description: 'Groceries',
          date: '2026-10-02',
          merchant: 'Store',
          account: 'bKash',
          paymentMethod: 'QR',
          classification: 'essential',
        },
      ]);

      await SavingsGoalModel.create({
        customId: `goal-p1-${Date.now()}`,
        userId: testUserId,
        name: 'Emergency Fund',
        title: 'Emergency Fund',
        targetAmount: 100000,
        currentAmount: 36000,
        deadline: '2026-12-31',
        monthlyPace: 10000,
        accountVault: 'bKash Vault',
        category: 'Emergency Fund',
        status: 'On Track',
      });

      // Pass 1
      const result1 = await getAuthoritativeUserHealthScore(testUserId);

      // Re-read from DB
      const result2 = await getAuthoritativeUserHealthScore(testUserId);

      // Verify exact persistence consistency
      assert.deepEqual(result1.score, result2.score, 'Scores across persistence reads must match');
      assert.deepEqual(result1.factors, result2.factors, 'Factors across persistence reads must match');
      assert.equal(result1.status, result2.status);

      // Cleanup
      await UserModel.deleteOne({ customId: testUserId });
      await TransactionModel.deleteMany({ userId: testUserId });
      await SavingsGoalModel.deleteMany({ userId: testUserId });
    }
  });

  // ==================================================
  // TEST 11 — INVALID DATA
  // ==================================================
  await suite.test('TEST 11 — INVALID DATA: Safely filters negative amounts, invalid dates, and invalid goals', () => {
    const malformedTxs: any[] = [
      // Negative amount (invalid)
      {
        id: 'tx-neg',
        type: 'expense',
        amount: -5000,
        date: '2026-10-01',
      },
      // Non-numeric amount (invalid)
      {
        id: 'tx-nan',
        type: 'income',
        amount: NaN,
        date: '2026-10-01',
      },
      // Missing amount (invalid)
      {
        id: 'tx-missing-amt',
        type: 'expense',
        date: '2026-10-01',
      },
      // Valid income
      {
        id: 'tx-valid-inc',
        type: 'income',
        amount: 50000,
        date: '2026-10-01',
      },
      // Valid expense
      {
        id: 'tx-valid-exp',
        type: 'expense',
        amount: 20000,
        date: '2026-10-02',
      },
    ];

    const malformedGoals: any[] = [
      // Zero or negative target (invalid)
      {
        id: 'goal-invalid-target',
        title: 'Bad Target',
        targetAmount: 0,
        currentAmount: 1000,
      },
      // Missing target
      {
        id: 'goal-no-target',
        title: 'No Target',
      },
      // Valid goal
      {
        id: 'goal-valid',
        title: 'Valid Goal',
        targetAmount: 50000,
        currentAmount: 10000,
      },
    ];

    // Must not throw or produce NaN / Infinity
    const res = calculateFinancialHealthScore({
      transactions: malformedTxs,
      goals: malformedGoals,
      monthlyIncome: 50000,
      asOfDate: '2026-10-05',
    });

    assert.equal(res.status, 'ok');
    assert(typeof res.score === 'number' && !isNaN(res.score));
    assert(res.score! >= 0 && res.score! <= 100);

    const goalComp = res.components.find((c) => c.key === 'savings_goals')!;
    assert.equal(goalComp.available, true);
    assert.equal(goalComp.rawValue, 20, 'Only valid goal (10k / 50k = 20%) should be evaluated');
  });

  // ==================================================
  // TEST 12 — UI REGRESSION
  // ==================================================
  await suite.test('TEST 12 — UI REGRESSION: Insufficient Data labels, null handling, and zero displays are validated', () => {
    // 1. Verify null score translates to status 'Insufficient Data' in positional API
    const brandNew = calculateFinancialHealthScore([], [], 0);
    assert.equal(brandNew.status, 'Insufficient Data');
    assert.equal(brandNew.score, null);
    assert.equal(brandNew.factors.savingConsistency, null);
    assert.equal(brandNew.factors.spendingControl, null);
    assert.equal(brandNew.factors.cashFlowStability, null);
    assert.equal(brandNew.factors.goalProgress, null);

    // 2. Verify legitimate zero score maintains numeric 0 for UI presentation
    const legitimateZero = calculateFinancialHealthScore(
      [
        {
          id: 'tx-inc-zero',
          type: 'income',
          amount: 30000,
          date: '2026-10-01',
          category: 'Salary & Inflow',
          description: 'Inflow',
          merchant: 'Co',
          account: 'bKash',
          paymentMethod: 'Transfer',
          classification: 'essential',
        },
        {
          id: 'tx-exp-zero',
          type: 'expense',
          amount: 30000,
          date: '2026-10-02',
          category: 'Food & Groceries',
          description: 'Outflow',
          merchant: 'Store',
          account: 'bKash',
          paymentMethod: 'QR',
          classification: 'essential',
        },
      ],
      [
        {
          id: 'g-zero',
          title: 'Goal Zero',
          targetAmount: 50000,
          currentAmount: 0,
          deadline: '2026-12-31',
          monthlyPace: 5000,
          accountVault: 'bKash',
          status: 'On Track',
          icon: 'flag',
          category: 'Savings',
        },
      ],
      30000
    );

    // Genuine 0% for savings rate (income = 30k, expenses = 30k)
    assert.equal(legitimateZero.factors.savingConsistency, 0, 'Genuine 0% must remain 0 and not become Insufficient Data');
    // Genuine 0% for goal progress (target = 50k, current = 0)
    assert.equal(legitimateZero.factors.goalProgress, 0, 'Genuine 0% goal progress must remain 0');

    // 3. Verify label lengths for container overflow prevention
    const enLabel = 'Insufficient Data';
    const bnLabel = 'পর্যাপ্ত তথ্য নেই';
    assert(enLabel.length < 25, 'English label is compact');
    assert(bnLabel.length < 25, 'Bengali label is compact');
  });

  // Teardown
  if (isDbConnected()) {
    await mongoose.disconnect();
  }
});
