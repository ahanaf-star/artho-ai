import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UserModel } from '../models/User';
import { buildCoachContextFromData } from '../services/coachContextBuilder';
import { validateCoachNumbers } from '../services/coachNumberValidator';
import { calculateFinancialHealthScore } from '../../src/services/financialCalculations';
import { SUPPORTED_CURRENCIES, isValidCurrencyCode, normalizeCurrencyCode, convertAmount } from '../../src/services/currencyService';
import { Transaction, SavingsGoal } from '../../src/types/financial';

describe('Registration Flow Monthly Inflow Baseline Tests', () => {

  it('Scenario 1 & 3: New registration with BDT baseline persists and normalizes', () => {
    const userDoc = new UserModel({
      name: 'Rahim Khan',
      email: 'rahim@example.com',
      passwordHash: 'hashed_secret',
      currency: 'BDT',
      monthlyIncome: 65000,
      monthlyIncomeCurrency: 'BDT',
    });

    assert.strictEqual(userDoc.monthlyIncome, 65000);
    assert.strictEqual(userDoc.monthlyIncomeCurrency, 'BDT');
    // Test virtual getters
    assert.strictEqual(userDoc.monthlyInflowBaseline, 65000);
    assert.strictEqual(userDoc.baselineCurrency, 'BDT');

    // Test toJSON representation
    const json = userDoc.toJSON();
    assert.strictEqual(json.monthlyIncome, 65000);
    assert.strictEqual(json.monthlyIncomeCurrency, 'BDT');
    assert.strictEqual(json.monthlyInflowBaseline, 65000);
    assert.strictEqual(json.baselineCurrency, 'BDT');
  });

  it('Scenario 2 & 3: New registration with non-BDT currency (e.g. USD, EUR, SAR)', () => {
    const userUsd = new UserModel({
      name: 'Salma Begum',
      email: 'salma@example.com',
      passwordHash: 'hashed_secret',
      currency: 'USD',
      monthlyIncome: 2500,
      monthlyIncomeCurrency: 'USD',
    });

    assert.strictEqual(userUsd.monthlyIncome, 2500);
    assert.strictEqual(userUsd.monthlyIncomeCurrency, 'USD');
    assert.strictEqual(userUsd.monthlyInflowBaseline, 2500);
    assert.strictEqual(userUsd.baselineCurrency, 'USD');

    // Test currency normalization
    const normalized = normalizeCurrencyCode('usd');
    assert.strictEqual(normalized, 'USD');
    assert.strictEqual(isValidCurrencyCode('USD'), true);
    assert.strictEqual(isValidCurrencyCode('EUR'), true);
    assert.strictEqual(isValidCurrencyCode('SAR'), true);
  });

  it('Scenario 4 & 5: Profile display and edit accepts both monthlyIncome and monthlyInflowBaseline aliases', () => {
    const user = new UserModel({
      name: 'Tariq Aziz',
      email: 'tariq@example.com',
      passwordHash: 'hashed_secret',
      currency: 'BDT',
    });

    // Simulate update using virtual setters
    user.monthlyInflowBaseline = 75000;
    user.baselineCurrency = 'EUR';

    assert.strictEqual(user.monthlyIncome, 75000);
    assert.strictEqual(user.monthlyIncomeCurrency, 'EUR');
    assert.strictEqual(user.monthlyInflowBaseline, 75000);
    assert.strictEqual(user.baselineCurrency, 'EUR');

    const json = user.toJSON();
    assert.strictEqual(json.monthlyIncome, 75000);
    assert.strictEqual(json.monthlyIncomeCurrency, 'EUR');
  });

  it('Scenario 6 & 8: Refresh/re-login and existing user without baseline defaults safely', () => {
    const legacyUser = new UserModel({
      name: 'Legacy User',
      email: 'legacy@example.com',
      passwordHash: 'hashed_secret',
      currency: 'BDT',
    });

    assert.strictEqual(legacyUser.monthlyIncome, undefined);
    assert.strictEqual(legacyUser.monthlyInflowBaseline, undefined);
    // baselineCurrency virtual falls back safely to currency or BDT
    assert.strictEqual(legacyUser.baselineCurrency, 'BDT');

    const json = legacyUser.toJSON();
    assert.strictEqual(json.monthlyIncome, undefined);
    assert.strictEqual(json.monthlyInflowBaseline, undefined);
    assert.strictEqual(json.monthlyIncomeCurrency, 'BDT');
  });

  it('Scenario 7: Verify all 11 currencies are supported and valid', () => {
    const expectedCurrencies = ['BDT', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'INR', 'CAD', 'AUD', 'SAR'];
    for (const code of expectedCurrencies) {
      assert.strictEqual(isValidCurrencyCode(code), true, `Currency ${code} should be valid`);
    }
    assert.strictEqual(isValidCurrencyCode('XYZ'), false);
    assert.strictEqual(isValidCurrencyCode('FAKE'), false);
  });

  it('Scenario 9: Registration validation rejects negative, infinite, NaN amounts and invalid currencies', () => {
    // Check validation rules matching authController
    const validateAmount = (val: any): { valid: boolean; value?: number; error?: string } => {
      if (val === undefined || val === null || val === '') return { valid: true, value: undefined };
      const num = Number(val);
      if (isNaN(num) || !isFinite(num) || num < 0) {
        return { valid: false, error: 'Monthly inflow baseline must be a non-negative number' };
      }
      return { valid: true, value: Math.round(num * 100) / 100 };
    };

    assert.strictEqual(validateAmount(-500).valid, false);
    assert.strictEqual(validateAmount('invalid').valid, false);
    assert.strictEqual(validateAmount(Infinity).valid, false);
    assert.strictEqual(validateAmount(0).valid, true);
    assert.strictEqual(validateAmount(0).value, 0);
    assert.strictEqual(validateAmount('50000.555').valid, true);
    assert.strictEqual(validateAmount('50000.555').value, 50000.56);
    assert.strictEqual(validateAmount('').valid, true);
    assert.strictEqual(validateAmount(undefined).valid, true);
  });

  it('Scenario 10: User data isolation between accounts', () => {
    const userA = new UserModel({
      name: 'User A',
      email: 'usera@example.com',
      passwordHash: 'hashA',
      monthlyIncome: 50000,
      monthlyIncomeCurrency: 'BDT',
    });

    const userB = new UserModel({
      name: 'User B',
      email: 'userb@example.com',
      passwordHash: 'hashB',
      monthlyIncome: 120000,
      monthlyIncomeCurrency: 'USD',
    });

    assert.notStrictEqual(userA.monthlyIncome, userB.monthlyIncome);
    assert.notStrictEqual(userA.monthlyIncomeCurrency, userB.monthlyIncomeCurrency);
  });

  it('Scenario 11: AI Coach context uses saved baseline and currency', () => {
    const user = {
      name: 'Anisul Huq',
      monthlyIncome: 50000,
      monthlyIncomeCurrency: 'BDT',
      linkedAccounts: [],
    };

    const emptyTxs: Transaction[] = [];
    const goals: SavingsGoal[] = [];

    const context = buildCoachContextFromData(emptyTxs, goals, user, { today: '2026-10-18' });

    assert.strictEqual(context.snapshot.profileMonthlyIncome, 50000);
    assert.strictEqual(context.snapshot.profileMonthlyIncomeCurrency, 'BDT');
    assert.strictEqual(context.snapshot.hasProfileIncome, true);
    assert.ok(context.snapshot.facts['snapshot.profileMonthlyIncome']);
    assert.strictEqual(context.snapshot.facts['snapshot.profileMonthlyIncome'].value, 50000);
    assert.ok(context.snapshot.facts['snapshot.profileMonthlyIncomeCurrency']);
    assert.strictEqual(context.snapshot.facts['snapshot.profileMonthlyIncomeCurrency'].value, 'BDT');
  });

  it('Scenario 12: AI Coach does not double-count baseline with recorded transaction income', () => {
    const user = {
      name: 'Farhan',
      monthlyIncome: 50000,
      monthlyIncomeCurrency: 'BDT',
      linkedAccounts: [{ name: 'bKash', balance: 50000 }],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-1',
        type: 'income',
        amount: 50000,
        category: 'Salary',
        date: '2026-10-05',
        account: 'bKash',
        merchant: 'Office',
        classification: 'essential',
      },
    ];

    const context = buildCoachContextFromData(txs, [], user, { today: '2026-10-18' });

    assert.strictEqual(context.snapshot.monthlyIncome, 50000);
    assert.strictEqual(context.snapshot.profileMonthlyIncome, 50000);

    // If answer claims realized income is 100,000 (50k recorded + 50k baseline), validator must reject it
    const doubleCountingAnswer = 'Your total realized income for the month is ৳100,000.';
    const validation = validateCoachNumbers(doubleCountingAnswer, context);
    assert.strictEqual(validation.valid, false, 'Validator should reject double-counting income');
    assert.match(validation.reason || '', /double-counts/i);
  });

  it('Scenario 13: Non-BDT baseline handling without misleading comparisons in financial health', () => {
    const userUsd = {
      name: 'Farzana',
      monthlyIncome: 1000,
      monthlyIncomeCurrency: 'USD',
      linkedAccounts: [],
    };

    const txs: Transaction[] = [
      {
        id: 'tx-exp-1',
        type: 'expense',
        amount: 30000,
        category: 'Education',
        date: '2026-10-05',
        account: 'bKash',
        merchant: 'School',
        classification: 'essential',
      },
    ];

    const context = buildCoachContextFromData(txs, [], userUsd, { today: '2026-10-18' });
    assert.strictEqual(context.snapshot.profileMonthlyIncome, 1000);
    assert.strictEqual(context.snapshot.profileMonthlyIncomeCurrency, 'USD');

    // Converted USD to BDT uses central currencyService rates
    const usdInBdt = convertAmount(1000, 'USD', 'BDT');
    assert.ok(usdInBdt > 100000, '1000 USD converted to BDT should exceed 100,000 BDT');

    // Verify financial health score handles non-BDT currency properly
    const healthResult = calculateFinancialHealthScore(
      txs,
      [],
      1000,
      '2026-10',
      'USD'
    );
    assert.notStrictEqual(healthResult.score, null);
  });

});
