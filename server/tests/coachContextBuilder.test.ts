import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/database';
import { TransactionModel } from '../models/Transaction';
import { SavingsGoalModel } from '../models/SavingsGoal';
import { UserModel } from '../models/User';
import { buildCoachContext } from '../services/coachContextBuilder';

describe('buildCoachContext Database & Data-Isolation Tests', () => {
  const userA_Id = 'test_user_coach_A_1001';
  const userB_Id = 'test_user_coach_B_1002';

  before(async () => {
    await connectDB();

    // Clean up test users
    await TransactionModel.deleteMany({ userId: { $in: [userA_Id, userB_Id] } });
    await SavingsGoalModel.deleteMany({ userId: { $in: [userA_Id, userB_Id] } });
    await UserModel.deleteMany({ customId: { $in: [userA_Id, userB_Id] } });

    // Seed User A
    await UserModel.create({
      customId: userA_Id,
      name: 'User A Secret Name',
      email: 'usera.secret@example.com',
      linkedAccounts: [
        { name: 'bKash', balance: 15000, accountNumber: '01700000001', type: 'MFS' },
        { name: 'City Bank', balance: 25000, accountNumber: '11000000001', type: 'Bank' },
      ],
      monthlyIncome: 40000,
    });

    // Seed User A Transactions:
    // Income: ৳40,000
    // Expense Food: ৳6,000
    // Expense Shopping: ৳4,000
    // Transfer: ৳5,000 (MUST BE EXCLUDED from income/expenses!)
    // Cash-out: ৳2,000 with ৳37 fee
    await TransactionModel.create([
      {
        customId: 'tx-a-inc',
        userId: userA_Id,
        type: 'income',
        amount: 40000,
        category: 'Salary & Inflow',
        description: 'Monthly Salary',
        date: '2026-10-01',
      },
      {
        customId: 'tx-a-food',
        userId: userA_Id,
        type: 'expense',
        amount: 6000,
        category: 'Food & Groceries',
        description: 'Shwapno Supermarket Grocery Shopping',
        date: '2026-10-02',
      },
      {
        customId: 'tx-a-shop',
        userId: userA_Id,
        type: 'expense',
        amount: 4000,
        category: 'Shopping & Gadgets',
        description: 'Daraz Shopping Voucher',
        date: '2026-10-03',
      },
      {
        customId: 'tx-a-transfer',
        userId: userA_Id,
        type: 'transfer',
        amount: 5000,
        category: 'Savings & Investment',
        description: 'Fund transfer from bKash to City Bank',
        date: '2026-10-04',
      },
      {
        customId: 'tx-a-cashout',
        userId: userA_Id,
        type: 'expense',
        amount: 2000,
        category: 'Cash-out & Bank Fees',
        description: 'bKash Agent Cash-out',
        fee: 37,
        date: '2026-10-05',
      },
    ]);

    // Seed User A Goal: Target ৳60,000, Saved ৳30,000
    await SavingsGoalModel.create({
      customId: 'goal-a-1',
      userId: userA_Id,
      name: 'Hajj Savings',
      title: 'Hajj Savings',
      targetAmount: 60000,
      currentAmount: 30000,
      deadline: '2027-01-01',
    });

    // Seed User B (Different User)
    await UserModel.create({
      customId: userB_Id,
      name: 'User B Completely Different',
      email: 'userb.confidential@example.com',
      linkedAccounts: [{ name: 'Nagad', balance: 5000, accountNumber: '01800000002', type: 'MFS' }],
      monthlyIncome: 15000,
    });

    // Seed User B Transactions: Income ৳15,000, Expense ৳7,000
    await TransactionModel.create([
      {
        customId: 'tx-b-inc',
        userId: userB_Id,
        type: 'income',
        amount: 15000,
        category: 'Salary & Inflow',
        description: 'User B Salary',
        date: '2026-10-01',
      },
      {
        customId: 'tx-b-exp',
        userId: userB_Id,
        type: 'expense',
        amount: 7000,
        category: 'Entertainment & Others',
        description: 'Concert & Outing',
        date: '2026-10-03',
      },
    ]);
  });

  after(async () => {
    await TransactionModel.deleteMany({ userId: { $in: [userA_Id, userB_Id] } });
    await SavingsGoalModel.deleteMany({ userId: { $in: [userA_Id, userB_Id] } });
    await UserModel.deleteMany({ customId: { $in: [userA_Id, userB_Id] } });
    await disconnectDB();
  });

  it('should calculate correct totals for User A and exclude transfers', async () => {
    const ctxA = await buildCoachContext(userA_Id);

    // Total income should be ৳40,000
    assert.strictEqual(ctxA.snapshot.monthlyIncome, 40000, 'Income should be 40000');
    // Total expenses should be 6000 + 4000 + 2000 = ৳12,000 (transfer of 5000 MUST be excluded!)
    assert.strictEqual(ctxA.snapshot.monthlySpending, 12000, 'Expenses should be exactly 12000 (transfers excluded)');
    // Net savings: 40000 - 12000 = ৳28,000
    assert.strictEqual(ctxA.snapshot.netSavings, 28000, 'Net savings should be 28000');
    // Savings rate: (28000 / 40000) * 100 = 70%
    assert.strictEqual(ctxA.snapshot.savingsRate, 70, 'Savings rate should be 70%');
    // Current balance: 15000 + 25000 = ৳40,000
    assert.strictEqual(ctxA.snapshot.currentBalance, 40000, 'Current balance should match linkedAccounts sum');
  });

  it('should strictly isolate User B data from User A context', async () => {
    const ctxA = await buildCoachContext(userA_Id);
    const ctxB = await buildCoachContext(userB_Id);

    // User A should NOT have User B expenses
    assert.strictEqual(ctxA.snapshot.monthlyIncome, 40000);
    assert.strictEqual(ctxB.snapshot.monthlyIncome, 15000);

    assert.strictEqual(ctxA.snapshot.monthlySpending, 12000);
    assert.strictEqual(ctxB.snapshot.monthlySpending, 7000);

    assert.strictEqual(ctxA.spending.topCategory?.category, 'Food & Groceries');
    assert.strictEqual(ctxB.spending.topCategory?.category, 'Entertainment & Others');

    assert.strictEqual(ctxA.goals.totalGoals, 1);
    assert.strictEqual(ctxB.goals.totalGoals, 0);
  });

  it('should strip all PII (names, emails, IDs) from the context', async () => {
    const ctxA = await buildCoachContext(userA_Id);
    const ctxJson = JSON.stringify(ctxA);

    assert.ok(!ctxJson.includes('User A Secret Name'), 'Name must not appear in context');
    assert.ok(!ctxJson.includes('usera.secret@example.com'), 'Email must not appear in context');
    assert.ok(!ctxJson.includes(userA_Id), 'User ID must not appear in context');
    assert.ok(!ctxJson.includes('User B Completely Different'), 'Other user name must not appear');
  });

  it('should truncate and sanitize transaction descriptions to max 40 chars', async () => {
    const ctxA = await buildCoachContext(userA_Id);
    for (const tx of ctxA.recentTransactions) {
      if (tx.description) {
        assert.ok(tx.description.length <= 40, `Description "${tx.description}" exceeds 40 chars`);
      }
    }
  });
});
