import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

async function runVerification() {
  console.log('====================================================');
  console.log('VERIFYING FOUR CONCERNS: Dashboard, Spending, Form, Baseline');
  console.log('====================================================');

  const timestamp = Date.now();
  const userAEmail = `test_concern_a_${timestamp}@example.com`;
  const userBEmail = `test_concern_b_${timestamp}@example.com`;

  // ----------------------------------------------------
  // CONCERN D & REGISTRATION: Register New User without baseline
  // ----------------------------------------------------
  console.log('\n[TEST 1] Registering User A without monthlyIncome...');
  const regResA = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tanvir Hossain',
      email: userAEmail,
      password: 'password123',
    }),
  });
  assert.equal(regResA.status, 201, 'Signup User A should return 201');
  const regDataA = await regResA.json();
  const tokenA = regDataA.token;
  const userA = regDataA.user;
  const userIdA = userA.customId || userA._id;

  console.log(`User A created: id=${userIdA}, monthlyIncome=${userA.monthlyIncome}`);
  assert.equal(userA.monthlyIncome, undefined, 'New user monthlyIncome must be undefined/unset, never 35000 or 38500');

  // Verify accounts start with 0 balance
  const linkedAccounts = userA.linkedAccounts || [];
  const bKashAcc = linkedAccounts.find((a) => a.name === 'bKash');
  const cityAcc = linkedAccounts.find((a) => a.name === 'City Bank');
  const nagadAcc = linkedAccounts.find((a) => a.name === 'Nagad');

  assert.equal(bKashAcc?.balance, 0, 'bKash initial balance must be 0 (not 5000)');
  assert.equal(cityAcc?.balance, 0, 'City Bank initial balance must be 0 (not 10000)');
  assert.equal(nagadAcc?.balance, 0, 'Nagad initial balance must be 0 (not 3000)');

  const totalWalletBalance = linkedAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  assert.equal(totalWalletBalance, 0, 'Total wallet balance for fresh user must be 0 (not 18000)');
  console.log('✓ Concern A & D: Fresh user has ৳0 balance across all wallets and unset monthlyIncome');

  // ----------------------------------------------------
  // CONCERN D: Profile Authorization & Isolation
  // ----------------------------------------------------
  console.log('\n[TEST 2] Verifying User Isolation on Profile Routes...');
  const regResB = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sabrina Akter',
      email: userBEmail,
      password: 'password123',
    }),
  });
  assert.equal(regResB.status, 201);
  const tokenB = (await regResB.json()).token;

  // User B tries to read User A's profile
  const unauthorizedGet = await fetch(`${BASE_URL}/api/users/${userIdA}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.equal(unauthorizedGet.status, 403, 'User B must receive 403 Forbidden when accessing User A profile');

  // User B tries to update User A's profile
  const unauthorizedPut = await fetch(`${BASE_URL}/api/users/${userIdA}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ monthlyIncome: 99999 }),
  });
  assert.equal(unauthorizedPut.status, 403, 'User B must receive 403 Forbidden when updating User A profile');
  console.log('✓ Concern D: Strict profile authorization enforced (403 Forbidden on cross-user access)');

  // ----------------------------------------------------
  // CONCERN C: Transaction Form (Optional Merchant)
  // ----------------------------------------------------
  console.log('\n[TEST 3] Creating transaction with empty merchant for User A...');
  const createTxRes = await fetch(`${BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      amount: 1500,
      type: 'expense',
      category: 'Food & Groceries',
      account: 'bKash',
      date: new Date().toISOString().split('T')[0],
      description: 'Weekly local bazaar vegetables',
      merchant: '', // Empty merchant!
    }),
  });
  assert.equal(createTxRes.status, 201, 'Should successfully save transaction with empty merchant');
  const txData = await createTxRes.json();
  assert.equal(txData.amount, 1500);
  assert.equal(txData.merchant, '', 'Merchant should be empty string, not forced to Retailer');
  console.log(`✓ Concern C: Transaction created successfully with empty merchant: id=${txData.id}`);

  // Test editing transaction without merchant
  const editTxRes = await fetch(`${BASE_URL}/api/transactions/${txData.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      amount: 1800,
      merchant: '   ', // Whitespace merchant should trim to empty
    }),
  });
  assert.equal(editTxRes.status, 200, 'Should successfully update transaction with empty merchant');
  const updatedTxData = await editTxRes.json();
  assert.equal(updatedTxData.amount, 1800);
  assert.equal(updatedTxData.merchant, '');
  console.log('✓ Concern C: Edit transaction succeeds with empty merchant');

  // ----------------------------------------------------
  // CONCERN B: Spending Analysis Calculation Logic
  // ----------------------------------------------------
  console.log('\n[TEST 4] Verifying Spending Analysis & Calculations...');
  const { calculateMonthlyOverview } = await import('../src/services/financialCalculations.ts');

  // Zero-expense overview
  const zeroOverview = calculateMonthlyOverview([], 0, new Date().toISOString().substring(0, 7));
  assert.equal(zeroOverview.totalExpenses, 0);
  assert.equal(zeroOverview.totalIncome, 0);
  assert.equal(zeroOverview.largestCategory.amount, 0);
  assert.equal(zeroOverview.largestCategory.category, '', 'When expenses are 0, largest category must be empty');
  assert.equal(zeroOverview.expenseSplit.essential, 0, 'Essential expenses must be 0, not 18104');
  assert.equal(zeroOverview.expenseSplit.discretionary, 0, 'Discretionary expenses must be 0, not 11096');
  console.log('✓ Concern B: Zero-expense overview has ৳0 largestCategory and ৳0 mock splits');

  // Overview with 1 transaction
  const activeMonth = new Date().toISOString().substring(0, 7);
  const oneTxOverview = calculateMonthlyOverview(
    [
      {
        id: 'tx-1',
        amount: 1800,
        type: 'expense',
        category: 'Food & Groceries',
        account: 'bKash',
        date: `${activeMonth}-10`,
        description: 'Bazaar',
        merchant: 'Karwan Bazar',
      },
    ],
    0,
    activeMonth
  );
  assert.equal(oneTxOverview.totalExpenses, 1800);
  assert.equal(oneTxOverview.largestCategory.category, 'Food & Groceries');
  assert.equal(oneTxOverview.largestCategory.amount, 1800);
  assert.deepEqual(oneTxOverview.largestCategory.topMerchants, ['Karwan Bazar']);
  console.log('✓ Concern B: Active overview accurately tracks largest category and merchants');

  // ----------------------------------------------------
  // CLEANUP TEST DATA
  // ----------------------------------------------------
  console.log('\n[CLEANUP] Cleaning up test records...');
  await fetch(`${BASE_URL}/api/transactions/${txData.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log('✓ Cleanup completed');

  console.log('\n====================================================');
  console.log('ALL FOUR CONCERNS FULLY VERIFIED WITH PASSING EVIDENCE');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

