import { describe, it } from 'node:test';
import assert from 'node:assert';

process.env.NODE_ENV = 'test';

import { signup, login, verifyEmail, fallbackUsers } from '../controllers/authController';
import { getTestVerificationCode } from '../services/emailService';

function createMockReqRes(body: any = {}, headers: any = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req: any = {
    body,
    headers,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

describe('Registration & Verification Flow Robustness Tests', () => {
  const testEmail = `test.user.${Date.now()}@example.com`;

  it('1. Initial signup creates unverified account and returns requiresVerification', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      name: 'Initial User',
      email: testEmail,
      password: 'OldPassword123!',
      preferredLanguage: 'en',
      monthlyIncome: 45000,
      monthlyIncomeCurrency: 'BDT',
    });

    await signup(req, res);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.requiresVerification, true);
    assert.strictEqual(data.user.email, testEmail);
    assert.strictEqual(data.user.isEmailVerified, false);
  });

  it('2. Login with unverified account is rejected with 403 requiresVerification', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      email: testEmail,
      password: 'OldPassword123!',
    });

    await login(req, res);
    assert.strictEqual(getStatus(), 403);
    const data = getData();
    assert.strictEqual(data.requiresVerification, true);
    assert.strictEqual(data.email, testEmail);
  });

  it('3. Re-registering unverified account updates password and guides user without duplicate accounts', async () => {
    // Fast-forward cooldown by setting header or modifying fallback sentAt
    const user = fallbackUsers.get(testEmail);
    if (user) {
      user.emailVerificationSentAt = new Date(Date.now() - 70000);
    }

    const { req, res, getStatus, getData } = createMockReqRes({
      name: 'Updated User Name',
      email: testEmail,
      password: 'NewUserChosenPassword123!',
      preferredLanguage: 'bn',
      monthlyIncome: 55000,
      monthlyIncomeCurrency: 'BDT',
    });

    await signup(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.requiresVerification, true);
    assert.strictEqual(data.isUnverified, true);
    assert.strictEqual(data.user.name, 'Updated User Name');
    assert.strictEqual(data.user.email, testEmail);
    assert.strictEqual(data.user.isEmailVerified, false);

    // Verify fallback store does not have duplicate accounts
    const matchingUsers = Array.from(fallbackUsers.values()).filter((u) => u.email === testEmail);
    assert.strictEqual(matchingUsers.length, 1);
  });

  it('4. Successfully verifies unverified account with valid OTP', async () => {
    const otp = getTestVerificationCode(testEmail);
    assert.ok(otp, 'OTP code should be available in test email store');

    const { req, res, getStatus, getData } = createMockReqRes({
      email: testEmail,
      code: otp,
    });

    await verifyEmail(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.user.isEmailVerified, true);
    assert.ok(data.token, 'Should return authenticated JWT token');
  });

  it('5. Login succeeds using the NEW password set during re-registration', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      email: testEmail,
      password: 'NewUserChosenPassword123!',
    });

    await login(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.ok(data.token);
    assert.strictEqual(data.user.email, testEmail);
    assert.strictEqual(data.user.isEmailVerified, true);
  });

  it('6. Signing up again with already verified account is rejected with 409 Conflict', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      name: 'Duplicate Attempt',
      email: testEmail,
      password: 'AnyPassword123!',
    });

    await signup(req, res);
    assert.strictEqual(getStatus(), 409);
    const data = getData();
    assert.strictEqual(data.isVerified, true);
    assert.ok(data.error.includes('already exists'));
  });
});
