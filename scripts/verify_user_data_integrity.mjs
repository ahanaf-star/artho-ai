import assert from 'node:assert/strict';
import { generateCashFlowForecast, getDetailedForecast } from '../src/services/forecastService.ts';
import { calculateFinancialHealthScore } from '../src/services/financialCalculations.ts';

const BASE_URL = 'http://127.0.0.1:3000';

async function run() {
  console.log('====================================================');
  console.log('VERIFYING NEW USER DATA INTEGRITY & AUDIT CONCERNS');
  console.log('====================================================\n');

  // TEST 1: Register a brand new user via API
  console.log('[TEST 1] Registering fresh user via backend /api/auth/signup...');
  const testEmail = `newuser_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tariq Al-Amin',
      email: testEmail,
      password: 'SecurePassword123!',
      preferredLanguage: 'en',
    }),
  });

  const regData = await regRes.json();
  assert.equal(regRes.status, 201, 'User registration must return 201');
  assert.ok(regData.token, 'Token must be provided');
  const user = regData.user;
  console.log(`✓ User registered: ${user.name} (id: ${user.id || user._id})`);

  // Verify default schema integrity
  assert.equal(user.monthlyIncome, undefined, 'Fresh user monthlyIncome must be undefined');
  assert.equal(user.riskTolerance, undefined, 'Fresh user riskTolerance must be undefined');
  assert.equal(user.primaryGoalId, undefined, 'Fresh user primaryGoalId must be undefined');
  assert.ok(Array.isArray(user.recurringObligations), 'recurringObligations must be an array');
  assert.equal(user.recurringObligations.length, 0, 'recurringObligations must be empty for new user');

  const totalWalletBalance = user.linkedAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  assert.equal(totalWalletBalance, 0, 'Initial wallet balance must be ৳0');
  console.log('✓ TEST 1 PASSED: Fresh user has undefined income/risk/primaryGoal and ৳0 wallet balance.\n');

  // TEST 2: Verify Cash Flow Forecast for fresh user (zero transactions, zero obligations)
  console.log('[TEST 2] Verifying Cash Flow Forecast calculations for fresh user...');
  const freshForecast = getDetailedForecast(0, false, [], []);

  console.log(`  • Starting Balance: ৳${freshForecast.startingBalance}`);
  console.log(`  • Projected Month End: ৳${freshForecast.projectedMonthEnd}`);
  console.log(`  • Upcoming Bills: ৳${freshForecast.upcomingBills}`);
  console.log(`  • Recommended Buffer: ৳${freshForecast.recommendedBuffer}`);
  console.log(`  • Pressure Days: [${freshForecast.pressureDays.join(', ')}]`);

  assert.equal(freshForecast.startingBalance, 0, 'Starting balance must be 0, not 24,850');
  assert.equal(freshForecast.upcomingBills, 0, 'Upcoming bills must be 0, not 17,200');
  assert.equal(freshForecast.pressureDays.length, 0, 'No fake pressure zone days');
  assert.equal(freshForecast.forecastCurve.length, 30, 'Must produce 30-day forecast points');
  assert.equal(freshForecast.forecastCurve[0].projectedBalance, 0, 'First day balance must be 0');
  assert.equal(freshForecast.forecastCurve[29].projectedBalance, 0, 'Closing balance must be 0');
  console.log('✓ TEST 2 PASSED: Cash Flow Forecast is completely dynamic with zero fake numbers.\n');

  // TEST 3: Verify Financial Health Score calculation for fresh user
  console.log('[TEST 3] Verifying Financial Health Score for fresh user (0 transactions, 0 goals)...');
  const freshHealth = calculateFinancialHealthScore([], [], undefined);

  console.log(`  • Score: ${freshHealth.score}`);
  console.log(`  • Status: ${freshHealth.status}`);
  console.log(`  • Saving Consistency: ${freshHealth.factors.savingConsistency}%`);
  console.log(`  • Spending Control: ${freshHealth.factors.spendingControl}%`);
  console.log(`  • Cash Flow Stability: ${freshHealth.factors.cashFlowStability}%`);
  console.log(`  • Goal Progress: ${freshHealth.factors.goalProgress}%`);

  assert.notEqual(freshHealth.score, 84, 'Score must NOT be hardcoded 84/100');
  assert.equal(freshHealth.score, 0, 'Score must be 0 or null for insufficient data');
  assert.notEqual(freshHealth.factors.savingConsistency, 98, 'Saving Consistency must not be fake 98%');
  assert.notEqual(freshHealth.factors.spendingControl, 71, 'Spending Control must not be fake 71%');
  assert.notEqual(freshHealth.factors.cashFlowStability, 79, 'Cash Flow Stability must not be fake 79%');
  assert.notEqual(freshHealth.factors.goalProgress, 84, 'Goal Progress must not be fake 84%');
  assert.equal(freshHealth.factors.savingConsistency, 0, 'Saving Consistency must be 0%');
  assert.equal(freshHealth.factors.spendingControl, 0, 'Spending Control must be 0%');
  assert.equal(freshHealth.factors.cashFlowStability, 0, 'Cash Flow Stability must be 0%');
  assert.equal(freshHealth.factors.goalProgress, 0, 'Goal Progress must be 0%');
  console.log('✓ TEST 3 PASSED: Health Score returns 0 / Insufficient Data without any fake benchmarks.\n');

  // TEST 4: Query AI Coach endpoint as authenticated fresh user
  console.log('[TEST 4] Querying AI Coach endpoint as authenticated fresh user...');
  const coachRes = await fetch(`${BASE_URL}/api/ai/coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData.token}`,
    },
    body: JSON.stringify({
      message: 'What is my current monthly spending and savings?',
      language: 'en',
    }),
  });

  const coachData = await coachRes.json();
  assert.equal(coachRes.status, 200, 'Coach query should return 200');
  console.log('  • Coach Response Preview:');
  console.log(`    ${coachData.answer.slice(0, 180)}...`);

  // Verify response does not leak Ahmed's ৳38,500 or ৳29,200
  assert.ok(!coachData.answer.includes('38,500'), 'Must not contain Ahmed income ৳38,500');
  assert.ok(!coachData.answer.includes('29,200'), 'Must not contain Ahmed spending ৳29,200');
  console.log('✓ TEST 4 PASSED: AI Coach responds using fresh user context with zero data leakage.\n');

  // TEST 5: Add a real recurring obligation and verify forecast re-calculates dynamically
  console.log('[TEST 5] Adding user recurring obligation (Rent: ৳15,000 on Day 25)...');
  const userObligations = [
    {
      id: 'obl-rent-1',
      name: 'House Rent',
      amount: 15000,
      dueDay: 25,
      recurrenceRule: 'monthly',
      isEnabled: true,
    },
  ];

  const forecastWithRent = getDetailedForecast(20000, false, [], userObligations);
  console.log(`  • Starting Balance: ৳${forecastWithRent.startingBalance}`);
  console.log(`  • Upcoming Bills: ৳${forecastWithRent.upcomingBills}`);
  console.log(`  • Closing Balance: ৳${forecastWithRent.projectedMonthEnd}`);
  console.log(`  • Pressure Days: [${forecastWithRent.pressureDays.join(', ')}]`);

  assert.equal(forecastWithRent.upcomingBills, 15000, 'Upcoming bills must match ৳15,000');
  assert.equal(forecastWithRent.projectedMonthEnd, 5000, 'Closing balance must be 20000 - 15000 = 5000');
  assert.equal(forecastWithRent.forecastCurve[23].projectedBalance, 20000, 'Day 24 balance must be 20000');
  assert.equal(forecastWithRent.forecastCurve[24].projectedBalance, 5000, 'Day 25 balance must reflect rent deduction');
  console.log('✓ TEST 5 PASSED: Forecast dynamically updates with authentic obligations.\n');

  // CLEANUP: Delete the test user and its records from MongoDB
  console.log('[CLEANUP] Cleaning up test user from MongoDB...');
  await fetch(`${BASE_URL}/api/users/profile`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${regData.token}` },
  }).catch(() => {});
  console.log('✓ Cleanup completed.\n');

  console.log('====================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY: 100% PASS');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
