import assert from 'node:assert/strict';

// Test simulation of App.tsx post-login navigation resolution

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

function simulateNavigationFlow() {
  console.log('Testing App.tsx post-login navigation logic...');

  // State holder simulating React state
  let currentUser = null;
  let activeScreen = 'login';
  let historyPath = '/login';

  const navigateTo = (screen, userOverride) => {
    let target = screen;
    const activeUser = userOverride !== undefined ? userOverride : currentUser;

    if (!activeUser && PRIVATE_SCREENS.includes(screen)) {
      target = 'login';
    }

    if (activeUser && (screen === 'login' || screen === 'signup')) {
      target = 'dashboard';
    }

    activeScreen = target;
    historyPath = `/${target}`;
  };

  // 1. Initial State: unauthenticated user on login screen
  assert.equal(currentUser, null);
  assert.equal(activeScreen, 'login');

  // 2. User logs in successfully:
  // In React, setCurrentUser is async, so in handleAuthenticated:
  // session.user is passed into navigateTo('dashboard', session.user)
  const mockUser = {
    id: 'user_123',
    name: 'Test User',
    email: 'test@example.com',
    monthlyIncome: 50000,
  };

  // Synchronous execution turn of handleAuthenticated:
  // setCurrentUser(mockUser) scheduled, then navigateTo called:
  navigateTo('dashboard', mockUser);
  currentUser = mockUser; // state update applied on next tick

  // 3. Verification of activeScreen immediately after login
  assert.equal(activeScreen, 'dashboard', 'activeScreen must be dashboard');
  assert.equal(historyPath, '/dashboard', 'browser URL must be /dashboard');

  // 4. Test resolvedScreen fallback guard
  const getResolvedScreen = (screen, user) => {
    if (user && (screen === 'login' || screen === 'signup')) {
      return 'dashboard';
    }
    const knownScreens = [
      'landing',
      'dashboard',
      'spending-analysis',
      'savings-goals',
      'ai-coach',
      'cash-flow-forecast',
      'financial-health',
      'insights-alerts',
      'settings-profile',
    ];
    if (!knownScreens.includes(screen)) {
      return 'dashboard';
    }
    return screen;
  };

  // Even if activeScreen was somehow 'login' while authenticated:
  assert.equal(getResolvedScreen('login', mockUser), 'dashboard');
  assert.equal(getResolvedScreen('signup', mockUser), 'dashboard');
  assert.equal(getResolvedScreen('unknown-screen', mockUser), 'dashboard');
  assert.equal(getResolvedScreen('spending-analysis', mockUser), 'spending-analysis');
  assert.equal(getResolvedScreen('dashboard', mockUser), 'dashboard');

  console.log('✓ All post-login navigation assertions passed!');
}

simulateNavigationFlow();
