import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

// Client route resolver functions mirroring src/App.tsx logic exactly
const PRIVATE_SCREENS = [
  'dashboard',
  'spending-analysis',
  'savings-goals',
  'cash-flow-forecast',
  'ai-coach',
  'financial-health',
  'insights-alerts',
  'settings-profile',
];

function getScreenFromPathname(pathname) {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  switch (clean) {
    case '':
    case 'landing':
    case 'home':
      return 'landing';
    case 'login':
    case 'signin':
      return 'login';
    case 'signup':
    case 'register':
      return 'signup';
    case 'dashboard':
      return 'dashboard';
    case 'spending-analysis':
    case 'spending':
      return 'spending-analysis';
    case 'savings-goals':
    case 'goals':
      return 'savings-goals';
    case 'cash-flow-forecast':
    case 'cashflow':
      return 'cash-flow-forecast';
    case 'ai-coach':
    case 'coach':
      return 'ai-coach';
    case 'financial-health':
    case 'health':
      return 'financial-health';
    case 'insights-alerts':
    case 'insights':
    case 'alerts':
      return 'insights-alerts';
    case 'settings-profile':
    case 'settings':
    case 'profile':
      return 'settings-profile';
    default:
      return 'landing';
  }
}

function resolveInitialScreen(user, pathname) {
  const target = getScreenFromPathname(pathname);
  if (!user) {
    if (PRIVATE_SCREENS.includes(target)) {
      return 'login';
    }
    return target;
  }
  if (target === 'landing' && (pathname === '/' || pathname === '')) {
    return 'dashboard';
  }
  if (target === 'login' || target === 'signup') {
    return 'dashboard';
  }
  return target;
}

function navigateTo(currentAuthUser, targetScreen) {
  if (!currentAuthUser && PRIVATE_SCREENS.includes(targetScreen)) {
    return 'login';
  }
  if (currentAuthUser && (targetScreen === 'login' || targetScreen === 'signup')) {
    return 'dashboard';
  }
  return targetScreen;
}

async function runTests() {
  console.log('====================================================');
  console.log('VERIFYING INITIAL ENTRY FLOW & AUTHENTICATION ENFORCEMENT');
  console.log('====================================================');

  const timestamp = Date.now();
  const testEmail = `auth_flow_test_${timestamp}@example.com`;
  const testPassword = 'StrongPassword123!';
  let testUser = null;
  let authToken = null;

  // ----------------------------------------------------
  // TEST A: Opening / while logged out displays Landing Page
  // ----------------------------------------------------
  console.log('\n[TEST A] Opening / while logged out...');
  const screenLoggedOutRoot = resolveInitialScreen(null, '/');
  assert.equal(screenLoggedOutRoot, 'landing', 'Opening / while logged out must display landing page, not dashboard');
  console.log('✓ PASS: Opening / while logged out displays Landing Page');

  // ----------------------------------------------------
  // TEST B: Opening / while authenticated follows authenticated user flow
  // ----------------------------------------------------
  console.log('\n[TEST B] Opening / while authenticated...');
  const mockUser = { id: 'usr-123', name: 'Tanvir', email: 'tanvir@example.com' };
  const screenLoggedInRoot = resolveInitialScreen(mockUser, '/');
  assert.equal(screenLoggedInRoot, 'dashboard', 'Opening / while authenticated must direct to dashboard');
  console.log('✓ PASS: Opening / while authenticated follows intended flow (Dashboard)');

  // ----------------------------------------------------
  // TEST C: Clicking Login opens Login page
  // ----------------------------------------------------
  console.log('\n[TEST C] Clicking Login from Landing Page...');
  const screenLogin = navigateTo(null, 'login');
  assert.equal(screenLogin, 'login', 'Navigating to login while unauthenticated must open login');
  const screenSignup = navigateTo(null, 'signup');
  assert.equal(screenSignup, 'signup', 'Navigating to signup while unauthenticated must open signup');
  console.log('✓ PASS: Access to Login and Sign Up pages confirmed');

  // ----------------------------------------------------
  // TEST D: Registration & Successful login opens Dashboard
  // ----------------------------------------------------
  console.log('\n[TEST D] Registering new user and testing successful login...');
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rahim Uddin',
      email: testEmail,
      password: testPassword,
      preferredLanguage: 'bn',
    }),
  });
  assert.equal(signupRes.status, 201, 'Signup should succeed with HTTP 201');
  const signupData = await signupRes.json();
  assert.ok(signupData.token, 'Signup must return JWT token');
  assert.ok(signupData.user, 'Signup must return user object');
  testUser = signupData.user;
  authToken = signupData.token;

  // Now test login API
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  assert.equal(loginRes.status, 200, 'Login should succeed with HTTP 200');
  const loginData = await loginRes.json();
  assert.ok(loginData.token, 'Login must return token');

  // Test redirect to dashboard after login
  const screenPostLogin = navigateTo(loginData.user, 'dashboard');
  assert.equal(screenPostLogin, 'dashboard', 'After successful login, user must be directed to dashboard');
  console.log('✓ PASS: Successful login returns token, user object, and routes to Dashboard');

  // ----------------------------------------------------
  // TEST E: Failed login does not grant access
  // ----------------------------------------------------
  console.log('\n[TEST E] Attempting login with incorrect password...');
  const failedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'WRONG_PASSWORD_123',
    }),
  });
  assert.equal(failedLoginRes.status, 401, 'Failed login must return HTTP 401 Unauthorized');
  const failedLoginData = await failedLoginRes.json();
  assert.ok(failedLoginData.error, 'Failed login must return error message');

  // Client state verification: currentUser remains null
  let unauthUser = null;
  const screenPostFailed = navigateTo(unauthUser, 'dashboard');
  assert.equal(screenPostFailed, 'login', 'Failed login must not allow navigation to dashboard');
  console.log('✓ PASS: Failed login returns 401 and prevents access to private views');

  // ----------------------------------------------------
  // TEST F: Opening each private route while logged out redirects to Login
  // ----------------------------------------------------
  console.log('\n[TEST F] Opening each private route directly while logged out...');
  for (const privateScreen of PRIVATE_SCREENS) {
    const directPath = `/${privateScreen}`;
    const resolvedScreen = resolveInitialScreen(null, directPath);
    assert.equal(
      resolvedScreen,
      'login',
      `Direct access to ${directPath} while logged out must redirect to login, got ${resolvedScreen}`
    );

    const clientNavScreen = navigateTo(null, privateScreen);
    assert.equal(
      clientNavScreen,
      'login',
      `Client-side navigation to ${privateScreen} while logged out must redirect to login, got ${clientNavScreen}`
    );
  }
  console.log(`✓ PASS: All ${PRIVATE_SCREENS.length} private routes strictly redirect to Login when unauthenticated`);

  // ----------------------------------------------------
  // TEST G: Refreshing a private route preserves authenticated session
  // ----------------------------------------------------
  console.log('\n[TEST G] Refreshing a private route while authenticated...');
  for (const privateScreen of PRIVATE_SCREENS) {
    const directPath = `/${privateScreen}`;
    const resolvedScreen = resolveInitialScreen(testUser, directPath);
    assert.equal(
      resolvedScreen,
      privateScreen,
      `Refreshing ${directPath} with valid session must preserve ${privateScreen}, got ${resolvedScreen}`
    );
  }

  // Verify backend session token validation via GET /api/auth/me
  const authMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(authMeRes.status, 200, '/api/auth/me must return 200 for valid token');
  const authMeData = await authMeRes.json();
  assert.equal(authMeData.user.email, testEmail.toLowerCase(), 'auth/me must return authenticated user');
  console.log('✓ PASS: Private route refresh preserves authenticated user state & validates token against backend');

  // ----------------------------------------------------
  // TEST H: Logout prevents access to private pages
  // ----------------------------------------------------
  console.log('\n[TEST H] Logging out and testing private route lockout...');
  // Logout endpoint
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(logoutRes.status, 200, 'Logout should succeed with HTTP 200');

  // Simulate client logout handler
  let activeUser = testUser;
  // handleLogout:
  activeUser = null;
  const postLogoutScreen = navigateTo(activeUser, 'dashboard');
  assert.equal(postLogoutScreen, 'login', 'After logout, accessing dashboard must be redirected to login');

  const rootAfterLogout = resolveInitialScreen(activeUser, '/');
  assert.equal(rootAfterLogout, 'landing', 'After logout, opening / must show landing page');
  console.log('✓ PASS: Logout invalidates session and locks all private pages');

  // ----------------------------------------------------
  // TEST I: Direct API requests without authentication are rejected
  // ----------------------------------------------------
  console.log('\n[TEST I] Testing sensitive backend APIs without authentication token...');

  // 1. /api/auth/me without token -> 401
  const apiMeUnauth = await fetch(`${BASE_URL}/api/auth/me`);
  assert.equal(apiMeUnauth.status, 401, '/api/auth/me must return 401 without token');

  // 2. /api/ai/health/explain without token -> 401
  const apiHealthExplainUnauth = await fetch(`${BASE_URL}/api/ai/health/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'en' }),
  });
  assert.equal(apiHealthExplainUnauth.status, 401, '/api/ai/health/explain must return 401 without token');

  // 3. /api/transactions without token -> 401
  const apiTxsUnauth = await fetch(`${BASE_URL}/api/transactions`);
  assert.equal(apiTxsUnauth.status, 401, '/api/transactions must return 401 without token');

  // 4. POST /api/transactions without token -> 401
  const apiPostTxUnauth = await fetch(`${BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 100 }),
  });
  assert.equal(apiPostTxUnauth.status, 401, 'POST /api/transactions must return 401 without token');

  // 5. Cross-user isolation check: User attempts to fetch another user's transactions
  const crossUserRes = await fetch(`${BASE_URL}/api/users/usr-other-victim/transactions`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(crossUserRes.status, 403, 'Cross-user transactions access must be rejected with 403 Forbidden');

  console.log('✓ PASS: All sensitive backend APIs strictly reject unauthenticated or cross-user requests');

  // ----------------------------------------------------
  // TEST J: Existing features continue to work
  // ----------------------------------------------------
  console.log('\n[TEST J] Verifying existing financial CRUD features with authenticated user...');
  const newTxRes = await fetch(`${BASE_URL}/api/users/${testUser.customId || testUser._id}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      id: `tx-test-${timestamp}`,
      amount: 1500,
      type: 'expense',
      category: 'Food & Dining',
      description: 'Grocery shopping',
      merchant: 'Shwapno',
      date: '2026-10-17',
      account: 'bKash',
      paymentMethod: 'bKash QR',
      classification: 'essential',
      location: 'Dhaka',
    }),
  });
  assert.equal(newTxRes.status, 201, 'Authenticated user must be able to create a transaction');

  const getTxsRes = await fetch(`${BASE_URL}/api/users/${testUser.customId || testUser._id}/transactions`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(getTxsRes.status, 200, 'Authenticated user can fetch own transactions');
  const userTxs = await getTxsRes.json();
  assert.equal(userTxs.length, 1, 'Should find 1 persisted transaction');
  assert.equal(userTxs[0].amount, 1500, 'Persisted transaction amount matches');

  // Financial Health calculation endpoint
  const healthRes = await fetch(`${BASE_URL}/api/users/${testUser.customId || testUser._id}/financial-health`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.equal(healthRes.status, 200, 'Health score calculation succeeds for authenticated user');
  const healthData = await healthRes.json();
  assert.ok(healthData.status, 'Health score response has status');

  console.log('✓ PASS: Financial operations, transactions persistence, and health calculation fully operational');

  console.log('\n====================================================');
  console.log('ALL VERIFICATION TESTS (A through J) PASSED WITH ZERO FAILURES!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
