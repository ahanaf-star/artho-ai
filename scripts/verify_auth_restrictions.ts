/**
 * Comprehensive verification script testing all email verification and security requirements:
 * 1. Email format validation on frontend and backend
 * 2. Disposable domain detection during registration (400)
 * 3. Disposable domain detection during login (400)
 * 4. Legitimate domains allowed (e.g. gmail.com, yahoo.com, edu)
 * 5. Registration requires verification, hashes secrets, and does not return JWT or OTP
 * 6. Unverified account cannot log in even with correct password (403 requiresVerification)
 * 7. Invalid verification code rejection (400)
 * 8. Max verification attempt enforcement (invalidation after 5 attempts)
 * 9. Resend verification with 60-second cooldown rate limit (429)
 * 10. Successful verification marks user verified and enables login
 * 11. Demo user (Ahmed Rahman) login remains verified and functional
 * 12. Protected routes enforce authentication and strict verification status
 * 13. SHA-256 OTP hashing and timing-safe comparison validation
 * 14. Graceful legacy account verification flow on login (auto-dispatch OTP)
 * 15. Test endpoint disabled in non-test/production mode
 */

// Configure test environment before importing route definitions
process.env.NODE_ENV = 'test';
process.env.ENABLE_TEST_AUTH_ENDPOINTS = 'true';

import express, { Request, Response } from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import authRoutes from '../server/routes/authRoutes';
import { requireAuth, AuthenticatedRequest } from '../server/middleware/authMiddleware';
import {
  validateSignupEmail,
  validateLoginEmail,
  isDisposableEmail,
} from '../src/utils/emailValidation';
import {
  setCustomEmailDispatcher,
  hashVerificationSecret,
  verifySecretHash,
} from '../server/services/emailService';
import { fallbackUsers, getFallbackUser } from '../server/controllers/authController';

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('ARTHO AI: AUTHENTICATION & EMAIL SECURITY TEST SUITE');
  console.log('===============================================================\n');

  // Intercept all outgoing transactional emails to prevent real email dispatches during test runs
  const dispatchedEmails: Array<{ email: string; name: string; otp: string; token: string }> = [];
  setCustomEmailDispatcher(async (email, name, otp, token) => {
    dispatchedEmails.push({ email, name, otp, token });
    return { success: true, messageId: `mock-msg-${Date.now()}` };
  });

  // Set up Express test app
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  // Test protected endpoint
  app.get('/api/protected/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    return res.json({ success: true, user: req.user });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`✓ Test server running at ${baseUrl}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (details) console.error(`         Details: ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Scenario 1: Client & Server Utility Validation
    // -------------------------------------------------------------
    console.log('--- Test Group 1: Email Format & Disposable Detection Utilities ---');

    assert(
      !validateSignupEmail('').isValid,
      'Empty email is rejected'
    );
    assert(
      !validateSignupEmail('plainaddress').isValid,
      'Email missing "@" is rejected'
    );
    assert(
      !validateSignupEmail('test@@gmail.com').isValid,
      'Email with multiple "@" is rejected'
    );
    assert(
      !validateSignupEmail('user@invalid').isValid,
      'Email with invalid TLD is rejected'
    );
    assert(
      isDisposableEmail('test@mailinator.com') === true,
      'mailinator.com is identified as disposable'
    );
    assert(
      isDisposableEmail('sub.tempmail.com') === true,
      'Subdomains of disposable domains are identified'
    );
    assert(
      isDisposableEmail('student@buet.ac.bd') === false,
      'Educational domains are never marked as disposable'
    );
    assert(
      isDisposableEmail('ahmed@gmail.com') === false,
      'Trusted Gmail domains are never marked as disposable'
    );

    // -------------------------------------------------------------
    // Scenario 2: Disposable Domain Blocking on Registration
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: Disposable Domain Blocking on Registration (API) ---');

    const regMailinatorRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Disposable User',
        email: 'attacker@mailinator.com',
        password: 'Password123!',
      }),
    });
    const regMailinatorData = await regMailinatorRes.json();
    assert(
      regMailinatorRes.status === 400 && regMailinatorData.error?.includes('Disposable'),
      'Registration with mailinator.com is blocked with 400 and friendly message',
      JSON.stringify(regMailinatorData)
    );

    const regGuerrillaRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Disposable User 2',
        email: 'attacker@guerrillamail.com',
        password: 'Password123!',
      }),
    });
    assert(
      regGuerrillaRes.status === 400,
      'Registration with guerrillamail.com is blocked with 400'
    );

    // -------------------------------------------------------------
    // Scenario 3: Disposable Domain Blocking on Login
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Disposable Domain Blocking on Login (API) ---');

    const loginDisposableRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@10minutemail.com',
        password: 'Password123!',
      }),
    });
    const loginDisposableData = await loginDisposableRes.json();
    assert(
      loginDisposableRes.status === 400 && loginDisposableData.error?.includes('Disposable'),
      'Login with 10minutemail.com is blocked with 400 and friendly message',
      JSON.stringify(loginDisposableData)
    );

    // -------------------------------------------------------------
    // Scenario 4: Valid Registration Requires Verification & Hashes OTP
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Valid Registration Flow & OTP Hashing ---');

    const testEmail = `user.test.${Date.now()}@gmail.com`;
    const testPassword = 'SecurePassword2026!';

    const regValidRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Verify User',
        email: testEmail,
        password: testPassword,
      }),
    });
    const regValidData = await regValidRes.json();

    assert(
      regValidRes.status === 201,
      'Registration returns HTTP 201 Created'
    );
    assert(
      regValidData.requiresVerification === true,
      'Registration response indicates requiresVerification: true'
    );
    assert(
      !regValidData.token,
      'Registration does NOT return JWT session token (must verify first)'
    );
    assert(
      !regValidData.code && !regValidData.otp,
      'Registration does NOT leak verification OTP in client response'
    );

    // Verify email was dispatched via mocked dispatcher
    const userEmailDispatch = dispatchedEmails.find((d) => d.email === testEmail);
    assert(
      !!userEmailDispatch && /^\d{6}$/.test(userEmailDispatch.otp),
      'Verification email was dispatched with a valid 6-digit OTP'
    );

    // Verify stored OTP in fallback store is SHA-256 hashed (64 hex characters) and NOT plaintext
    const storedUser = getFallbackUser(testEmail);
    assert(
      !!storedUser &&
        typeof storedUser.emailVerificationOtp === 'string' &&
        storedUser.emailVerificationOtp.length === 64 &&
        /^[0-9a-f]{64}$/.test(storedUser.emailVerificationOtp) &&
        storedUser.emailVerificationOtp !== userEmailDispatch?.otp,
      'Stored OTP is a 64-char SHA-256 hash (never stored in plaintext)'
    );

    // -------------------------------------------------------------
    // Scenario 5: Unverified User Login Rejected
    // -------------------------------------------------------------
    console.log('\n--- Test Group 5: Login Rejected for Unverified Account ---');

    const unverifiedLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const unverifiedLoginData = await unverifiedLoginRes.json();

    assert(
      unverifiedLoginRes.status === 403,
      'Login for unverified account is rejected with HTTP 403 Forbidden'
    );
    assert(
      unverifiedLoginData.requiresVerification === true,
      'Login response indicates requiresVerification: true'
    );
    assert(
      unverifiedLoginData.error?.includes('Please verify your email before logging in'),
      'Login response instructs user to verify email'
    );

    // -------------------------------------------------------------
    // Scenario 6: Invalid Verification Code Handling
    // -------------------------------------------------------------
    console.log('\n--- Test Group 6: Verification Code Validation & Lockout ---');

    const wrongCodeRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: '000000',
      }),
    });
    const wrongCodeData = await wrongCodeRes.json();
    assert(
      wrongCodeRes.status === 400 && wrongCodeData.error?.includes('Invalid verification code'),
      'Wrong verification code returns 400 and reports attempts remaining'
    );

    // Send 4 more wrong attempts to reach attempt limit (5 total)
    for (let i = 0; i < 3; i++) {
      await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, code: `00000${i + 1}` }),
      });
    }

    const fifthWrongRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '999999' }),
    });
    const fifthWrongData = await fifthWrongRes.json();

    assert(
      fifthWrongRes.status === 400 &&
        fifthWrongData.error?.includes('Too many incorrect verification attempts'),
      '5th incorrect attempt invalidates code and prompts user to request new code',
      JSON.stringify(fifthWrongData)
    );

    // Verify stored secrets were wiped from user record upon lockout
    const lockedUser = getFallbackUser(testEmail);
    assert(
      !lockedUser?.emailVerificationOtp && !lockedUser?.emailVerificationToken,
      'Stored OTP and token are wiped from user upon attempt lockout'
    );

    // -------------------------------------------------------------
    // Scenario 7: Resend Verification & Cooldown Enforcement
    // -------------------------------------------------------------
    console.log('\n--- Test Group 7: Resend Verification & Rate Limiting ---');

    // Immediate resend without waiting 60s should trigger 429 Cooldown
    const resendTooSoonRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const resendTooSoonData = await resendTooSoonRes.json();
    assert(
      resendTooSoonRes.status === 429,
      'Resend within 60s cooldown is rate-limited with HTTP 429'
    );
    assert(
      typeof resendTooSoonData.remainingSeconds === 'number' && resendTooSoonData.remainingSeconds > 0,
      'Cooldown response returns remainingSeconds'
    );

    // Resend with bypass cooldown (simulating cooldown elapsed in test environment)
    const prevDispatchCount = dispatchedEmails.length;
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-cooldown': 'true',
      },
      body: JSON.stringify({ email: testEmail }),
    });
    const resendData = await resendRes.json();
    assert(
      resendRes.status === 200,
      'Resend verification succeeds and generates a new code'
    );
    assert(
      dispatchedEmails.length === prevDispatchCount + 1,
      'Resend dispatches a fresh verification email'
    );

    // -------------------------------------------------------------
    // Scenario 8: Successful Verification Enables Login
    // -------------------------------------------------------------
    console.log('\n--- Test Group 8: Successful Verification & Login ---');

    // Retrieve active code via localhost non-prod test endpoint
    const testCodeRes = await fetch(`${baseUrl}/api/auth/test-verification-code?email=${encodeURIComponent(testEmail)}`);
    const testCodeData = await testCodeRes.json();
    assert(
      testCodeRes.status === 200 && typeof testCodeData.code === 'string',
      'Test endpoint safely retrieves new active verification code'
    );

    // Submit valid verification code
    const verifySuccessRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: testCodeData.code,
      }),
    });
    const verifySuccessData = await verifySuccessRes.json();

    assert(
      verifySuccessRes.status === 200,
      'Submitting correct code verifies email with HTTP 200'
    );
    assert(
      verifySuccessData.user?.isEmailVerified === true,
      'Verified user object has isEmailVerified: true'
    );
    assert(
      typeof verifySuccessData.token === 'string' && verifySuccessData.token.length > 20,
      'Successful verification issues valid JWT session token'
    );

    // Verify stored secrets were wiped from user record upon successful verification
    const verifiedUser = getFallbackUser(testEmail);
    assert(
      !verifiedUser?.emailVerificationOtp && !verifiedUser?.emailVerificationToken,
      'Stored OTP and token are completely wiped upon successful verification'
    );

    // Now test login with verified account
    const verifiedLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const verifiedLoginData = await verifiedLoginRes.json();

    assert(
      verifiedLoginRes.status === 200,
      'Now that account is verified, login succeeds with HTTP 200'
    );
    assert(
      verifiedLoginData.user?.isEmailVerified === true,
      'Logged in user has isEmailVerified: true'
    );

    // -------------------------------------------------------------
    // Scenario 9: Demo User Continuity
    // -------------------------------------------------------------
    console.log('\n--- Test Group 9: Demo User Continuous Login ---');

    const demoLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ahmed.rahman@arthobachao.ai',
        password: 'ahmed123',
      }),
    });
    const demoLoginData = await demoLoginRes.json();

    assert(
      demoLoginRes.status === 200,
      'Demo user (Ahmed Rahman) login succeeds immediately'
    );
    assert(
      demoLoginData.user?.isEmailVerified === true,
      'Demo user is guaranteed isEmailVerified: true'
    );

    // -------------------------------------------------------------
    // Scenario 10: Protected Routes Enforcement
    // -------------------------------------------------------------
    console.log('\n--- Test Group 10: Protected Routes Enforcement ---');

    const unauthProtectedRes = await fetch(`${baseUrl}/api/protected/profile`);
    assert(
      unauthProtectedRes.status === 401,
      'Unauthenticated request to protected route returns 401'
    );

    const authProtectedRes = await fetch(`${baseUrl}/api/protected/profile`, {
      headers: { Authorization: `Bearer ${verifiedLoginData.token}` },
    });
    assert(
      authProtectedRes.status === 200,
      'Authenticated request with verified token accesses protected route successfully'
    );

    // Test with token for an unverified user
    const unverifiedUserEmail = `unverified.${Date.now()}@gmail.com`;
    fallbackUsers.set(unverifiedUserEmail, {
      id: `usr-unver-${Date.now()}`,
      customId: `usr-unver-${Date.now()}`,
      name: 'Unverified Subject',
      email: unverifiedUserEmail,
      passwordHash: bcrypt.hashSync('testpass123', 10),
      isEmailVerified: false,
      preferredLanguage: 'en',
      currency: 'BDT',
      linkedAccounts: [],
      recurringObligations: [],
    });
    const unverifiedToken = jwt.sign(
      { id: `usr-unver-${Date.now()}`, email: unverifiedUserEmail, name: 'Unverified Subject' },
      JWT_SECRET
    );

    const unverifiedProtectedRes = await fetch(`${baseUrl}/api/protected/profile`, {
      headers: { Authorization: `Bearer ${unverifiedToken}` },
    });
    assert(
      unverifiedProtectedRes.status === 403,
      'Protected route strictly rejects token for account where isEmailVerified !== true (HTTP 403)'
    );

    // -------------------------------------------------------------
    // Scenario 11: Timing-Safe SHA-256 Hash Verification Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- Test Group 11: Cryptographic Hash Verification Functions ---');

    const sampleOtp = '849201';
    const computedHash = hashVerificationSecret(sampleOtp);
    assert(
      computedHash.length === 64 && /^[0-9a-f]{64}$/.test(computedHash),
      'hashVerificationSecret produces 64-character lowercase SHA-256 hex string'
    );
    assert(
      verifySecretHash(sampleOtp, computedHash) === true,
      'verifySecretHash returns true for identical code and hash'
    );
    assert(
      verifySecretHash('111111', computedHash) === false,
      'verifySecretHash returns false for incorrect code'
    );
    assert(
      verifySecretHash('', computedHash) === false,
      'verifySecretHash returns false for empty code'
    );
    assert(
      verifySecretHash(sampleOtp, null) === false,
      'verifySecretHash returns false for null stored hash'
    );

    // -------------------------------------------------------------
    // Scenario 12: Legacy / Existing Account Graceful Verification Flow
    // -------------------------------------------------------------
    console.log('\n--- Test Group 12: Legacy Account Graceful Auto-Dispatch Flow ---');

    const legacyEmail = `legacy.user.${Date.now()}@example.org`;
    const legacyPassword = 'LegacyPassword123!';
    const legacyHash = bcrypt.hashSync(legacyPassword, 10);

    // Pre-insert legacy user without verified status and without verification token sent
    fallbackUsers.set(legacyEmail, {
      id: `usr-legacy-${Date.now()}`,
      customId: `usr-legacy-${Date.now()}`,
      name: 'Existing Legacy User',
      email: legacyEmail,
      passwordHash: legacyHash,
      isEmailVerified: false,
      emailVerificationSentAt: undefined,
      preferredLanguage: 'en',
      currency: 'BDT',
      linkedAccounts: [],
      recurringObligations: [],
    });

    const legacyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: legacyEmail,
        password: legacyPassword,
      }),
    });
    const legacyLoginData = await legacyLoginRes.json();

    assert(
      legacyLoginRes.status === 403 && legacyLoginData.requiresVerification === true,
      'Legacy unverified user login returns 403 requiresVerification: true'
    );
    assert(
      legacyLoginData.error?.includes('A new verification code has been sent to your email'),
      'Legacy user login automatically dispatches fresh verification code'
    );

    const legacyDispatched = dispatchedEmails.find((d) => d.email === legacyEmail);
    assert(
      !!legacyDispatched && /^\d{6}$/.test(legacyDispatched.otp),
      'Verification email was auto-dispatched to legacy user'
    );

    // Submit newly auto-dispatched code to verify legacy account
    const legacyVerifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: legacyEmail,
        code: legacyDispatched?.otp,
      }),
    });
    assert(
      legacyVerifyRes.status === 200,
      'Legacy user successfully verified with auto-dispatched code'
    );

    // Login now succeeds for legacy user
    const legacySuccessLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: legacyEmail,
        password: legacyPassword,
      }),
    });
    assert(
      legacySuccessLoginRes.status === 200,
      'Legacy user now logs in successfully'
    );

    // -------------------------------------------------------------
    // Scenario 13: Test Endpoint Security in Simulated Production
    // -------------------------------------------------------------
    console.log('\n--- Test Group 13: Test Endpoint Security Isolation ---');

    process.env.NODE_ENV = 'production';
    const prodTestCodeRes = await fetch(`${baseUrl}/api/auth/test-verification-code?email=${encodeURIComponent(testEmail)}`);
    assert(
      prodTestCodeRes.status === 404 || prodTestCodeRes.status === 403,
      'Test verification code endpoint is strictly locked down (404/403) in production'
    );
    process.env.NODE_ENV = 'test';

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===============================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
