import assert from 'node:assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { connectDB, disconnectDB } from '../config/database';
import { UserModel } from '../models/User';
import { TransactionModel } from '../models/Transaction';

dotenv.config();

async function runLiveVerification() {
  await connectDB();
  const testUserId = 'test_live_http_user_99';

  try {
    // Clean up previous runs
    await TransactionModel.deleteMany({ userId: testUserId });
    await UserModel.deleteMany({ customId: testUserId });

    // Seed test user with authentic transactions
    const user = await UserModel.create({
      customId: testUserId,
      name: 'Dr. Shahabuddin',
      email: 'dr.shahab@example.com',
      monthlyIncome: 80000,
      linkedAccounts: [
        { name: 'City Bank Priority', balance: 125000, accountNumber: '99887766', type: 'Bank' },
      ],
    });

    await TransactionModel.create([
      {
        customId: 'tx_dr_1',
        userId: testUserId,
        type: 'income',
        amount: 80000,
        category: 'Consultation & Inflow',
        description: 'Hospital Consultation Fee',
        date: '2026-10-04',
        merchant: 'Square Hospital',
      },
      {
        customId: 'tx_dr_2',
        userId: testUserId,
        type: 'expense',
        amount: 25000,
        category: 'Medical Equipment',
        description: 'Stethoscope & Diagnostic Kit',
        date: '2026-10-07',
        merchant: 'BioMed Supplies',
      },
      {
        customId: 'tx_dr_3',
        userId: testUserId,
        type: 'expense',
        amount: 8500,
        category: 'Food & Groceries',
        description: 'Weekly Organic Groceries',
        date: '2026-10-10',
        merchant: 'Dhaka Organics',
      },
    ]);

    // Create JWT token
    const jwtSecret = process.env.JWT_SECRET || 'finmate_jwt_secret_dev_key_2026';
    const token = jwt.sign(
      { id: user._id.toString(), customId: testUserId, email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '1h' }
    );

    console.log('[Live Verification] 1. Testing authenticated request without client financialContext...');
    const response1 = await fetch('http://localhost:3000/api/ai/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: 'What is my total spending this month?',
        language: 'en',
      }),
    });

    assert.strictEqual(response1.status, 200, `Expected 200, got ${response1.status}`);
    const data1 = await response1.json();
    console.log('[Live Verification] Response 1 received:', JSON.stringify(data1, null, 2));

    const totalSpending = 25000 + 8500; // 33,500
    assert(data1.answer.includes('33,500'), `Answer must contain authentic spending ৳33,500: ${data1.answer}`);
    assert(!data1.answer.includes('8,200'), 'Must NOT contain fake 8,200');
    assert(!data1.answer.includes('16,000'), 'Must NOT contain fake 16,000');
    assert(!data1.answer.includes('3,200'), 'Must NOT contain fake 3,200');

    console.log('[Live Verification] 2. Testing attempted client financialContext override...');
    // Attempt to inject a fake client financialContext with ৳999,999 spending
    const response2 = await fetch('http://localhost:3000/api/ai/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: 'What is my total spending this month?',
        language: 'en',
        financialContext: {
          monthlySpending: 999999,
          monthlyIncome: 111111,
          categories: [{ category: 'Fake Category', amount: 999999, percentage: 100 }],
        },
      }),
    });

    assert.strictEqual(response2.status, 200, `Expected 200, got ${response2.status}`);
    const data2 = await response2.json();
    console.log('[Live Verification] Response 2 received (with client injection attempt):', data2.answer);

    // Verify client-supplied financial totals CANNOT override MongoDB data
    assert(!data2.answer.includes('999,999'), 'Client override must be COMPLETELY IGNORED!');
    assert(!data2.answer.includes('Fake Category'), 'Fake client category must be COMPLETELY IGNORED!');
    assert(data2.answer.includes('33,500'), 'Must still use authentic MongoDB spending ৳33,500!');

    console.log('\n[PASS] All Live HTTP Verifications Passed Perfectly!');
  } finally {
    await TransactionModel.deleteMany({ userId: testUserId });
    await UserModel.deleteMany({ customId: testUserId });
    await disconnectDB();
  }
}

runLiveVerification().catch((err) => {
  console.error('[FAIL] Verification error:', err);
  process.exit(1);
});
