import { maskAccountIdentifier, COMMON_PROVIDERS, ACCOUNT_TYPES } from '../src/components/WalletsManagementSection';
import { SUPPORTED_CURRENCIES, convertAmount, normalizeCurrencyCode } from '../src/services/currencyService';
import { calculateFinancialHealthScore } from '../src/services/financialCalculations';
import { Transaction, SavingsGoal } from '../src/types/financial';

async function runTests() {
  console.log('=== TEST 1: Unit Test maskAccountIdentifier ===');
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

  console.log('=== TEST 2: Supported Currencies & Exact Display Formats Verification ===');
  const requiredCurrencies = [
    { code: 'BDT', display: 'Bangladeshi Taka (৳)' },
    { code: 'USD', display: 'US Dollar ($)' },
    { code: 'EUR', display: 'Euro (€)' },
    { code: 'GBP', display: 'British Pound (£)' },
    { code: 'INR', display: 'Indian Rupee (₹)' },
    { code: 'AUD', display: 'Australian Dollar (A$)' },
    { code: 'CAD', display: 'Canadian Dollar (C$)' },
    { code: 'JPY', display: 'Japanese Yen (¥)' },
    { code: 'SAR', display: 'Saudi Riyal (SAR)' },
  ];

  for (const item of requiredCurrencies) {
    const config = SUPPORTED_CURRENCIES.find((c) => c.code === item.code);
    if (!config) {
      throw new Error(`Missing expected currency in SUPPORTED_CURRENCIES: ${item.code}`);
    }
    const displayStr = `${config.name} (${config.displaySymbol})`;
    if (displayStr !== item.display) {
      throw new Error(`Currency display mismatch for ${item.code}: expected "${item.display}", got "${displayStr}"`);
    }
  }
  console.log(`✓ All 9 required currencies verified with exact display matching:`);
  requiredCurrencies.forEach((c) => console.log(`   - ${c.code}: ${c.display}`));

  const BASE_URL = 'http://localhost:3000';
  const userId = 'usr-ahmed-01';
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  console.log('=== TEST 3: Monthly Inflow Baseline Multi-Currency & Persistence Tests ===');

  // Initial user state check
  const getUserRes = await fetch(`${BASE_URL}/api/users/${userId}`);
  const initialUser = await getUserRes.json();
  const initialDisplayCurrency = initialUser.currency || 'BDT';
  console.log(`✓ User initial display currency: ${initialDisplayCurrency}`);

  // A. Test BDT, USD, EUR, INR selections, saving, and reloading
  const testCurrencyCases = [
    { amount: 50000, currency: 'BDT' },
    { amount: 3500, currency: 'USD' },
    { amount: 3200, currency: 'EUR' },
    { amount: 150000, currency: 'INR' },
  ];

  for (const tc of testCurrencyCases) {
    const updateRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        monthlyIncome: tc.amount,
        monthlyIncomeCurrency: tc.currency,
      }),
    });
    if (!updateRes.ok) {
      throw new Error(`Failed to update baseline for ${tc.currency}: ${updateRes.status}`);
    }
    const updated = await updateRes.json();
    if (updated.monthlyIncome !== tc.amount || updated.monthlyIncomeCurrency !== tc.currency) {
      throw new Error(`Update mismatch for ${tc.currency}: expected amount ${tc.amount}, currency ${tc.currency}`);
    }

    // Reload from server (GET) to verify persistent reload
    const reloadRes = await fetch(`${BASE_URL}/api/users/${userId}`);
    const reloaded = await reloadRes.json();
    if (reloaded.monthlyIncome !== tc.amount || reloaded.monthlyIncomeCurrency !== tc.currency) {
      throw new Error(`Reload mismatch for ${tc.currency}: expected amount ${tc.amount}, currency ${tc.currency}`);
    }
    console.log(`✓ Persisted and reloaded baseline for ${tc.currency}: ${reloaded.monthlyIncome} ${reloaded.monthlyIncomeCurrency}`);
  }

  // B. Verify changing baseline currency does NOT change Display & Base Currency setting
  const baselineCurrencyChangeRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: 4000,
      monthlyIncomeCurrency: 'USD',
    }),
  });
  const afterBaselineChange = await baselineCurrencyChangeRes.json();
  if (afterBaselineChange.currency !== initialDisplayCurrency) {
    throw new Error('Changing monthlyIncomeCurrency must not change Display & Base Currency preference');
  }
  console.log(`✓ Changing baseline currency did not touch Display & Base Currency (${afterBaselineChange.currency}).`);

  // C. Verify changing currency does NOT silently alter the numeric amount
  const switchCurrencyRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: 4000,
      monthlyIncomeCurrency: 'EUR',
    }),
  });
  const switchedUser = await switchCurrencyRes.json();
  if (switchedUser.monthlyIncome !== 4000 || switchedUser.monthlyIncomeCurrency !== 'EUR') {
    throw new Error('Switching baseline currency must preserve exact numeric amount (4000)');
  }
  console.log('✓ Switching currency preserved amount at 4000 without accidental conversion.');

  // D. Test zero baseline value
  const zeroIncomeRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: 0,
      monthlyIncomeCurrency: 'BDT',
    }),
  });
  const userZeroIncome = await zeroIncomeRes.json();
  if (userZeroIncome.monthlyIncome !== 0) {
    throw new Error('Zero monthly income should be accepted');
  }
  console.log('✓ Zero monthly income baseline accepted.');

  // E. Test empty/null baseline value (optional field)
  const emptyIncomeRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: null,
      monthlyIncomeCurrency: 'USD',
    }),
  });
  const userEmptyIncome = await emptyIncomeRes.json();
  if (userEmptyIncome.monthlyIncome !== null && userEmptyIncome.monthlyIncome !== undefined) {
    throw new Error('Empty monthly income should be accepted as null/unset');
  }
  console.log('✓ Empty baseline value saved successfully as null/unset.');

  // F. Test negative value rejection
  const negativeIncomeRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: -500,
    }),
  });
  if (negativeIncomeRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for negative monthlyIncome, got ${negativeIncomeRes.status}`);
  }
  console.log('✓ Negative monthly income rejected with status 400.');

  // G. Test invalid string amount rejection
  const invalidAmountRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: 'invalid-not-a-number',
    }),
  });
  if (invalidAmountRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for invalid monthlyIncome string, got ${invalidAmountRes.status}`);
  }
  console.log('✓ Invalid string monthly income rejected with status 400.');

  // H. Test invalid currency code rejection
  const invalidCurrencyRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncomeCurrency: 'XYZ_INVALID',
    }),
  });
  if (invalidCurrencyRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for invalid currency, got ${invalidCurrencyRes.status}`);
  }
  console.log('✓ Invalid currency code rejected with status 400.');

  // I. Test Financial Calculation Safety: calculateFinancialHealthScore with USD vs BDT
  const dummyTx: Transaction = {
    id: 'tx-test-1',
    description: 'Test Grocery',
    merchant: 'Super Shop',
    amount: 10000,
    category: 'Food & Groceries',
    type: 'expense',
    date: '2026-10-01',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: 'essential',
  };
  const dummyGoals: SavingsGoal[] = [
    {
      id: 'goal-emergency-1',
      title: 'Emergency Fund',
      targetAmount: 100000,
      currentAmount: 50000,
      deadline: '2027-12-31',
      category: 'Emergency',
      icon: 'savings',
      monthlyPace: 5000,
      accountVault: 'bKash',
      status: 'On Track',
    },
  ];

  // USD income $1,000 -> in BDT is approx ৳122,000 (well above ৳10,000 expense, resulting in positive savings rate)
  const healthUSD = calculateFinancialHealthScore({
    transactions: [dummyTx],
    goals: dummyGoals,
    monthlyIncome: 1000,
    monthlyIncomeCurrency: 'USD',
  });

  // If USD was mistakenly treated as 1,000 BDT, expense of 10,000 BDT would mean severe deficit (effectiveIncome <= 0 or deficit)
  const savingsComp = healthUSD.components?.find((c) => c.key === 'savings_rate');
  if (!savingsComp || savingsComp.status === 'zero_income' || (savingsComp.score ?? 0) < 50) {
    throw new Error(`USD $1,000 must be converted to BDT (~৳122,000) for health score calculation, but got score: ${savingsComp?.score}`);
  }
  console.log(`✓ Financial calculation safety verified: USD $1,000 properly converted to BDT for health calculation (savings rate score = ${savingsComp.score}/100).`);

  console.log('=== TEST 4: Wallets & Banking Accounts Multi-Currency CRUD ===');
  // A. Create BDT MFS account (bKash)
  const createBdtRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountType: 'Mobile Financial Service (MFS)',
      provider: 'bKash',
      displayName: 'Personal bKash',
      accountNumber: '01712345678',
      currency: 'BDT',
      balance: 15000,
      notes: 'Primary personal wallet',
    }),
  });
  const bdtWallet = await createBdtRes.json();
  console.log('✓ Created BDT Wallet:', bdtWallet.provider, bdtWallet.balance, bdtWallet.currency);
  if (bdtWallet.currency !== 'BDT' || bdtWallet.balance !== 15000) {
    throw new Error('BDT wallet mismatch');
  }

  // B. Create USD Bank Account (Wise)
  const createUsdRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountType: 'Bank Account',
      provider: 'Wise',
      displayName: 'USD Direct Deposit',
      accountNumber: '11223344',
      currency: 'USD',
      balance: 2000,
      notes: 'USD Freelance',
    }),
  });
  const usdWallet = await createUsdRes.json();
  console.log('✓ Created USD Wallet:', usdWallet.provider, usdWallet.balance, usdWallet.currency);
  if (usdWallet.currency !== 'USD' || usdWallet.balance !== 2000) {
    throw new Error('USD wallet mismatch');
  }

  // C. Create older account with omitted currency (must default safely to BDT)
  const createLegacyRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountType: 'Bank Account',
      provider: 'City Bank',
      balance: 25000,
    }),
  });
  const legacyWallet = await createLegacyRes.json();
  console.log('✓ Legacy account (no currency provided) defaulted to:', legacyWallet.currency);
  if (legacyWallet.currency !== 'BDT' || legacyWallet.balance !== 25000) {
    throw new Error('Legacy account must default currency to BDT without losing balance');
  }

  // D. Test negative wallet balance rejection
  const negativeWalletRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountType: 'Bank Account',
      provider: 'Test Bank',
      balance: -100,
    }),
  });
  if (negativeWalletRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request for negative wallet balance, got ${negativeWalletRes.status}`);
  }
  console.log('✓ Negative wallet balance rejected with status 400.');

  // E. Retrieve all accounts
  const getAllRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets`, {
    headers: authHeaders,
  });
  const allWallets = await getAllRes.json();
  console.log(`✓ Retrieved ${allWallets.length} wallet accounts.`);
  if (!allWallets.some((w: any) => w.id === bdtWallet.id) || !allWallets.some((w: any) => w.id === usdWallet.id)) {
    throw new Error('Created accounts missing in retrieval list');
  }

  // F. Verify mixed-currency conversion calculation
  // Total in BDT: BDT 15000 + USD 2000 converted to BDT + BDT 25000
  const usdInBdt = convertAmount(2000, 'USD', 'BDT');
  const expectedTotalBdt = 15000 + usdInBdt + 25000;
  console.log(`✓ Mixed Currency Conversion Test: USD $2,000 in BDT = ৳${usdInBdt.toFixed(2)}, Expected Total = ৳${expectedTotalBdt.toFixed(2)}`);
  if (usdInBdt <= 2000) {
    throw new Error('USD must be converted using real exchange rate, not treated as 1:1 with BDT');
  }

  // G. Update USD wallet account (change currency to GBP, balance to 1800)
  const updateUsdRes = await fetch(`${BASE_URL}/api/users/${userId}/wallets/${usdWallet.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      currency: 'GBP',
      balance: 1800,
      notes: 'Switched to GBP Account',
    }),
  });
  const updatedUsd = await updateUsdRes.json();
  console.log('✓ Updated Wallet:', updatedUsd.currency, updatedUsd.balance, updatedUsd.notes);
  if (updatedUsd.currency !== 'GBP' || updatedUsd.balance !== 1800) {
    throw new Error('Wallet currency or balance update failed');
  }

  // H. Clean up test accounts
  await fetch(`${BASE_URL}/api/users/${userId}/wallets/${bdtWallet.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${BASE_URL}/api/users/${userId}/wallets/${usdWallet.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${BASE_URL}/api/users/${userId}/wallets/${legacyWallet.id}`, { method: 'DELETE', headers: authHeaders });
  console.log('✓ Cleaned up test accounts.');

  console.log('=== TEST 5: Verify User Isolation & Security ===');
  const rogueUserId = 'usr-rogue-alien-99';
  const unauthorizedRes = await fetch(`${BASE_URL}/api/users/${rogueUserId}/wallets`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (unauthorizedRes.status !== 403 && unauthorizedRes.status !== 401) {
    throw new Error(`Expected 401/403 for unauthorized access, got ${unauthorizedRes.status}`);
  }
  console.log(`✓ User isolation enforced properly (blocked with status ${unauthorizedRes.status}).`);

  console.log('\n======================================================');
  console.log('ALL MONTHLY INFLOW & WALLET MULTI-CURRENCY TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
