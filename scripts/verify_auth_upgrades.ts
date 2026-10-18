import {
  validateEmailFormat,
  isDisposableEmail,
  normalizeEmail,
  validateSignupEmail,
  validateEmailDomainDns,
} from '../server/utils/emailValidation';

async function runAuthTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING ARTHOBACHAO AI AUTHENTICATION UPGRADE VERIFICATION');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3000';

  // -------------------------------------------------------------
  // TEST 1: Email Format Validation & Normalization
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
    'user..name@domain.com', // consecutive dots in local part
    'user@domain..com', // consecutive dots in domain
    '.user@domain.com', // leading dot
    'user@domain.123', // numeric TLD
    'user@domain.test', // reserved invalid TLD
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
    'first.last+tag@sub.domain.org',
  ];
  for (const good of validEmails) {
    const res = validateEmailFormat(good);
    if (!res.isValid) {
      throw new Error(`Expected valid email "${good}" to pass, but got error: ${res.error}`);
    }
  }
  console.log(`✓ All ${validEmails.length} valid email patterns accepted.`);

  const norm = normalizeEmail('  Tanvir.Hossain@Domain.COM  ');
  if (norm.email !== 'tanvir.hossain@domain.com' || norm.domain !== 'domain.com') {
    throw new Error(`Normalization failed: ${JSON.stringify(norm)}`);
  }
  console.log('✓ Email normalization (trimming & lowercasing) verified.');

  // -------------------------------------------------------------
  // TEST 2: Disposable Domain Detection
  // -------------------------------------------------------------
  console.log('\n=== TEST 2: Disposable Domain Blocking ===');
  const disposableSamples = [
    'user@mailinator.com',
    'test@guerrillamail.com',
    'alert@tempmail.com',
    'anon@10minutemail.com',
    'user@yopmail.com',
    'temp@sharklasers.com',
    'user@sub.mailinator.com', // subdomain check
    'hacker@throwawaymail.com',
  ];

  for (const disp of disposableSamples) {
    if (!isDisposableEmail(disp)) {
      throw new Error(`Expected disposable email "${disp}" to be blocked, but was allowed.`);
    }
  }
  console.log(`✓ All ${disposableSamples.length} disposable test domains successfully blocked.`);

  const legitimateSamples = [
    'ahmed@gmail.com',
    'student@du.ac.bd',
    'faculty@buet.ac.bd',
    'manager@company.com',
    'officer@nbr.gov.bd',
    'contact@yahoo.com',
    'developer@outlook.com',
    'admin@proton.me',
  ];

  for (const legit of legitimateSamples) {
    if (isDisposableEmail(legit)) {
      throw new Error(`Legitimate email "${legit}" was falsely flagged as disposable.`);
    }
  }
  console.log('✓ Legitimate domains confirmed safe (no false positives).');

  // -------------------------------------------------------------
  // TEST 3: API Disposable Domain Rejection on Signup
  // -------------------------------------------------------------
  console.log('\n=== TEST 3: API Disposable Domain Rejection on Signup ===');
  const disposableSignupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Spam Bot',
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
  // TEST 4: DNS Mail Exchanger & Nonexistent Domain Validation
  // -------------------------------------------------------------
  console.log('\n=== TEST 4: DNS Mail Exchanger & Nonexistent Domain Validation ===');
  const nonexistentDomainRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nonexistent User',
      email: 'test@thisdomaindoesnotexistatall12345xyz.com',
      password: 'password123',
    }),
  });

  if (nonexistentDomainRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for nonexistent domain, got ${nonexistentDomainRes.status}`);
  }
  const nonexistentJson = await nonexistentDomainRes.json();
  if (!nonexistentJson.error?.includes('does not exist') && !nonexistentJson.error?.includes('mail')) {
    throw new Error(`Unexpected nonexistent domain error message: ${nonexistentJson.error}`);
  }
  console.log(`✓ Backend API rejected nonexistent domain signup: "${nonexistentJson.error}"`);

  // Reserved invalid TLD
  const invalidTldRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email: 'user@test.invalid',
      password: 'password123',
    }),
  });
  if (invalidTldRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for reserved invalid TLD, got ${invalidTldRes.status}`);
  }
  console.log('✓ Reserved invalid TLD rejected before sending code.');

  // -------------------------------------------------------------
  // TEST 5: Secure Signup Flow -> Code Not Leaked in Client Response
  // -------------------------------------------------------------
  console.log('\n=== TEST 5: Secure Signup Flow (Code Not Exposed in Response) ===');
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
  if (signupData.devOtp) {
    throw new Error('SECURITY VIOLATION: devOtp must NEVER be leaked in public client signup responses!');
  }
  console.log('✓ User registered in pending verification state. Verification code is NOT exposed in client response.');

  // Retrieve code from local test endpoint
  const testCodeRes = await fetch(`${BASE_URL}/api/auth/test-verification-code?email=${encodeURIComponent(testUserEmail)}`);
  if (!testCodeRes.ok) {
    throw new Error(`Failed to retrieve test code from test endpoint: ${testCodeRes.status}`);
  }
  const testCodeData = await testCodeRes.json();
  const testCode = testCodeData.code;
  if (!testCode || testCode.length !== 6) {
    throw new Error(`Invalid test code retrieved: ${testCode}`);
  }
  console.log(`✓ Test harness retrieved secure 6-digit code for verification testing.`);

  // -------------------------------------------------------------
  // TEST 6: Unverified User Blocked from Login & Protected Routes
  // -------------------------------------------------------------
  console.log('\n=== TEST 6: Unverified Account Access Protection ===');
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
  // TEST 7: Resend Verification Code Rate Limiting
  // -------------------------------------------------------------
  console.log('\n=== TEST 7: Resend Code Rate Limiting ===');
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
  // TEST 8: Incorrect Attempt Limiting & Code Invalidation
  // -------------------------------------------------------------
  console.log('\n=== TEST 8: Incorrect Attempt Limiting & Invalidation ===');
  // Attempt 1
  const attempt1 = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, code: '000001' }),
  });
  if (attempt1.status !== 400) throw new Error(`Expected 400 for bad attempt 1, got ${attempt1.status}`);
  const a1Data = await attempt1.json();
  if (a1Data.remainingAttempts !== 4) throw new Error(`Expected remainingAttempts 4, got ${a1Data.remainingAttempts}`);
  console.log(`✓ Attempt 1 rejected with remaining attempts: ${a1Data.remainingAttempts}`);

  // Attempts 2, 3, 4
  for (let i = 2; i <= 4; i++) {
    const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, code: `00000${i}` }),
    });
    if (res.status !== 400) throw new Error(`Expected 400 on attempt ${i}`);
  }
  console.log('✓ Attempts 2-4 rejected with progressive countdown.');

  // Attempt 5 (Exceeds limit -> 429 Too Many Requests & Code Invalidation)
  const attempt5 = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, code: '000005' }),
  });
  if (attempt5.status !== 429) {
    throw new Error(`Expected 429 on exceeding max attempts, got ${attempt5.status}`);
  }
  const a5Data = await attempt5.json();
  if (!a5Data.tooManyAttempts) throw new Error('Expected tooManyAttempts: true flag');
  console.log(`✓ Attempt 5 locked with 429: "${a5Data.error}"`);

  // Confirm that even previously correct code is now invalidated
  const invalidatedCheck = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, code: testCode }),
  });
  if (invalidatedCheck.status !== 429) {
    throw new Error(`Expected 429 for invalidated code, got ${invalidatedCheck.status}`);
  }
  console.log('✓ Confirmed verification code was invalidated after 5 incorrect attempts.');

  // -------------------------------------------------------------
  // TEST 9: Fresh Signup / Resend Flow & Successful Email Verification
  // -------------------------------------------------------------
  console.log('\n=== TEST 9: Email Verification with Fresh Valid Code ===');
  const validTestUserEmail = `tanvir.verified.${Date.now()}@example.com`;
  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tanvir Verified',
      email: validTestUserEmail,
      password: testPassword,
    }),
  });

  const freshCodeRes = await fetch(`${BASE_URL}/api/auth/test-verification-code?email=${encodeURIComponent(validTestUserEmail)}`);
  const freshCodeData = await freshCodeRes.json();
  const freshOtp = freshCodeData.code;

  const goodOtpRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: validTestUserEmail,
      code: freshOtp,
    }),
  });

  if (!goodOtpRes.ok) {
    const err = await goodOtpRes.json();
    throw new Error(`Expected verification to succeed, got ${goodOtpRes.status}: ${JSON.stringify(err)}`);
  }
  const verifiedSession = await goodOtpRes.json();
  if (!verifiedSession.token) {
    throw new Error('Expected JWT session token in verification response');
  }
  console.log(`✓ Verification successful! JWT session issued for ${verifiedSession.user.name}.`);

  // Now login with verified account
  const verifiedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: validTestUserEmail,
      password: testPassword,
    }),
  });
  if (!verifiedLoginRes.ok) {
    throw new Error(`Verified user login failed: ${verifiedLoginRes.status}`);
  }
  const loginSession = await verifiedLoginRes.json();
  console.log(`✓ Logged in successfully with verified account.`);

  // Test protected route
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${loginSession.token}`,
    },
  });
  if (!meRes.ok) {
    throw new Error(`Protected route access failed: ${meRes.status}`);
  }
  const meData = await meRes.json();
  console.log(`✓ Protected route access verified for user: ${meData.user.email}`);

  // -------------------------------------------------------------
  // TEST 10: Google Authentication Verification
  // -------------------------------------------------------------
  console.log('\n=== TEST 10: Google Authentication Verification ===');
  const badGoogleRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'forged_fake_token_123' }),
  });
  if (badGoogleRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for forged Google token, got ${badGoogleRes.status}`);
  }
  console.log('✓ Forged/invalid Google token rejected with 401.');

  const googleMockEmail = `google.user.${Date.now()}@gmail.com`;
  const validMockToken = `test_google_token:${JSON.stringify({
    sub: `google-sub-${Date.now()}`,
    email: googleMockEmail,
    name: 'Google Verified User',
    picture: 'https://example.com/avatar.jpg',
  })}`;

  const goodGoogleRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: validMockToken }),
  });

  if (!goodGoogleRes.ok) {
    throw new Error(`Google auth failed: ${goodGoogleRes.status}`);
  }
  const googleSession = await goodGoogleRes.json();
  console.log(`✓ New user signed up via Google: ${googleSession.user.name} (${googleSession.user.email}).`);

  // Account linking test
  const linkUserEmail = `linking.user.${Date.now()}@gmail.com`;
  await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Local Linking User',
      email: linkUserEmail,
      password: 'password123',
    }),
  });

  const linkGoogleToken = `test_google_token:${JSON.stringify({
    sub: `google-link-sub-${Date.now()}`,
    email: linkUserEmail,
    name: 'Linked Google User',
  })}`;

  const linkRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: linkGoogleToken }),
  });
  if (!linkRes.ok) {
    throw new Error(`Account linking via Google failed: ${linkRes.status}`);
  }
  console.log('✓ Existing email/password account linked to Google identity successfully.');

  // -------------------------------------------------------------
  // TEST 11: Backward Compatibility for Demo User
  // -------------------------------------------------------------
  console.log('\n=== TEST 11: Backward Compatibility for Demo User ===');
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
  // TEST 12: Session Logout
  // -------------------------------------------------------------
  console.log('\n=== TEST 12: Logout Execution ===');
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
  console.log('🎉 ALL 12 AUTHENTICATION & SECURITY TEST SUITES PASSED CLEANLY!');
  console.log('================================================================\n');
}

runAuthTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
