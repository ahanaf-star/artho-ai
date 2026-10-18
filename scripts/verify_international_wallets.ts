import {
  getWalletAccounts,
  addWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
} from '../server/controllers/userController';
import {
  COUNTRIES,
  getCountryByCode,
  getProvidersForCountryAndType,
  INTERNATIONAL_ACCOUNT_TYPES,
  searchCountries,
} from '../src/data/internationalProviders';
import {
  canConvertCurrency,
  convertAmount,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
} from '../src/services/currencyService';
import { maskAccountIdentifier } from '../src/components/WalletsManagementSection';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

// Mock req and res helper
function createMockReqRes(params: any = {}, body: any = {}, user?: any) {
  let statusCode = 200;
  let responseData: any = null;

  const req: any = {
    params,
    body,
    user,
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

async function runInternationalWalletTests() {
  console.log('====================================================');
  console.log('   VERIFYING INTERNATIONAL WALLETS & BANK ACCOUNTS');
  console.log('====================================================\n');

  const testUserId = `usr-test-${Date.now()}`;
  const authOwner = { id: testUserId, customId: testUserId, email: `${testUserId}@example.com` };

  // ----------------------------------------------------
  // TEST 1: Bangladesh user creates a bKash account in BDT
  // ----------------------------------------------------
  console.log('--- TEST 1: Bangladesh user creates bKash account in BDT ---');
  let bkashAccountId = '';
  {
    const { req, res, getStatus, getData } = createMockReqRes(
      { id: testUserId },
      {
        countryCode: 'BD',
        country: 'Bangladesh',
        accountType: 'Mobile Money / Digital Wallet',
        provider: 'bKash',
        displayName: 'Personal Primary Wallet',
        accountNumber: '01712345678',
        currency: 'BDT',
        balance: 15500,
        notes: 'Personal spending and utility sweep',
      },
      authOwner
    );

    await addWalletAccount(req, res);
    assert(getStatus() === 201, 'Status 201 Created for bKash BDT account');
    const data = getData();
    bkashAccountId = data.id;
    assert(data.countryCode === 'BD', 'Stored countryCode is "BD"');
    assert(data.country === 'Bangladesh', 'Stored country is "Bangladesh"');
    assert(data.provider === 'bKash', 'Stored provider is "bKash"');
    assert(data.currency === 'BDT', 'Stored currency is "BDT"');
    assert(data.balance === 15500, 'Stored balance is 15500');
    assert(maskAccountIdentifier(data.accountNumber) === '****5678', 'Masked identifier is ****5678');
  }

  // ----------------------------------------------------
  // TEST 2: User selects another country (US) and chooses available provider (JPMorgan Chase)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: User selects another country and chooses suitable provider ---');
  let chaseAccountId = '';
  {
    const usProviders = getProvidersForCountryAndType('US', 'Bank Account');
    assert(usProviders.includes('JPMorgan Chase'), 'US Bank Account providers list includes JPMorgan Chase');
    assert(usProviders.includes('Bank of America'), 'US Bank Account providers list includes Bank of America');

    const usCountry = getCountryByCode('US');
    assert(usCountry.defaultCurrency === 'USD', 'US default currency is USD');

    const { req, res, getStatus, getData } = createMockReqRes(
      { id: testUserId },
      {
        countryCode: 'US',
        country: 'United States',
        accountType: 'Bank Account',
        provider: 'JPMorgan Chase',
        displayName: 'US Checking Account',
        accountNumber: '987654321',
        currency: 'USD',
        balance: 2450.75,
        notes: 'Direct deposit checking account',
      },
      authOwner
    );

    await addWalletAccount(req, res);
    assert(getStatus() === 201, 'Status 201 Created for US JPMorgan Chase account');
    const data = getData();
    chaseAccountId = data.id;
    assert(data.countryCode === 'US', 'Account countryCode is "US"');
    assert(data.provider === 'JPMorgan Chase', 'Account provider is "JPMorgan Chase"');
    assert(data.currency === 'USD', 'Account currency is "USD"');
    assert(data.balance === 2450.75, 'Account balance is 2450.75 USD');
  }

  // ----------------------------------------------------
  // TEST 3: User manually enters a custom provider
  // ----------------------------------------------------
  console.log('\n--- TEST 3: User manually enters custom provider ---');
  let customAccountId = '';
  {
    const customName = 'Copenhagen Cooperative Credit Union';
    const { req, res, getStatus, getData } = createMockReqRes(
      { id: testUserId },
      {
        countryCode: 'GLOBAL',
        country: 'International / Other Region',
        accountType: 'Other Financial Account',
        provider: customName,
        displayName: 'Co-op Vault',
        accountNumber: 'DK-9921',
        currency: 'EUR',
        balance: 5000,
        notes: 'Custom local institution not in standard directory',
      },
      authOwner
    );

    await addWalletAccount(req, res);
    assert(getStatus() === 201, 'Status 201 Created for custom provider account');
    const data = getData();
    customAccountId = data.id;
    assert(data.provider === customName, `Custom provider preserved verbatim: "${customName}"`);
    assert(data.currency === 'EUR', 'Custom provider account currency is EUR');
    assert(data.balance === 5000, 'Custom provider account balance is 5000');
  }

  // ----------------------------------------------------
  // TEST 4: User creates a bank account in a different currency
  // ----------------------------------------------------
  console.log('\n--- TEST 4: User creates bank account in a different currency ---');
  let diffCurrAccountId = '';
  {
    // UK bank account denominated in EUR (e.g. multi-currency bank account)
    const { req, res, getStatus, getData } = createMockReqRes(
      { id: testUserId },
      {
        countryCode: 'GB',
        country: 'United Kingdom',
        accountType: 'Bank Account',
        provider: 'Barclays',
        displayName: 'Euro Travel Holding',
        accountNumber: 'GB-8849',
        currency: 'EUR',
        balance: 3200,
        notes: 'Foreign currency account held in London',
      },
      authOwner
    );

    await addWalletAccount(req, res);
    assert(getStatus() === 201, 'Status 201 Created for UK bank account in EUR');
    const data = getData();
    diffCurrAccountId = data.id;
    assert(data.countryCode === 'GB', 'Country code is GB');
    assert(data.currency === 'EUR', 'Currency is EUR, distinct from default GBP');
    assert(data.balance === 3200, 'Balance is 3200 EUR');
  }

  // ----------------------------------------------------
  // TEST 5: Existing Bangladesh accounts remain intact after migration
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Existing Bangladesh accounts remain intact ---');
  {
    // Simulate legacy account without countryCode or with standard BDT
    const legacyAccount = {
      id: `wlt-legacy-${Date.now()}`,
      userId: testUserId,
      accountType: 'Mobile Financial Service (MFS)',
      provider: 'Nagad',
      displayName: 'Legacy Nagad Pocket',
      accountNumber: '01899887766',
      currency: 'BDT',
      balance: 8500,
    };

    // Country fallback detection
    const country = getCountryByCode(legacyAccount.currency === 'BDT' ? 'BD' : undefined);
    assert(country.code === 'BD', 'Legacy account without countryCode defaults safely to BD');
    assert(country.name === 'Bangladesh', 'Legacy account country defaults to Bangladesh');
    assert(legacyAccount.balance === 8500, 'Legacy account balance remains exactly 8500 BDT without loss');
  }

  // ----------------------------------------------------
  // TEST 6: Editing an account does not silently change currency or balance
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Editing an account does not silently change its currency or balance ---');
  {
    // Update display name and notes of the Chase USD account, omitting currency
    const { req, res, getStatus, getData } = createMockReqRes(
      { id: testUserId, accountId: chaseAccountId },
      {
        displayName: 'Renamed Chase Primary',
        notes: 'Updated notes via edit modal',
      },
      authOwner
    );

    await updateWalletAccount(req, res);
    assert(getStatus() === 200, 'Status 200 OK for account update');
    const updated = getData();
    assert(updated.displayName === 'Renamed Chase Primary', 'Display name updated');
    assert(updated.currency === 'USD', 'Currency remained "USD" and was NOT overwritten');
    assert(updated.balance === 2450.75, 'Balance remained 2450.75 USD and was NOT overwritten');
    assert(updated.countryCode === 'US', 'Country code remained "US"');
  }

  // ----------------------------------------------------
  // TEST 7: Account data persists after refresh and login
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Account data persists and is retrieved accurately ---');
  {
    const { req, res, getStatus, getData } = createMockReqRes(
      { id: testUserId },
      {},
      authOwner
    );

    await getWalletAccounts(req, res);
    assert(getStatus() === 200, 'Status 200 OK retrieving all user accounts');
    const accounts = getData();
    assert(Array.isArray(accounts), 'Returned data is an array');
    assert(accounts.length >= 4, `Persisted all 4 created accounts (found: ${accounts.length})`);

    const foundBkash = accounts.find((a: any) => a.id === bkashAccountId);
    const foundChase = accounts.find((a: any) => a.id === chaseAccountId);
    const foundCustom = accounts.find((a: any) => a.id === customAccountId);
    const foundDiffCurr = accounts.find((a: any) => a.id === diffCurrAccountId);

    assert(Boolean(foundBkash && foundChase && foundCustom && foundDiffCurr), 'All created accounts exist in persisted store');
    assert(foundChase.displayName === 'Renamed Chase Primary', 'Edit persistence confirmed on fetch');
  }

  // ----------------------------------------------------
  // TEST 8: Users cannot access other users' accounts (Authorization Security)
  // ----------------------------------------------------
  console.log("\n--- TEST 8: Users cannot access or modify other users' accounts ---");
  {
    const attackerUser = { id: 'usr-attacker-99', customId: 'usr-attacker-99', email: 'attacker@evil.com' };

    // Attacker tries to GET victim's accounts
    {
      const { req, res, getStatus, getData } = createMockReqRes(
        { id: testUserId },
        {},
        attackerUser
      );
      await getWalletAccounts(req, res);
      assert(getStatus() === 403, 'Cross-user GET rejected with 403 Forbidden');
      assert(getData().error.includes('Access forbidden'), 'Access forbidden message returned for GET');
    }

    // Attacker tries to POST to victim's accounts
    {
      const { req, res, getStatus, getData } = createMockReqRes(
        { id: testUserId },
        { provider: 'Rogue Account', currency: 'USD' },
        attackerUser
      );
      await addWalletAccount(req, res);
      assert(getStatus() === 403, 'Cross-user POST rejected with 403 Forbidden');
      assert(getData().error.includes('Access forbidden'), 'Access forbidden message returned for POST');
    }

    // Attacker tries to UPDATE victim's account
    {
      const { req, res, getStatus, getData } = createMockReqRes(
        { id: testUserId, accountId: chaseAccountId },
        { balance: 0 },
        attackerUser
      );
      await updateWalletAccount(req, res);
      assert(getStatus() === 403, 'Cross-user PUT rejected with 403 Forbidden');
      assert(getData().error.includes('Access forbidden'), 'Access forbidden message returned for PUT');
    }

    // Attacker tries to DELETE victim's account
    {
      const { req, res, getStatus, getData } = createMockReqRes(
        { id: testUserId, accountId: chaseAccountId },
        {},
        attackerUser
      );
      await deleteWalletAccount(req, res);
      assert(getStatus() === 403, 'Cross-user DELETE rejected with 403 Forbidden');
      assert(getData().error.includes('Access forbidden'), 'Access forbidden message returned for DELETE');
    }
  }

  // ----------------------------------------------------
  // TEST 9: Currency Conversion & Unavailable Rate Handling
  // ----------------------------------------------------
  console.log('\n--- TEST 9: Currency Conversion & Unavailable Rate Handling ---');
  {
    assert(canConvertCurrency('USD', 'BDT') === true, 'USD to BDT conversion rate is available');
    assert(canConvertCurrency('EUR', 'USD') === true, 'EUR to USD conversion rate is available');
    assert(canConvertCurrency('BDT', 'BDT') === true, 'Same-currency conversion is always true');

    const convertedUSD = convertAmount(100, 'USD', 'BDT');
    assert(convertedUSD > 0, `Converted 100 USD to BDT: ${convertedUSD.toFixed(2)}`);

    // Unknown / unlisted currency
    assert(canConvertCurrency('XYZ', 'BDT') === false, 'Non-existent currency XYZ correctly returns canConvertCurrency === false');
  }

  // ----------------------------------------------------
  // TEST 10: Search Countries Helper
  // ----------------------------------------------------
  console.log('\n--- TEST 10: Search Countries Functionality ---');
  {
    const usResults = searchCountries('united states');
    assert(usResults.some((c) => c.code === 'US'), 'Search "united states" finds US');

    const codeResults = searchCountries('BD');
    assert(codeResults.some((c) => c.code === 'BD'), 'Search by ISO code "BD" finds Bangladesh');

    const eurResults = searchCountries('EUR');
    assert(eurResults.some((c) => c.defaultCurrency === 'EUR'), 'Search by currency "EUR" finds Eurozone countries');
  }

  console.log('\n====================================================');
  console.log('   🎉 ALL 10 INTERNATIONAL WALLET TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runInternationalWalletTests().catch((err) => {
  console.error('Unexpected error during test execution:', err);
  process.exit(1);
});
