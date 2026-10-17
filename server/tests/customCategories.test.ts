import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {
  calculateMonthlyOverview,
  calculateCategorySpending,
  validateFinancialData,
} from '../../src/services/financialCalculations';
import { Transaction, CustomCategory } from '../../src/types/financial';
import { CategoryModel } from '../models/Category';
import { TransactionModel } from '../models/Transaction';
import { UserModel } from '../models/User';
import { connectDB, isDbConnected } from '../config/database';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';
const API_BASE = 'http://localhost:3000';

function makeAuthToken(userId: string, email: string) {
  return jwt.sign(
    {
      id: userId,
      customId: userId,
      email,
      name: 'Test Runner User',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

test('Custom Expense Categories Full Test Suite (Phases 1-16)', async (suite) => {
  await connectDB();

  const testUserAId = 'usr-test-cat-a';
  const testUserBId = 'usr-test-cat-b';
  const testEmailA = 'test-a@arthobachao.ai';
  const testEmailB = 'test-b@arthobachao.ai';

  const tokenA = makeAuthToken(testUserAId, testEmailA);
  const tokenB = makeAuthToken(testUserBId, testEmailB);

  // Setup test users in MongoDB if not existing
  if (isDbConnected()) {
    await UserModel.updateOne(
      { customId: testUserAId },
      {
        $set: {
          customId: testUserAId,
          name: 'Test User A',
          email: testEmailA,
          monthlyIncome: 50000,
          currency: '৳',
        },
      },
      { upsert: true }
    );

    await UserModel.updateOne(
      { customId: testUserBId },
      {
        $set: {
          customId: testUserBId,
          name: 'Test User B',
          email: testEmailB,
          monthlyIncome: 60000,
          currency: '৳',
        },
      },
      { upsert: true }
    );

    // Clean up previous test categories and transactions for test users
    await CategoryModel.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await TransactionModel.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  }

  let createdCategoryAId: string = '';

  await suite.test('TEST 1: CREATE CATEGORY - Create "Healthcare" and verify MongoDB persistence', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserAId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Healthcare', type: 'expense' }),
    });

    assert.equal(res.status, 201, 'Should return HTTP 201 Created');
    const data = await res.json();
    assert.equal(data.name, 'Healthcare');
    assert.equal(data.userId, testUserAId);
    assert.equal(data.type, 'expense');
    assert.ok(data.id || data.customId, 'Should return unique category ID');
    createdCategoryAId = data.id || data.customId;

    // Verify GET endpoint returns it
    const getRes = await fetch(`${API_BASE}/api/users/${testUserAId}/categories`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getRes.status, 200);
    const getCats = await getRes.json();
    assert.ok(Array.isArray(getCats));
    assert.ok(getCats.some((c: any) => c.name === 'Healthcare'));
  });

  await suite.test('TEST 2: DUPLICATE CATEGORY - Reject case-insensitive duplicate "healthcare"', async () => {
    const dupRes = await fetch(`${API_BASE}/api/users/${testUserAId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'healthcare', type: 'expense' }),
    });

    assert.equal(dupRes.status, 409, 'Duplicate creation should return HTTP 409 Conflict');
    const err = await dupRes.json();
    assert.ok(err.error?.toLowerCase().includes('already exists'), 'Error message should indicate already exists');
  });

  await suite.test('TEST 3: USER ISOLATION - User B only receives own categories', async () => {
    // Create a category for User B
    const resB = await fetch(`${API_BASE}/api/users/${testUserBId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Education', type: 'expense' }),
    });
    assert.equal(resB.status, 201);

    // Fetch categories for User B
    const getResB = await fetch(`${API_BASE}/api/users/${testUserBId}/categories`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const catsB = await getResB.json();
    assert.ok(catsB.some((c: any) => c.name === 'Education'));
    assert.ok(!catsB.some((c: any) => c.name === 'Healthcare'), 'User B must NOT see User A Healthcare category');

    // Attempt User B trying to access User A's categories
    const unauthorizedRes = await fetch(`${API_BASE}/api/users/${testUserAId}/categories`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(unauthorizedRes.status, 403, 'User B accessing User A categories must be rejected with 403');
  });

  await suite.test('TEST 4: ADD TRANSACTION - Create Healthcare expense of ৳1,200', async () => {
    const newTx: Partial<Transaction> = {
      id: `tx-test-${Date.now()}`,
      userId: testUserAId,
      date: '2026-10-10',
      type: 'expense',
      category: 'Healthcare',
      amount: 1200,
      merchant: 'Square Hospitals',
      description: 'Prescription & consult',
      account: 'bKash',
      paymentMethod: 'bKash QR Direct',
      classification: 'essential',
    };

    const res = await fetch(`${API_BASE}/api/users/${testUserAId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(newTx),
    });

    assert.equal(res.status, 201, 'Transaction creation should return 201');
    const createdTx = await res.json();
    assert.equal(createdTx.category, 'Healthcare');
    assert.equal(createdTx.amount, 1200);
  });

  await suite.test('TEST 5: DASHBOARD AGGREGATION - Healthcare ৳1,200 displays 100%', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-10-10',
        type: 'expense',
        category: 'Healthcare',
        amount: 1200,
        merchant: 'Square Hospitals',
        description: 'Healthcare',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    assert.equal(overview.totalExpenses, 1200);

    const healthcare = overview.categories.find((c) => c.category === 'Healthcare');
    assert.ok(healthcare, 'Healthcare category must appear in monthly overview categories');
    assert.equal(healthcare.amount, 1200);
    assert.equal(healthcare.percentage, 100);
    assert.equal(overview.largestCategory.category, 'Healthcare');
    assert.equal(overview.largestCategory.amount, 1200);
  });

  await suite.test('TEST 6: MULTIPLE CATEGORIES - Healthcare ৳1,200 (60%) and Food & Groceries ৳800 (40%)', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-10-10',
        type: 'expense',
        category: 'Healthcare',
        amount: 1200,
        merchant: 'Square Hospitals',
        description: 'Doctor consultation',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
      {
        id: 'tx-2',
        date: '2026-10-11',
        type: 'expense',
        category: 'Food & Groceries',
        amount: 800,
        merchant: 'Shwapno Super Shop',
        description: 'Weekly fruits & grocery',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'discretionary',
      },
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    assert.equal(overview.totalExpenses, 2000);

    const healthcare = overview.categories.find((c) => c.category === 'Healthcare');
    const food = overview.categories.find((c) => c.category === 'Food & Groceries');

    assert.ok(healthcare, 'Healthcare category must be present');
    assert.ok(food, 'Food & Groceries must be present');
    assert.equal(healthcare.amount, 1200);
    assert.equal(healthcare.percentage, 60);
    assert.equal(food.amount, 800);
    assert.equal(food.percentage, 40);

    // Dynamic Category spending calculation
    const spendingList = calculateCategorySpending(txs, '2026-10');
    const spHealth = spendingList.find((s) => s.category === 'Healthcare');
    const spFood = spendingList.find((s) => s.category === 'Food & Groceries');
    assert.equal(spHealth?.amount, 1200);
    assert.equal(spHealth?.percentage, 60);
    assert.equal(spFood?.amount, 800);
    assert.equal(spFood?.percentage, 40);
  });

  await suite.test('TEST 7: EDIT TRANSACTION - Change Healthcare from ৳1,200 to ৳1,500', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-10-10',
        type: 'expense',
        category: 'Healthcare',
        amount: 1500, // Updated amount
        merchant: 'Square Hospitals',
        description: 'Doctor consultation',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
      {
        id: 'tx-2',
        date: '2026-10-11',
        type: 'expense',
        category: 'Food & Groceries',
        amount: 800,
        merchant: 'Shwapno',
        description: 'Grocery',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'discretionary',
      },
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    assert.equal(overview.totalExpenses, 2300);

    const healthcare = overview.categories.find((c) => c.category === 'Healthcare');
    const food = overview.categories.find((c) => c.category === 'Food & Groceries');

    assert.equal(healthcare?.amount, 1500);
    assert.equal(healthcare?.percentage, 65.2);
    assert.equal(food?.amount, 800);
    assert.equal(food?.percentage, 34.8);
  });

  await suite.test('TEST 8: CHANGE CATEGORY - Move expense from Healthcare to Transportation', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-10-10',
        type: 'expense',
        category: 'Transportation', // Moved to Transportation
        amount: 1200,
        merchant: 'Uber Rides',
        description: 'Ride fare',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
      {
        id: 'tx-2',
        date: '2026-10-11',
        type: 'expense',
        category: 'Food & Groceries',
        amount: 800,
        merchant: 'Shwapno',
        description: 'Grocery',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'discretionary',
      },
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    const healthcare = overview.categories.find((c) => c.category === 'Healthcare');
    const transport = overview.categories.find((c) => c.category === 'Transportation');

    assert.equal(healthcare?.amount || 0, 0, 'Healthcare should now have 0 expense');
    assert.equal(transport?.amount, 1200, 'Transportation should reflect ৳1,200');
    assert.equal(transport?.percentage, 60);
  });

  await suite.test('TEST 9: DELETE TRANSACTION - Delete custom-category transaction updates totals', () => {
    // Starting with Healthcare ৳1,200 and Food ৳800, then deleting Healthcare
    const txsAfterDelete: Transaction[] = [
      {
        id: 'tx-2',
        date: '2026-10-11',
        type: 'expense',
        category: 'Food & Groceries',
        amount: 800,
        merchant: 'Shwapno',
        description: 'Grocery',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'discretionary',
      },
    ];

    const overview = calculateMonthlyOverview(txsAfterDelete, '2026-10');
    assert.equal(overview.totalExpenses, 800);
    const healthcare = overview.categories.find((c) => c.category === 'Healthcare');
    assert.equal(healthcare?.amount || 0, 0);

    const food = overview.categories.find((c) => c.category === 'Food & Groceries');
    assert.equal(food?.amount, 800);
    assert.equal(food?.percentage, 100);
  });

  await suite.test('TEST 10: MONTHLY FILTER - Expenses isolated to specific month', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-oct',
        date: '2026-10-10',
        type: 'expense',
        category: 'Healthcare',
        amount: 1200,
        merchant: 'Hospital Oct',
        description: 'October Consult',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
      {
        id: 'tx-sep',
        date: '2026-09-15',
        type: 'expense',
        category: 'Healthcare',
        amount: 2500,
        merchant: 'Hospital Sep',
        description: 'September Consult',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
    ];

    const octOverview = calculateMonthlyOverview(txs, '2026-10');
    assert.equal(octOverview.totalExpenses, 1200);
    const octHealth = octOverview.categories.find((c) => c.category === 'Healthcare');
    assert.equal(octHealth?.amount, 1200);

    const sepOverview = calculateMonthlyOverview(txs, '2026-09');
    assert.equal(sepOverview.totalExpenses, 2500);
    const sepHealth = sepOverview.categories.find((c) => c.category === 'Healthcare');
    assert.equal(sepHealth?.amount, 2500);
  });

  await suite.test('TEST 11: INCOME EXCLUSION - Income does not increase expense totals', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-income',
        date: '2026-10-01',
        type: 'income',
        category: 'Salary & Inflow',
        amount: 50000,
        merchant: 'Company Corp',
        description: 'Monthly Salary',
        account: 'City Bank',
        paymentMethod: 'Direct Deposit',
        classification: 'essential',
      },
      {
        id: 'tx-expense',
        date: '2026-10-05',
        type: 'expense',
        category: 'Healthcare',
        amount: 1200,
        merchant: 'Square Hospitals',
        description: 'Checkup',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    assert.equal(overview.totalIncome, 50000);
    assert.equal(overview.totalExpenses, 1200, 'Income must NOT be added to expenses');
    assert.equal(overview.netSavings, 48800);

    const health = overview.categories.find((c) => c.category === 'Healthcare');
    assert.equal(health?.percentage, 100, 'Healthcare percentage should be 100% of expense, not income');
  });

  await suite.test('TEST 12: BUILT-IN COMPATIBILITY - All 6 standard categories remain functional', () => {
    const txs: Transaction[] = [
      { id: '1', date: '2026-10-01', type: 'expense', category: 'Food & Groceries', amount: 1000, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'essential' },
      { id: '2', date: '2026-10-02', type: 'expense', category: 'Shopping & Gadgets', amount: 500, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'discretionary' },
      { id: '3', date: '2026-10-03', type: 'expense', category: 'Utility & Fixed Costs', amount: 1500, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'essential' },
      { id: '4', date: '2026-10-04', type: 'expense', category: 'Transportation', amount: 300, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'essential' },
      { id: '5', date: '2026-10-05', type: 'expense', category: 'Cash-out & Bank Fees', amount: 200, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'anomalies' },
      { id: '6', date: '2026-10-06', type: 'expense', category: 'Entertainment & Others', amount: 500, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'discretionary' },
      { id: '7', date: '2026-10-07', type: 'expense', category: 'Healthcare', amount: 1000, merchant: 'M', description: 'D', account: 'bKash', paymentMethod: 'P', classification: 'essential' },
    ];

    const overview = calculateMonthlyOverview(txs, '2026-10');
    assert.equal(overview.totalExpenses, 5000);
    assert.equal(overview.categories.length, 7);

    // Mathematical balance check
    const report = validateFinancialData(txs, [], '2026-10');
    assert.equal(report.isCategorySumEqualExpenses, true, 'Category sum must balance total expenses exactly');
    assert.equal(report.categorySum, 5000);
    assert.equal(report.totalExpenses, 5000);
  });

  await suite.test('TEST 13: PERSISTENCE - Category remains available across sessions', async () => {
    // Generate a fresh session token representing sign-out / sign-in
    const newSessionToken = makeAuthToken(testUserAId, testEmailA);
    const res = await fetch(`${API_BASE}/api/users/${testUserAId}/categories`, {
      headers: { Authorization: `Bearer ${newSessionToken}` },
    });
    assert.equal(res.status, 200);
    const categories = await res.json();
    const found = categories.find((c: any) => c.name === 'Healthcare');
    assert.ok(found, 'Healthcare category must persist across fresh session requests');
  });

  await suite.test('TEST 14: ZERO EXPENSES - Empty dataset does not produce NaN or Infinity', () => {
    const emptyTxs: Transaction[] = [];
    const overview = calculateMonthlyOverview(emptyTxs, '2026-10');

    assert.equal(overview.totalExpenses, 0);
    assert.equal(overview.totalIncome, 0);
    assert.equal(overview.netSavings, 0);
    assert.equal(overview.savingsRate, 0);
    assert.ok(!isNaN(overview.savingsRate));
    assert.ok(isFinite(overview.savingsRate));

    overview.categories.forEach((cat) => {
      assert.ok(!isNaN(cat.amount));
      assert.ok(!isNaN(cat.percentage));
      assert.ok(isFinite(cat.amount));
      assert.ok(isFinite(cat.percentage));
      assert.equal(cat.percentage, 0);
    });

    const report = validateFinancialData(emptyTxs, [], '2026-10');
    assert.equal(report.isCategorySumEqualExpenses, true);
    assert.equal(report.isValid, true);
    assert.equal(report.savingsRate, 0);
  });

  await suite.test('TEST 15: HISTORICAL TRANSACTIONS - Historical reports preserve custom category names', () => {
    const historicalTxs: Transaction[] = [
      {
        id: 'hist-1',
        date: '2026-08-14',
        type: 'expense',
        category: 'Old Archived Category',
        amount: 2200,
        merchant: 'Historic Vendor',
        description: 'Archived project expense',
        account: 'bKash',
        paymentMethod: 'Direct',
        classification: 'essential',
      },
    ];

    const overview = calculateMonthlyOverview(historicalTxs, '2026-08');
    assert.equal(overview.totalExpenses, 2200);
    const archivedCat = overview.categories.find((c) => c.category === 'Old Archived Category');
    assert.ok(archivedCat, 'Archived category name must be preserved in historical calculation overview');
    assert.equal(archivedCat.amount, 2200);
    assert.equal(archivedCat.percentage, 100);
  });

  await suite.test('TEST 16: DELETE CATEGORY SAFETY - Block deletion if in-use, allow if unused', async () => {
    // 1. Healthcare is currently used by a transaction in User A's ledger (created in TEST 4)
    const inUseDeleteRes = await fetch(
      `${API_BASE}/api/users/${testUserAId}/categories/${createdCategoryAId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );

    assert.equal(
      inUseDeleteRes.status,
      400,
      'Deletion of in-use category must return HTTP 400 Bad Request to protect historical records'
    );
    const inUseErr = await inUseDeleteRes.json();
    assert.ok(inUseErr.error.includes('used by'), 'Error should specify category is in use by transactions');

    // 2. Create an unused category and delete it safely
    const createUnusedRes = await fetch(`${API_BASE}/api/users/${testUserAId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Temporary Unused', type: 'expense' }),
    });
    assert.equal(createUnusedRes.status, 201);
    const unusedCat = await createUnusedRes.json();

    const deleteUnusedRes = await fetch(
      `${API_BASE}/api/users/${testUserAId}/categories/${unusedCat.id || unusedCat.customId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.equal(deleteUnusedRes.status, 200, 'Unused category should be deleted successfully with 200');
    const deleteSuccess = await deleteUnusedRes.json();
    assert.equal(deleteSuccess.success, true);
  });

  // Cleanup test users after tests
  if (isDbConnected()) {
    await CategoryModel.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await TransactionModel.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await UserModel.deleteMany({ customId: { $in: [testUserAId, testUserBId] } });
  }
});
