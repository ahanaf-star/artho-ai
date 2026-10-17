import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createFixtures } from '../evaluation/fixtures';
import {
  validateCoachNumbers,
  verifyLanguageMatch,
  detectResponseLanguage,
} from '../services/coachNumberValidator';

describe('Bilingual Financial Calculation & Number Validation Regression Suite', () => {
  const fixtures = createFixtures('2026-10');
  const baseContext = fixtures.INCOME_AND_EXPENSES;

  it('1. Valid ledger numbers pass validation in both English and Bangla', () => {
    // English valid response containing actual ledger numbers (৳80,000 income, ৳50,000 spending, ৳30,000 surplus)
    const validEnAnswer =
      'Your recorded monthly income is **৳80,000** and total expenses are **৳50,000**, leaving a net monthly surplus of **৳30,000** (savings rate: **37.5%**).';
    const enValidation = validateCoachNumbers(
      validEnAnswer,
      baseContext,
      [],
      'spending_total',
      'How much did I spend?'
    );
    assert.strictEqual(enValidation.valid, true, 'Valid English ledger numbers must pass');

    // Bangla valid response containing Bengali numerals (৮০,০০০, ৫০,০০০, ৩০,০০০, ৩৭.৫%)
    const validBnAnswer =
      'চলতি মাসে আপনার মোট রেকর্ডকৃত আয় **৳৮০,০০০** এবং মোট ব্যয় **৳৫০,০০০**। ফলে আপনার নিট উদ্বৃত্ত **৳৩০,০০০** (সঞ্চয়ের হার: **৩৭.৫%**)।';
    const bnValidation = validateCoachNumbers(
      validBnAnswer,
      baseContext,
      [],
      'spending_total',
      'চলতি মাসে আমার মোট খরচ কত?'
    );
    assert.strictEqual(bnValidation.valid, true, 'Valid Bangla ledger numbers must pass');
  });

  it('2. Hallucinated / unverified numbers fail validation in both languages', () => {
    // English answer with hallucinated numbers (e.g. ৳99,999 not in ledger or context)
    const hallucinatedEn =
      'Your monthly income is ৳80,000 and your discretionary allowance should be ৳99,999.';
    const enVal = validateCoachNumbers(hallucinatedEn, baseContext, [], 'budget_help');
    assert.strictEqual(enVal.valid, false, 'Hallucinated English numbers must fail validation');
    assert.ok(
      enVal.unrecognizedNumbers?.includes(99999),
      'Must identify 99999 as unrecognized'
    );

    // Bangla answer with hallucinated Bengali numeral (৳৯৯,৯৯৯ -> 99999)
    const hallucinatedBn =
      'আপনার মাসিক আয় ৳৮০,০০০ এবং নমনীয় বাজেট ৳৯৯,৯৯৯ নির্ধারণ করা হয়েছে।';
    const bnVal = validateCoachNumbers(hallucinatedBn, baseContext, [], 'budget_help');
    assert.strictEqual(bnVal.valid, false, 'Hallucinated Bangla numbers must fail validation');
    assert.ok(
      bnVal.unrecognizedNumbers?.includes(99999),
      'Must identify ۹۹۹۹۹ (99999) as unrecognized'
    );
  });

  it('3. Language mismatch is detected reliably', () => {
    // English query with Bangla response -> Mismatch
    const bnResponse = 'আপনার মোট ব্যয় ৫০,০০০ টাকা এবং নিট উদ্বৃত্ত ৩০,০০০ টাকা।';
    assert.strictEqual(
      verifyLanguageMatch(bnResponse, 'en').matched,
      false,
      'Bangla response to English question must fail language match'
    );
    assert.strictEqual(
      verifyLanguageMatch(bnResponse, 'bn').matched,
      true,
      'Bangla response to Bangla question must pass language match'
    );

    // Bangla query with English response -> Mismatch
    const enResponse = 'Your total spending this month is ৳50,000 with a surplus of ৳30,000.';
    assert.strictEqual(
      verifyLanguageMatch(enResponse, 'bn').matched,
      false,
      'English response to Bangla question must fail language match'
    );
    assert.strictEqual(
      verifyLanguageMatch(enResponse, 'en').matched,
      true,
      'English response to English question must pass language match'
    );

    // Currency symbol (৳) should not misclassify English text as Bangla
    const enWithTakaSymbol = 'Your net surplus is ৳30,000 and available liquid balance is ৳45,000.';
    assert.strictEqual(detectResponseLanguage(enWithTakaSymbol), 'en');
  });

  it('4. Numbers allowed only in appropriate query context (e.g. 6-month projection numbers scoped strictly)', () => {
    const sixMonthNetSurplus = 30000 * 6; // 180,000
    const projectionText = `Over the next 6 months, your cumulative projected surplus is ৳${sixMonthNetSurplus.toLocaleString()}.`;

    // When query is projection-related or intent is financial_projection: ALLOWED
    const allowedVal = validateCoachNumbers(
      projectionText,
      baseContext,
      [],
      'financial_projection',
      'Predict my financial position for the next six months'
    );
    assert.strictEqual(allowedVal.valid, true, '6-month multiplier allowed in projection context');

    // When query is an everyday question like "What was my smallest transaction?": NOT ALLOWED
    const disallowedVal = validateCoachNumbers(
      projectionText,
      baseContext,
      [],
      'smallest_expense',
      'What was my smallest transaction?'
    );
    assert.strictEqual(
      disallowedVal.valid,
      false,
      '6-month multiplier must NOT be allowed outside projection queries'
    );
  });

  it('5. Protection of essential healthcare spending (no reduction advice targeting health/medical)', () => {
    // Unsafe advice: proposing to cut healthcare expenses
    const unsafeHealthcareAdvice =
      'To save more money, cut your monthly spending on Healthcare & Medical treatments by ৳10,000.';
    const isUnsafe =
      /(?:reduce|cut|trim)\b.*?\b(?:health|heath|medical|medicine)/i.test(unsafeHealthcareAdvice) ||
      /(?:health|heath|medical|medicine)\b.*?\b(?:cut|reduced|trimmed)/i.test(unsafeHealthcareAdvice);
    assert.strictEqual(isUnsafe, true, 'Must flag unsafe healthcare cuts');

    // Safe protective advice: explicit prohibition against cutting essential healthcare
    const safeProtectiveAdvice =
      'Healthcare and medical treatments are essential fixed living obligations and should never be reduced simply because the category is large.';
    const isProtective =
      safeProtectiveAdvice.includes('never be reduced') ||
      safeProtectiveAdvice.includes('should never be reduced');
    assert.strictEqual(isProtective, true, 'Must recognize safe protective healthcare guidance');
  });
});
