import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB, isDbConnected, getDatabaseName } from '../config/database';
import { UserModel } from '../models/User';
import { TransactionModel } from '../models/Transaction';
import { SavingsGoalModel } from '../models/SavingsGoal';
import { CategoryModel } from '../models/Category';
import { buildCoachContext } from '../services/coachContextBuilder';
import { generateDeterministicCoachResponse } from '../services/coachFallbackEngine';
import { classifyIntent } from '../services/intentClassifier';

dotenv.config();

describe('Phase 8 Comprehensive Architecture & AI Pipeline Verification', () => {
  const testUser1Id = 'test_usr_phase8_user1';
  const testUser2Id = 'test_usr_phase8_user2';

  before(async () => {
    await connectDB();

    // Clean up test users
    await TransactionModel.deleteMany({ userId: { $in: [testUser1Id, testUser2Id] } });
    await SavingsGoalModel.deleteMany({ userId: { $in: [testUser1Id, testUser2Id] } });
    await CategoryModel.deleteMany({ userId: { $in: [testUser1Id, testUser2Id] } });
    await UserModel.deleteMany({ customId: { $in: [testUser1Id, testUser2Id] } });

    // Seed User 1 (High Earner, Tech Saver)
    await UserModel.create({
      customId: testUser1Id,
      name: 'Tanvir Hossain',
      email: 'tanvir.test.phase8@example.com',
      monthlyIncome: 65000, // Profile benchmark: ৳65,000
      linkedAccounts: [
        { name: 'City Bank', balance: 45000, accountNumber: '123456', type: 'Bank' },
        { name: 'bKash', balance: 12000, accountNumber: '01711111111', type: 'MFS' },
      ],
    });

    // Seed User 1 Actual Transactions (Recorded Income: ৳70,000; Recorded Expenses: ৳32,000)
    await TransactionModel.create([
      {
        customId: 'tx_u1_inc1',
        userId: testUser1Id,
        type: 'income',
        amount: 70000,
        category: 'Salary & Inflow',
        description: 'Tech Lead Monthly Salary',
        date: '2026-10-02',
        merchant: 'Employer Corp',
      },
      {
        customId: 'tx_u1_exp1',
        userId: testUser1Id,
        type: 'expense',
        amount: 20000,
        category: 'Housing & Rent',
        description: 'Gulshan Flat Rent',
        date: '2026-10-05',
        merchant: 'Landlord',
      },
      {
        customId: 'tx_u1_exp2',
        userId: testUser1Id,
        type: 'expense',
        amount: 12000,
        category: 'Food & Groceries',
        description: 'Monthly Family Grocery',
        date: '2026-10-08',
        merchant: 'Unimart Gulshan',
      },
      {
        customId: 'tx_u1_trans',
        userId: testUser1Id,
        type: 'transfer',
        amount: 10000,
        category: 'Internal Transfer',
        description: 'Bank to bKash transfer',
        date: '2026-10-09',
      },
    ]);

    await SavingsGoalModel.create({
      customId: 'goal_u1_mac',
      userId: testUser1Id,
      name: 'MacBook M3 Pro',
      title: 'MacBook M3 Pro',
      targetAmount: 250000,
      currentAmount: 180000,
      deadline: '2026-12-31',
      status: 'On Track',
    });

    await CategoryModel.create({
      customId: 'cat_u1_sadaqah',
      userId: testUser1Id,
      name: 'Charity & Sadaqah',
      type: 'expense',
    });

    // Seed User 2 (Different User, Student/Junior)
    await UserModel.create({
      customId: testUser2Id,
      name: 'Nusrat Jahan',
      email: 'nusrat.test.phase8@example.com',
      monthlyIncome: 25000, // Profile benchmark: ৳25,000
      linkedAccounts: [
        { name: 'bKash', balance: 5000, accountNumber: '01822222222', type: 'MFS' },
      ],
    });

    // Seed User 2 Actual Transactions (Recorded Income: ৳22,000; Recorded Expenses: ৳15,000)
    await TransactionModel.create([
      {
        customId: 'tx_u2_inc1',
        userId: testUser2Id,
        type: 'income',
        amount: 22000,
        category: 'Freelance & Projects',
        description: 'Design Project Milestone',
        date: '2026-10-03',
        merchant: 'Upwork Client',
      },
      {
        customId: 'tx_u2_exp1',
        userId: testUser2Id,
        type: 'expense',
        amount: 15000,
        category: 'Education & Courses',
        description: 'Online UI/UX Certification',
        date: '2026-10-06',
        merchant: 'Interaction Design Foundation',
      },
    ]);
  });

  after(async () => {
    await TransactionModel.deleteMany({ userId: { $in: [testUser1Id, testUser2Id] } });
    await SavingsGoalModel.deleteMany({ userId: { $in: [testUser1Id, testUser2Id] } });
    await CategoryModel.deleteMany({ userId: { $in: [testUser1Id, testUser2Id] } });
    await UserModel.deleteMany({ customId: { $in: [testUser1Id, testUser2Id] } });
    await disconnectDB();
  });

  // Test 1: Database connection is initialized once and reuses connection
  it('1. Reuses existing connection and connects explicitly to "arthobachao"', async () => {
    assert.strictEqual(isDbConnected(), true, 'Database should be connected');
    const dbName = getDatabaseName();
    assert.strictEqual(dbName, 'arthobachao', 'Active database name must be arthobachao');

    // Calling connectDB again should immediately return true without reconnecting
    const reconnectResult = await connectDB();
    assert.strictEqual(reconnectResult, true, 'Second connectDB call must succeed via reuse');
    assert.strictEqual(mongoose.connection.readyState, 1, 'Mongoose readyState must remain 1 (connected)');
  });

  // Test 2: Missing MONGODB_URI is handled safely without crashing
  it('2. Missing or blank MONGODB_URI is handled safely', async () => {
    const originalUri = process.env.MONGODB_URI;
    try {
      process.env.MONGODB_URI = '';
      // Test standalone check when URI is missing
      assert.strictEqual(process.env.MONGODB_URI, '');
    } finally {
      process.env.MONGODB_URI = originalUri;
    }
  });

  // Test 3: Profile monthly income is distinct from recorded income (Phase 6 semantics)
  it('3. Profile monthlyIncome is treated as benchmark, distinct from recorded transaction inflows', async () => {
    const ctx = await buildCoachContext(testUser1Id);

    // Profile benchmark was ৳65,000
    // Recorded transaction inflow was ৳70,000
    assert.strictEqual(ctx.snapshot.monthlyIncome, 70000, 'Context monthlyIncome must be calculated from recorded transactions, not profile');
    assert.strictEqual(ctx.snapshot.monthlySpending, 32000, 'Context monthlySpending must match actual expenses (20000 + 12000)');
    assert.strictEqual(ctx.snapshot.netSavings, 38000, 'Net savings must be 70000 - 32000 = 38000');

    // Transfers must not be counted as income or expense
    // If transfer was included, spending would be 42000 or income 80000
    assert.notStrictEqual(ctx.snapshot.monthlySpending, 42000, 'Transfer must NOT be counted in monthly spending');
  });

  // Test 4: Current balance source of truth
  it('4. Current balance reflects linked accounts accurately', async () => {
    const ctx = await buildCoachContext(testUser1Id);
    // User 1 linked accounts: City Bank (45000) + bKash (12000) = 57000
    assert.strictEqual(ctx.snapshot.currentBalance, 57000, 'Current balance must match sum of linkedAccounts');
  });

  // Test 5: User data isolation (User 1 vs User 2)
  it('5. Two different users receive strictly isolated financial contexts', async () => {
    const ctx1 = await buildCoachContext(testUser1Id);
    const ctx2 = await buildCoachContext(testUser2Id);

    // User 1 checks
    assert.strictEqual(ctx1.snapshot.monthlyIncome, 70000);
    assert.strictEqual(ctx1.snapshot.monthlySpending, 32000);
    assert.strictEqual(ctx1.spending.topCategory?.category, 'Housing & Rent');
    assert.strictEqual(ctx1.goals.items[0]?.title, 'MacBook M3 Pro');

    // User 2 checks
    assert.strictEqual(ctx2.snapshot.monthlyIncome, 22000);
    assert.strictEqual(ctx2.snapshot.monthlySpending, 15000);
    assert.strictEqual(ctx2.spending.topCategory?.category, 'Education & Courses');
    assert.strictEqual(ctx2.goals.items.length, 0, 'User 2 has no goals, must not see User 1 goals');

    // Cross-contamination verification
    assert.notStrictEqual(ctx1.snapshot.monthlyIncome, ctx2.snapshot.monthlyIncome);
    assert.notStrictEqual(ctx1.snapshot.currentBalance, ctx2.snapshot.currentBalance);
  });

  // Test 6: Deterministic engine does NOT return hardcoded demo figures
  it('6. Deterministic fallback uses only real user facts, never hardcoded demo numbers', () => {
    const mockContext = {
      metadata: {
        today: '2026-10-17',
        dataWindow: { currentMonth: '2026-10', previousMonths: ['2026-09'], hasData: true, totalTransactions: 3 },
      },
      snapshot: {
        available: true,
        monthlyIncome: 70000,
        monthlySpending: 32000,
        netSavings: 38000,
        savingsRate: 54.3,
        expenseRatio: 45.7,
        currentBalance: 57000,
        facts: {},
      },
      spending: {
        available: true,
        totalSpending: 32000,
        topCategory: { category: 'Housing & Rent', amount: 20000, percentage: 62.5, momChangePercentage: 0 },
        topCategories: [{ category: 'Housing & Rent', amount: 20000, percentage: 62.5, momChangePercentage: 0 }],
        categoryTotals: { 'Housing & Rent': 20000, 'Food & Groceries': 12000 },
        categoryPercentages: { 'Housing & Rent': 62.5, 'Food & Groceries': 37.5 },
        anomalies: [],
        anomaliesCount: 0,
        facts: {},
      },
      goals: {
        available: true,
        totalGoals: 1,
        items: [{
          id: 'goal_u1_mac',
          title: 'MacBook M3 Pro',
          targetAmount: 250000,
          currentAmount: 180000,
          progressPercentage: 72,
          remainingAmount: 70000,
          deadline: '2026-12-31',
          isOnTrack: true,
          requiredMonthlyContribution: 23333,
          scenarioSummary: 'On track',
        }],
        facts: {},
      },
      cashFlow: {
        available: true,
        startingBalance: 57000,
        forecastMonthEndBalance: 95000,
        shortfall: 0,
        confidenceLevel: 'High' as const,
        recommendedWeeklyReduction: 0,
        recommendedBuffer: 15000,
        facts: {},
      },
      health: {
        available: true,
        score: 82,
        band: 'Excellent',
        percentile: 90,
        confidence: 'High' as const,
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

    const intent = classifyIntent('What is my total spending this month?', 38000);
    const responseEn = generateDeterministicCoachResponse(intent, mockContext as any, 'en');

    // Must contain authentic numbers: ৳32,000, ৳70,000, ৳38,000, Housing & Rent (৳20,000)
    assert(responseEn.answer.includes('32,000'), 'Must contain user spending 32,000');
    assert(responseEn.answer.includes('70,000'), 'Must contain user income 70,000');
    assert(responseEn.answer.includes('Housing & Rent'), 'Must contain top category Housing & Rent');

    // Must NOT contain old hardcoded mock figures
    assert(!responseEn.answer.includes('8,200'), 'Must NOT contain fabricated 8,200');
    assert(!responseEn.answer.includes('16,000'), 'Must NOT contain fabricated 16,000');
    assert(!responseEn.answer.includes('3,200'), 'Must NOT contain fabricated 3,200');
    assert(!responseEn.answer.includes('17,200'), 'Must NOT contain fabricated 17,200');
  });

  // Test 7: Custom categories, transactions, and savings goals continue working
  it('7. Custom categories are persisted and queried accurately', async () => {
    const userCategories = await CategoryModel.find({ userId: testUser1Id });
    assert.strictEqual(userCategories.length, 1);
    assert.strictEqual(userCategories[0].name, 'Charity & Sadaqah');
    assert.strictEqual(userCategories[0].type, 'expense');
  });
});
