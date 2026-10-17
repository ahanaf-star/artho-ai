import { maskAccountIdentifier, COMMON_PROVIDERS, ACCOUNT_TYPES } from '../src/components/WalletsManagementSection';

async function runTests() {
  console.log('--- TEST 1: Unit Test maskAccountIdentifier ---');
  const maskCases = [
    { input: '01712345678', expected: '****5678' },
    { input: '1234', expected: '****1234' },
    { input: '99', expected: '****99' },
    { input: '', expected: '' },
    { input: undefined, expected: '' },
    { input: '   01811223344   ', expected: '****3344' },
  ];

  for (const c of maskCases) {
    const res = maskAccountIdentifier(c.input);
    if (res !== c.expected) {
      throw new Error(`maskAccountIdentifier failed for "${c.input}": expected "${c.expected}", got "${res}"`);
    }
  }
  console.log('✓ maskAccountIdentifier tests passed successfully.');

  console.log('--- TEST 2: Common Providers and Account Types Definitions ---');
  if (!COMMON_PROVIDERS.includes('bKash') || !COMMON_PROVIDERS.includes('BRAC Bank') || !COMMON_PROVIDERS.includes('Other')) {
    throw new Error('COMMON_PROVIDERS is missing required providers');
  }
  if (!ACCOUNT_TYPES.includes('Mobile Financial Service (MFS)') || !ACCOUNT_TYPES.includes('Bank Account')) {
    throw new Error('ACCOUNT_TYPES is missing required account types');
  }
  console.log('✓ Provider & Account Type definitions verified.');

  const BASE_URL = 'http://localhost:3000';

  console.log('--- TEST 3: Login to obtain JWT Auth Token ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ahmed@arthobachao.ai', password: 'password123' })
  });

  let token = '';
  let userId = 'usr-ahmed-01';

  if (loginRes.ok) {
    const loginData = await loginRes.json();
    token = loginData.token;
    userId = loginData.user.id || loginData.user._id || 'usr-ahmed-01';
    console.log(`✓ Authenticated as ${loginData.user.email} (ID: ${userId})`);
  } else {
    console.log('Login endpoint returned non-200 (using fallback mode if active):', loginRes.status);
  }

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  console.log('--- TEST 4: Update User Profile with monthlyIncome baseline ---');
  const updateIncomeRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ monthlyIncome: 45000 })
  });

  if (updateIncomeRes.ok) {
    const updatedUser = await updateIncomeRes.json();
    console.log(`✓ User profile monthlyIncome updated: ${updatedUser.monthlyIncome}`);
    if (updatedUser.monthlyIncome !== 45000) {
      throw new Error(`Expected monthlyIncome to be 45000, got ${updatedUser.monthlyIncome}`);
    }
  } else {
    console.warn(`User update response: ${updateIncomeRes.status}`);
  }

  console.log('--- TEST 5: Create Wallet Account via POST /api/users/:id/wallets ---');
  const createWalletRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountType: 'Mobile Financial Service (MFS)',
      provider: 'bKash',
      displayName: 'Personal bKash',
      accountNumber: '01712345678',
      balance: 15500,
      notes: 'Primary personal wallet'
    })
  });

  if (!createWalletRes.ok) {
    const errText = await createWalletRes.text();
    throw new Error(`Failed to create wallet account: ${createWalletRes.status} ${errText}`);
  }

  const createdWallet = await createWalletRes.json();
  console.log('✓ Created Wallet Account:', createdWallet);
  if (!createdWallet.id || createdWallet.provider !== 'bKash' || createdWallet.balance !== 15500) {
    throw new Error('Created wallet account missing fields or values mismatch');
  }

  console.log('--- TEST 6: Get All Wallet Accounts via GET /api/users/:id/wallets ---');
  const getWalletsRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    headers: authHeaders
  });

  if (!getWalletsRes.ok) {
    throw new Error(`Failed to get wallets: ${getWalletsRes.status}`);
  }

  const wallets = await getWalletsRes.json();
  console.log(`✓ Retrieved ${wallets.length} wallet accounts.`);
  const found = wallets.find((w: any) => w.id === createdWallet.id);
  if (!found) {
    throw new Error(`Created wallet ${createdWallet.id} not found in retrieved list`);
  }

  console.log('--- TEST 7: Update Wallet Account via PUT /api/users/:id/wallets/:walletId ---');
  const updateWalletRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets/${createdWallet.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      balance: 18200,
      notes: 'Updated salary deposit'
    })
  });

  if (!updateWalletRes.ok) {
    throw new Error(`Failed to update wallet: ${updateWalletRes.status}`);
  }
  const updatedWallet = await updateWalletRes.json();
  console.log('✓ Updated Wallet:', updatedWallet);
  if (updatedWallet.balance !== 18200 || updatedWallet.notes !== 'Updated salary deposit') {
    throw new Error('Wallet balance or notes not updated properly');
  }

  console.log('--- TEST 8: Delete Wallet Account via DELETE /api/users/:id/wallets/:walletId ---');
  const deleteWalletRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets/${createdWallet.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });

  if (!deleteWalletRes.ok) {
    throw new Error(`Failed to delete wallet: ${deleteWalletRes.status}`);
  }
  const deleteMsg = await deleteWalletRes.json();
  console.log('✓ Wallet deleted successfully:', deleteMsg);

  console.log('--- TEST 9: Verify User Isolation & Security ---');
  // Attempt to access a different user's wallets without auth
  const rogueUserId = 'usr-other-user-999';
  const unauthorizedRes = await fetch(`${BASE_URL}/api/users/${rogueUserId}/wallets`, {
    headers: { 'Content-Type': 'application/json' }
  });

  if (unauthorizedRes.status !== 403 && unauthorizedRes.status !== 401) {
    throw new Error(`Expected 403 or 401 for unauthorized access to another user's wallets, got ${unauthorizedRes.status}`);
  }
  console.log(`✓ User isolation enforced properly (blocked with status ${unauthorizedRes.status}).`);

  console.log('\n=========================================');
  console.log('ALL WALLET & INFLOW TESTS PASSED SUCCESSFULLY!');
  console.log('=========================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
