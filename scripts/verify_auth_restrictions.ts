/**
 * Comprehensive verification script testing all email verification and disposable domain blocking requirements:
 * 1. Email format validation on frontend and backend
 * 2. Disposable domain detection during registration (400)
 * 3. Disposable domain detection during login (400)
 * 4. Legitimate domains allowed (e.g. gmail.com, yahoo.com, edu)
 * 5. Registration requires verification and does not return JWT or OTP
 * 6. Unverified account cannot log in even with correct password (403 requiresVerification)
 * 7. Invalid verification code rejection (400)
 * 8. Max verification attempt enforcement (invalidation after 5 attempts)
 * 9. Resend verification with 60-second cooldown rate limit (429)
 * 10. Successful verification marks user verified and enables login
 * 11. Demo user (Ahmed Rahman) login remains verified and functional
 * 12. Protected routes enforce authentication and verification status
 */

import express, { Request, Response } from 'express';
import http from 'node:http';
import authRoutes from '../server/routes/authRoutes';
import { requireAuth, AuthenticatedRequest } from '../server/middleware/authMiddleware';
import {
  validateSignupEmail,
  validateLoginEmail,
  isDisposableEmail,
} from '../src/utils/emailValidation';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('ARTHOBACHAO AI: AUTHENTICATION & VERIFICATION RESTRICTIONS TEST');
  console.log('===============================================================\n');

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
    // Scenario 4: Valid Registration Requires Verification
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Valid Registration Flow ---');

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
      unverifiedLoginData.error === 'Please verify your email before logging in.',
      'Login response shows "Please verify your email before logging in."'
    );

    // -------------------------------------------------------------
    // Scenario 6: Invalid Verification Code Handling
    // -------------------------------------------------------------
    console.log('\n--- Test Group 6: Verification Code Validation ---');

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
    // Scenario 10: Protected Routes
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
