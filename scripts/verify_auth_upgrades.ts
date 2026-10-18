import { validateEmailFormat, isDisposableEmail, normalizeEmail, validateSignupEmail } from '../server/utils/emailValidation';

async function runAuthTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING ARTHOBACHAO AI AUTHENTICATION UPGRADE VERIFICATION');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3000';

  // -------------------------------------------------------------
  // TEST 1: Unit Tests for Email Validation & Normalization
  // -------------------------------------------------------------
  console.log('=== TEST 1: Email Format & Normalization ===');

  const malformedEmails = [
    '',
    '   ',
    'notanemail',
    '@nodomain.com',
    'username@',
    'user space@domain.com',
    'user@domain',
    'user@.com',
    'user@domain.',
    'user@domain.c', // TLD < 2 chars
  ];

  for (const bad of malformedEmails) {
    const res = validateEmailFormat(bad);
    if (res.isValid) {
      throw new Error(`Expected malformed email "${bad}" to be rejected, but it passed.`);
    }
  }
  console.log(`✓ All ${malformedEmails.length} malformed email patterns rejected cleanly.`);

  const validEmails = [
    'user@example.com',
    'ahmed.rahman@arthobachao.ai',
    'student@univ.edu',
    'officer@gov.bd',
    'contact@company.co.uk',
  ];
  for (const good of validEmails) {
    const res = validateEmailFormat(good);
    if (!res.isValid) {
      throw new Error(`Expected valid email "${good}" to pass, but got error: ${res.error}`);
    }
  }
  console.log(`✓ All ${validEmails.length} valid email patterns accepted.`);

  // Normalization check
  const norm = normalizeEmail('  Test.User+Filter@Domain.COM  ');
  if (norm.email !== 'test.user+filter@domain.com' || norm.domain !== 'domain.com') {
    throw new Error(`Normalization mismatch: got ${norm.email}, ${norm.domain}`);
  }
  console.log('✓ Email normalization (trimming & lowercasing) verified.');

  // -------------------------------------------------------------
  // TEST 2: Disposable & Temporary Email Domain Detection
  // -------------------------------------------------------------
  console.log('\n=== TEST 2: Disposable Domain Blocking ===');
  const disposableSamples = [
    'test@mailinator.com',
    'user@10minutemail.com',
    'throwaway@guerrillamail.com',
    'burner@tempmail.com',
    'sub@sharklasers.com',
    'fake@yopmail.com',
    'temp@dispostable.com',
    'anon@subdomain.mailinator.com',
  ];

  for (const d of disposableSamples) {
    if (!isDisposableEmail(d)) {
      throw new Error(`Expected disposable email "${d}" to be blocked, but was allowed.`);
    }
    const signupCheck = validateSignupEmail(d);
    if (signupCheck.isValid) {
      throw new Error(`validateSignupEmail failed to block "${d}".`);
    }
  }
  console.log(`✓ All ${disposableSamples.length} disposable test domains successfully blocked.`);

  // Legitimate domains safeguard test
  const legitimateSamples = [
    'user@gmail.com',
    'user@yahoo.com',
    'user@outlook.com',
    'user@hotmail.com',
    'user@icloud.com',
    'user@proton.me',
    'user@buet.ac.bd',
  ];
  for (const legit of legitimateSamples) {
    if (isDisposableEmail(legit)) {
      throw new Error(`Legitimate domain "${legit}" was falsely marked as disposable.`);
    }
  }
  console.log(`✓ Legitimate domains confirmed safe (no false positives).`);

  // -------------------------------------------------------------
  // TEST 3: Backend Signup & Disposable Rejection API Test
  // -------------------------------------------------------------
  console.log('\n=== TEST 3: API Disposable Domain Rejection on Signup ===');
  const disposableSignupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Trash User',
      email: 'hacker@mailinator.com',
      password: 'password123',
    }),
  });

  if (disposableSignupRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for disposable signup, got ${disposableSignupRes.status}`);
  }
  const disposableJson = await disposableSignupRes.json();
  if (!disposableJson.error?.includes('disposable') && !disposableJson.error?.includes('temporary')) {
    throw new Error(`Unexpected disposable error message: ${disposableJson.error}`);
  }
  console.log(`✓ Backend API rejected disposable email signup: "${disposableJson.error}"`);

  // -------------------------------------------------------------
  // TEST 4: Real Signup Flow -> Verification Required
  // -------------------------------------------------------------
  console.log('\n=== TEST 4: Signup Flow with Required Verification ===');
  const testUserEmail = `tanvir.test.${Date.now()}@example.com`;
  const testPassword = 'SecurePassword2026!';

  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tanvir Hossain',
      email: testUserEmail,
      password: testPassword,
    }),
  });

  if (signupRes.status !== 201) {
    const err = await signupRes.json();
    throw new Error(`Signup failed with status ${signupRes.status}: ${JSON.stringify(err)}`);
  }

  const signupData = await signupRes.json();
  if (!signupData.requiresVerification) {
    throw new Error('Expected requiresVerification: true in signup response');
  }
  if (!signupData.devOtp) {
    throw new Error('Expected devOtp to be available in development test environment');
  }
  console.log(`✓ User registered in pending verification state. Verification code: ${signupData.devOtp}`);

  // -------------------------------------------------------------
  // TEST 5: Unverified User Blocked from Login & Protected Routes
  // -------------------------------------------------------------
  console.log('\n=== TEST 5: Unverified Account Access Protection ===');
  const unverifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      password: testPassword,
    }),
  });

  if (unverifiedLoginRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for unverified login, got ${unverifiedLoginRes.status}`);
  }
  const unverifiedJson = await unverifiedLoginRes.json();
  if (!unverifiedJson.requiresVerification) {
    throw new Error('Expected requiresVerification: true in 403 response');
  }
  console.log('✓ Unverified login blocked with 403 and requiresVerification: true');

  // -------------------------------------------------------------
  // TEST 6: Resend Verification Code Rate Limiting
  // -------------------------------------------------------------
  console.log('\n=== TEST 6: Resend Code Rate Limiting ===');
  // Attempt immediate resend (less than 60s since signup)
  const resendTooSoonRes = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail }),
  });

  if (resendTooSoonRes.status !== 429) {
    throw new Error(`Expected 429 Too Many Requests for rapid resend, got ${resendTooSoonRes.status}`);
  }
  const rateJson = await resendTooSoonRes.json();
  console.log(`✓ Rate limit enforced on resend: "${rateJson.error}" (retryAfter: ${rateJson.retryAfter}s)`);

  // -------------------------------------------------------------
  // TEST 7: Email Verification Execution
  // -------------------------------------------------------------
  console.log('\n=== TEST 7: Email Verification with Code ===');
  // A. Invalid code rejected
  const badOtpRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      code: '000000',
    }),
  });
  if (badOtpRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for incorrect OTP, got ${badOtpRes.status}`);
  }
  console.log('✓ Incorrect verification code rejected with 400.');

  // B. Valid code accepted
  const correctOtp = signupData.devOtp;
  const goodOtpRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      code: correctOtp,
    }),
  });

  if (!goodOtpRes.ok) {
    const err = await goodOtpRes.json();
    throw new Error(`Verification failed: ${JSON.stringify(err)}`);
  }
  const verifiedSession = await goodOtpRes.json();
  if (!verifiedSession.token || !verifiedSession.user) {
    throw new Error('Expected JWT session token and user profile upon verification');
  }
  console.log(`✓ Verification successful! JWT session issued for ${verifiedSession.user.name}.`);

  // C. Now Login succeeds
  const verifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      password: testPassword,
    }),
  });
  if (!verifiedLoginRes.ok) {
    throw new Error(`Login after verification failed: ${verifiedLoginRes.status}`);
  }
  const loginSession = await verifiedLoginRes.json();
  console.log(`✓ Logged in successfully with verified account.`);

  // D. Protected route accessible with session token
  const protectedRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${loginSession.token}`,
    },
  });
  if (!protectedRes.ok) {
    throw new Error(`Protected route /api/auth/me failed: ${protectedRes.status}`);
  }
  const meData = await protectedRes.json();
  if (meData.user.email !== testUserEmail.toLowerCase()) {
    throw new Error('Protected route returned mismatching user profile');
  }
  console.log(`✓ Protected route access verified for user: ${meData.user.email}`);

  // -------------------------------------------------------------
  // TEST 8: Google Authentication Verification
  // -------------------------------------------------------------
  console.log('\n=== TEST 8: Google Authentication Verification ===');

  // A. Forged/invalid Google token rejected
  const badGoogleRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken: 'forged.fake.token',
    }),
  });
  if (badGoogleRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for forged Google token, got ${badGoogleRes.status}`);
  }
  console.log('✓ Forged/invalid Google token rejected with 401.');

  // B. Authoritative Google Sign-Up with Verified Token
  const googleEmail = `google.user.${Date.now()}@gmail.com`;
  const validMockGoogleToken = `test_google_token:${JSON.stringify({
    sub: `g-sub-${Date.now()}`,
    email: googleEmail,
    name: 'Google Verified User',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    email_verified: true,
  })}`;

  const googleSignupRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: validMockGoogleToken }),
  });

  if (!googleSignupRes.ok) {
    const err = await googleSignupRes.json();
    throw new Error(`Google sign-in failed: ${JSON.stringify(err)}`);
  }
  const googleUserSession = await googleSignupRes.json();
  if (!googleUserSession.token || googleUserSession.user.email !== googleEmail) {
    throw new Error('Google registration mismatch');
  }
  console.log(`✓ New user signed up via Google: ${googleUserSession.user.name} (${googleUserSession.user.email}).`);

  // C. Existing Account Linking via Google
  // User Tanvir signs in with Google having the same email
  const linkMockGoogleToken = `test_google_token:${JSON.stringify({
    sub: `g-linked-${Date.now()}`,
    email: testUserEmail,
    name: 'Tanvir Hossain (Google Linked)',
    email_verified: true,
  })}`;

  const linkRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: linkMockGoogleToken }),
  });
  if (!linkRes.ok) {
    const err = await linkRes.json();
    throw new Error(`Google account linking failed: ${JSON.stringify(err)}`);
  }
  const linkedSession = await linkRes.json();
  if (linkedSession.user.email !== testUserEmail.toLowerCase()) {
    throw new Error('Linked account email mismatch');
  }
  console.log(`✓ Existing email/password account linked to Google identity successfully.`);

  // -------------------------------------------------------------
  // TEST 9: Backward Compatibility for Demo User
  // -------------------------------------------------------------
  console.log('\n=== TEST 9: Backward Compatibility for Demo User ===');
  const demoRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ahmed.rahman@arthobachao.ai',
      password: 'ahmed123',
    }),
  });
  if (!demoRes.ok) {
    throw new Error(`Demo login failed: ${demoRes.status}`);
  }
  const demoSession = await demoRes.json();
  console.log(`✓ Demo user Ahmed Rahman login confirmed functional: ${demoSession.user.name}`);

  // -------------------------------------------------------------
  // TEST 10: Session Logout
  // -------------------------------------------------------------
  console.log('\n=== TEST 10: Logout Execution ===');
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${demoSession.token}`,
    },
  });
  if (!logoutRes.ok) {
    throw new Error(`Logout failed: ${logoutRes.status}`);
  }
  console.log('✓ Logout endpoint confirmed functional.');

  console.log('\n================================================================');
  console.log('🎉 ALL 10 AUTHENTICATION & SECURITY TEST SUITES PASSED CLEANLY!');
  console.log('================================================================\n');
}

runAuthTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});

