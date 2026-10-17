import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {
  calculateMonthlyOverview,
  calculateCategorySpending,
  validateFinancialData,
} from '../../src/services/financialCalculations';
import { Transaction } from '../../src/types/financial';
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
      name: 'Merchant Test Runner',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

test('Conditional Merchant / Counterparty Validation Test Suite', async (suite) => {
  await connectDB();

  const testUserId = 'usr-test-merchant-user';
  const testEmail = 'merchant-test@arthobachao.ai';
  const token = makeAuthToken(testUserId, testEmail);

  if (isDbConnected()) {
    await UserModel.updateOne(
      { customId: testUserId },
      {
        $set: {
          customId: testUserId,
          name: 'Merchant Test User',
          email: testEmail,
          monthlyIncome: 65000,
          currency: '৳',
        },
      },
      { upsert: true }
    );
    await TransactionModel.deleteMany({ userId: testUserId });
  }

  // TEST 1: Expense with valid merchant -> should save
  await suite.test('TEST 1: Expense with merchant should save (201)', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        amount: 1500,
        category: 'Food & Groceries',
        merchant: 'Shwapno Superstore',
        description: 'Weekly grocery basket',
        date: '2026-10-17',
        account: 'bKash',
      }),
    });

    assert.equal(res.status, 201, 'Valid expense with merchant should return 201');
    const data = await res.json();
    assert.equal(data.merchant, 'Shwapno Superstore');
    assert.equal(data.type, 'expense');
    assert.equal(data.amount, 1500);
  });

  // TEST 2: Expense with empty merchant -> should be rejected (400)
  await suite.test('TEST 2: Expense with empty merchant should be rejected (400)', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        amount: 800,
        category: 'Food & Groceries',
        merchant: '',
        description: 'Lunch takeaway',
        date: '2026-10-17',
        account: 'bKash',
      }),
    });

    assert.equal(res.status, 400, 'Expense with empty merchant should return 400');
    const data = await res.json();
    assert.ok(data.error, 'Error message should be returned');
    assert.match(data.error, /merchant.*required/i);
  });

  // TEST 3: Expense with whitespace-only merchant -> should be rejected (400)
  await suite.test('TEST 3: Expense with whitespace-only merchant should be rejected (400)', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        amount: 450,
        category: 'Transportation',
        merchant: '   ',
        description: 'Rickshaw ride',
        date: '2026-10-17',
        account: 'bKash',
      }),
    });

    assert.equal(res.status, 400, 'Expense with whitespace-only merchant should return 400');
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /merchant.*required/i);
  });

  // TEST 4: Expense without merchant field provided -> should be rejected (400)
  await suite.test('TEST 4: Expense without merchant property should be rejected (400)', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        amount: 1200,
        category: 'Shopping & Gadgets',
        description: 'New wireless mouse',
        date: '2026-10-17',
        account: 'City Bank',
      }),
    });

    assert.equal(res.status, 400, 'Expense missing merchant property should return 400');
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /merchant.*required/i);
  });

  // TEST 5: Income with merchant -> should save (201)
  await suite.test('TEST 5: Income with merchant should save (201)', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'income',
        amount: 50000,
        category: 'Salary & Inflow',
        merchant: 'Software Tech Ltd.',
        description: 'Monthly Salary Credit',
        date: '2026-10-01',
        account: 'City Bank',
      }),
    });

    assert.equal(res.status, 201, 'Income with merchant should return 201');
    const data = await res.json();
    assert.equal(data.merchant, 'Software Tech Ltd.');
    assert.equal(data.type, 'income');
  });

  // TEST 6: Income without merchant (or empty) -> should save (201)
  let savedIncomeTxId = '';
  await suite.test('TEST 6: Income with empty or missing merchant should save (201)', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'income',
        amount: 8000,
        category: 'Salary & Inflow',
        merchant: '',
        description: 'Freelance consulting',
        date: '2026-10-05',
        account: 'bKash',
      }),
    });

    assert.equal(res.status, 201, 'Income with empty merchant should return 201');
    const data = await res.json();
    assert.equal(data.merchant, '');
    assert.equal(data.type, 'income');
    assert.equal(data.amount, 8000);
    savedIncomeTxId = data.id || data.customId || data._id;
  });

  // TEST 7: Switching Income to Expense without merchant -> update rejected (400)
  await suite.test('TEST 7: Switching Income to Expense without merchant returns 400', async () => {
    assert.ok(savedIncomeTxId, 'Need saved income transaction ID');
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions/${savedIncomeTxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        merchant: '',
      }),
    });

    assert.equal(res.status, 400, 'Switching to expense without merchant must return 400');
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /merchant.*required/i);
  });

  // TEST 8: Switching Income to Expense with valid merchant -> update succeeds (200)
  await suite.test('TEST 8: Switching Income to Expense with valid merchant succeeds (200)', async () => {
    assert.ok(savedIncomeTxId);
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions/${savedIncomeTxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        category: 'Shopping & Gadgets',
        merchant: 'Star Tech BD',
      }),
    });

    assert.equal(res.status, 200, 'Switching to expense with merchant should return 200');
    const data = await res.json();
    assert.equal(data.type, 'expense');
    assert.equal(data.merchant, 'Star Tech BD');
  });

  // TEST 9: Switching Expense to Income with empty merchant -> update succeeds (200)
  await suite.test('TEST 9: Switching Expense to Income allows empty merchant (200)', async () => {
    assert.ok(savedIncomeTxId);
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions/${savedIncomeTxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'income',
        category: 'Salary & Inflow',
        merchant: '',
      }),
    });

    assert.equal(res.status, 200, 'Switching back to income should allow empty merchant');
    const data = await res.json();
    assert.equal(data.type, 'income');
    assert.equal(data.merchant, '');
  });

  // TEST 10: Historical Expense Transaction with missing merchant
  await suite.test('TEST 10: Historical expense with missing merchant can be opened and corrected', async () => {
    const historicalCustomId = `tx-hist-no-merchant-${Date.now()}`;
    if (isDbConnected()) {
      // Seed a historical record directly in MongoDB without merchant
      await TransactionModel.collection.insertOne({
        customId: historicalCustomId,
        userId: testUserId,
        type: 'expense',
        amount: 2200,
        category: 'Food & Groceries',
        description: 'Old historical grocery run',
        date: '2026-09-15',
        merchant: '',
        account: 'bKash',
        createdAt: new Date('2026-09-15'),
      });
    }

    // 1. Fetching transactions should include the historical transaction
    const getRes = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.status, 200);
    const allTxs = await getRes.json();
    const historicalTx = allTxs.find((t: any) => t.customId === historicalCustomId || t.id === historicalCustomId);
    assert.ok(historicalTx, 'Historical transaction should be queryable');
    assert.equal(historicalTx.merchant, '', 'Historical transaction merchant should be empty');

    // 2. Updating without correcting merchant should be rejected (400)
    const badUpdateRes = await fetch(`${API_BASE}/api/users/${testUserId}/transactions/${historicalCustomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: 2500,
        merchant: '',
      }),
    });
    assert.equal(badUpdateRes.status, 400, 'Updating expense without merchant must return 400');

    // 3. Updating and correcting merchant should succeed (200)
    const goodUpdateRes = await fetch(`${API_BASE}/api/users/${testUserId}/transactions/${historicalCustomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: 2500,
        merchant: 'Unimart Gulshan',
      }),
    });
    assert.equal(goodUpdateRes.status, 200, 'Correcting merchant should return 200');
    const correctedData = await goodUpdateRes.json();
    assert.equal(correctedData.merchant, 'Unimart Gulshan');
    assert.equal(correctedData.amount, 2500);
  });

  // TEST 11: Unrelated operations (transfer) unaffected
  await suite.test('TEST 11: Transfer transaction works without requiring merchant', async () => {
    const res = await fetch(`${API_BASE}/api/users/${testUserId}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'transfer',
        amount: 3000,
        category: 'Savings & Investment',
        description: 'Vault deposit',
        date: '2026-10-17',
        account: 'bKash',
      }),
    });

    assert.equal(res.status, 201, 'Transfer transaction should succeed with 201');
    const data = await res.json();
    assert.equal(data.type, 'transfer');
  });

  // TEST 12: Financial calculations integrity
  await suite.test('TEST 12: Financial calculations remain accurate with optional income merchants', () => {
    const sampleTxs: Transaction[] = [
      {
        id: 'tx-calc-1',
        date: '2026-10-01',
        type: 'income',
        category: 'Salary & Inflow',
        amount: 50000,
        description: 'Salary',
        merchant: '', // empty merchant
        account: 'City Bank',
        paymentMethod: 'Bank Transfer',
        classification: 'essential',
      },
      {
        id: 'tx-calc-2',
        date: '2026-10-05',
        type: 'expense',
        category: 'Food & Groceries',
        amount: 15000,
        description: 'Food',
        merchant: 'Shwapno',
        account: 'bKash',
        paymentMethod: 'bKash QR',
        classification: 'essential',
      },
    ];

    const overview = calculateMonthlyOverview(sampleTxs, '2026-10');
    assert.equal(overview.totalIncome, 50000);
    assert.equal(overview.totalExpenses, 15000);
    assert.equal(overview.netSavings, 35000);
    assert.equal(overview.savingsRate, 70);
  });

  // Cleanup test user transactions
  if (isDbConnected()) {
    await TransactionModel.deleteMany({ userId: testUserId });
    await UserModel.deleteMany({ customId: testUserId });
  }
});
