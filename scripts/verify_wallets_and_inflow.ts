import { maskAccountIdentifier, COMMON_PROVIDERS, ACCOUNT_TYPES } from '../src/components/WalletsManagementSection';
import { SUPPORTED_CURRENCIES, convertAmount, normalizeCurrencyCode } from '../src/services/currencyService';

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

  console.log('=== TEST 2: Supported Currencies & Providers Verification ===');
  const expectedCurrencies = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'SAR'];
  const availableCodes = SUPPORTED_CURRENCIES.map((c) => c.code);
  for (const code of expectedCurrencies) {
    if (!availableCodes.includes(code)) {
      throw new Error(`Missing expected currency in SUPPORTED_CURRENCIES: ${code}`);
    }
  }
  console.log(`✓ All expected currencies available: ${availableCodes.join(', ')}`);

  const BASE_URL = 'http://localhost:3000';
  const userId = 'usr-ahmed-01';
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  console.log('=== TEST 3: Monthly Inflow Baseline Multi-Currency Tests ===');
  // A. Save Monthly Inflow with USD currency
  const updateIncomeRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: 3500,
      monthlyIncomeCurrency: 'USD',
    }),
  });

  if (!updateIncomeRes.ok) {
    throw new Error(`Failed to update monthly inflow: ${updateIncomeRes.status}`);
  }
  const updatedUser = await updateIncomeRes.json();
  console.log(`✓ Monthly Inflow updated: amount = ${updatedUser.monthlyIncome}, currency = ${updatedUser.monthlyIncomeCurrency}`);
  if (updatedUser.monthlyIncome !== 3500 || updatedUser.monthlyIncomeCurrency !== 'USD') {
    throw new Error('Monthly inflow amount or currency did not persist as expected');
  }

  // B. Change currency independently without altering amount
  const changeCurrencyRes = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyIncome: 3500,
      monthlyIncomeCurrency: 'EUR',
    }),
  });
  const userAfterCurrencyChange = await changeCurrencyRes.json();
  if (userAfterCurrencyChange.monthlyIncome !== 3500 || userAfterCurrencyChange.monthlyIncomeCurrency !== 'EUR') {
    throw new Error('Currency change should preserve the exact numeric amount without accidental conversion');
  }
  console.log(`✓ Currency changed to EUR independently; amount preserved at ${userAfterCurrencyChange.monthlyIncome}`);

  // C. Test zero baseline value
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

  // D. Test negative value rejection
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

  // E. Test invalid currency code rejection
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
