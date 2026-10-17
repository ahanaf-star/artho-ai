import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildCoachContextFromData, CoachContext } from '../services/coachContextBuilder';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { validateCoachNumbers, verifyLanguageMatch } from '../services/coachNumberValidator';
import { Transaction } from '../../src/types/financial';

function createSingleEducationFixture(): CoachContext {
  const txs: Transaction[] = [
    {
      id: 'tx-inc-50k',
      type: 'income',
      amount: 50000,
      category: 'Salary',
      merchant: 'Tech Employer Inc',
      description: 'Monthly Salary Inflow',
      date: '2026-10-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-exp-2k-edu',
      type: 'expense',
      amount: 2000,
      category: 'Education',
      merchant: 'Dhaka University',
      description: 'Tuition and Course Materials',
      date: '2026-10-05',
      account: 'bKash',
      paymentMethod: 'bKash QR Direct',
      classification: 'essential',
    },
  ];

  return buildCoachContextFromData(txs, [], null, {
    targetMonth: '2026-10',
    today: '2026-10-18',
  });
}

function createHealthcareFixture(): CoachContext {
  const txs: Transaction[] = [
    {
      id: 'tx-inc-250k',
      type: 'income',
      amount: 250000,
      category: 'Salary',
      merchant: 'Executive Corporation',
      description: 'Executive Salary',
      date: '2026-10-01',
      account: 'City Bank',
      paymentMethod: 'Bank Transfer',
      classification: 'essential',
    },
    {
      id: 'tx-exp-170k-health',
      type: 'expense',
      amount: 170000,
      category: 'Heath',
      merchant: 'Square Hospital',
      description: 'Hospital Admission & Surgery',
      date: '2026-10-10',
      account: 'City Bank',
      paymentMethod: 'Card',
      classification: 'essential',
    },
    {
      id: 'tx-exp-1994-health',
      type: 'expense',
      amount: 1994,
      category: 'Heath',
      merchant: 'Lazz Pharma',
      description: 'Prescription Medication',
      date: '2026-10-12',
      account: 'bKash',
      paymentMethod: 'bKash QR Direct',
      classification: 'essential',
    },
    {
      id: 'tx-exp-550-util',
      type: 'expense',
      amount: 550,
      category: 'Electricity',
      merchant: 'DESCO',
      description: 'Monthly DESCO bill',
      date: '2026-10-14',
      account: 'bKash',
      paymentMethod: 'bKash Bill Pay',
      classification: 'essential',
    },
  ];

  return buildCoachContextFromData(txs, [], null, {
    targetMonth: '2026-10',
    today: '2026-10-18',
  });
}

describe('AI Coach Cross-Response Consistency & Financial Grounding', () => {
  const eduContext = createSingleEducationFixture();
  const healthContext = createHealthcareFixture();

  // =========================================================================
  // 1. CATEGORY ATTRIBUTION ACCURACY
  // =========================================================================
  describe('1. Category Attribution Accuracy', () => {
    it('1.1: Question 1 identifies Education as top expense category', async () => {
      const q1 = 'What is my largest expense category?';
      const res1 = await executeCoachInquiry({ query: q1, fullContext: eduContext, language: 'en' });

      assert.strictEqual(res1.source, 'fallback');
      assert.ok(res1.answer.includes('Education'), 'Must name Education');
      assert.ok(res1.answer.includes('2,000'), 'Must cite ৳2,000');
      assert.ok(!res1.answer.toLowerCase().includes('heath'), 'Must not claim Heath');
      assert.ok(!res1.answer.toLowerCase().includes('medical'), 'Must not claim Medical');
    });

    it('1.2: Question 2 recommendations preserve Education category and NEVER call it healthcare', async () => {
      const q2 = 'What are the 3 most important actions I should take to improve my financial health?';
      const res2 = await executeCoachInquiry({ query: q2, fullContext: eduContext, language: 'en' });

      assert.strictEqual(res2.source, 'fallback');
      // Must cite Education accurately
      assert.ok(res2.answer.includes('Education'), 'Recommendations must cite Education');
      assert.ok(res2.answer.includes('2,000'), 'Must cite ৳2,000 amount');

      // Crucial: Must NEVER brand Education as healthcare outflows
      assert.ok(
        !res2.answer.toLowerCase().includes('healthcare outflows in education'),
        'Must NOT claim healthcare outflows in Education'
      );
      assert.ok(
        !res2.answer.toLowerCase().includes('unplanned medical costs'),
        'Must NOT claim unplanned medical costs when user has 0 medical spending'
      );
      assert.ok(
        !res2.answer.toLowerCase().includes('dedicated emergency healthcare reserve'),
        'Must NOT recommend healthcare reserve when no medical spending exists'
      );

      // Must instead recommend general emergency living cushion
      assert.ok(
        res2.answer.includes('Build a Liquid Emergency Living Cushion') ||
        res2.answer.includes('Emergency Living Cushion'),
        'Must recommend liquid emergency living cushion'
      );
    });
  });

  // =========================================================================
  // 2. SAVINGS RECOMMENDATION & UNALLOCATED REMAINDER GROUNDING
  // =========================================================================
  describe('2. Savings Recommendation & Unallocated Remainder Grounding', () => {
    it('2.1: Explains ৳48,000 is an unallocated remainder, not confirmed safe savings capacity', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      // Must cite calculated remainder ৳48,000
      assert.ok(res.answer.includes('48,000'), 'Must cite calculated surplus of ৳48,000');

      // Must describe it as unallocated remainder or pending living costs
      assert.ok(
        res.answer.toLowerCase().includes('unallocated') ||
        res.answer.toLowerCase().includes('unrecorded') ||
        res.answer.toLowerCase().includes('pending'),
        'Must explain that remainder represents unallocated/unrecorded living costs'
      );

      // Must NOT tell the user to lock away ৳48,000/month into savings
      assert.ok(
        !res.answer.includes('transfer of ৳48,000') && !res.answer.includes('save ৳48,000/month'),
        'Must NOT advise locking away the full ৳48,000 surplus'
      );

      // Must recommend prudent baseline savings rate (e.g. 10%-20% or ~৳7,500)
      assert.ok(
        res.answer.includes('10%–20%') || res.answer.includes('10%') || res.answer.includes('7,500'),
        'Must recommend a prudent baseline rate (10%-20%)'
      );
    });
  });

  // =========================================================================
  // 3. DATA SUFFICIENCY & UNRECORDED LIVING EXPENSES
  // =========================================================================
  describe('3. Data Sufficiency & Living Expense Baseline', () => {
    it('3.1: Recommends establishing living expense baseline (rent, food, utilities)', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      // Action 3 focuses on establishing a complete expense baseline
      assert.ok(
        res.answer.includes('Establish a Complete Living Expense Baseline') ||
        res.answer.includes('Expense Baseline'),
        'Action 3 must focus on establishing living expense baseline'
      );

      // Must mention common living expenses like housing/rent, groceries/food, utilities
      assert.ok(
        res.answer.toLowerCase().includes('housing') ||
        res.answer.toLowerCase().includes('groceries') ||
        res.answer.toLowerCase().includes('utilities'),
        'Must mention unrecorded categories like housing, groceries, or utilities'
      );
    });
  });

  // =========================================================================
  // 4. FINANCIAL HEALTH SCORE GROUNDING
  // =========================================================================
  describe('4. Financial Health Score Grounding', () => {
    it('4.1: Cites score with preliminary / low-confidence caveat for sparse data', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      // Must identify the score as preliminary due to limited history
      assert.ok(
        res.answer.includes('Preliminary') || res.answer.includes('limited history'),
        'Must state score is preliminary due to limited data'
      );
    });
  });

  // =========================================================================
  // 5. APPLICATION FEATURE INTEGRITY
  // =========================================================================
  describe('5. Application Feature Integrity (No Vault Claims)', () => {
    it('5.1: Does not claim ArthoBachao AI has built-in savings vaults or automated payday transfers', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      assert.ok(!res.answer.toLowerCase().includes('savings vault'), 'Must not claim savings vault');
      assert.ok(!res.answer.toLowerCase().includes('high-yield savings vault'), 'Must not claim high-yield savings vault');
    });

    it('5.2: Budget help does not claim dedicated savings vault', async () => {
      const q = 'Help me build a monthly budget';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      assert.ok(!res.answer.toLowerCase().includes('savings vault'), 'Must not claim savings vault in budget help');
    });
  });

  // =========================================================================
  // 6. BENGALI LANGUAGE PARITY
  // =========================================================================
  describe('6. Bengali Language Parity', () => {
    it('6.1: Bengali Question 1 identifies Education category correctly', async () => {
      const qBn = 'আমার সবচেয়ে বেশি খরচ কোন খাতে?';
      const res = await executeCoachInquiry({ query: qBn, fullContext: eduContext, language: 'bn' });

      assert.strictEqual(res.source, 'fallback');
      assert.ok(res.answer.includes('Education'), 'Must mention Education in Bengali response');
      assert.ok(res.answer.includes('২,০০০') || res.answer.includes('2,000'), 'Must cite 2,000');
      const langCheck = verifyLanguageMatch(res.answer, 'bn');
      assert.strictEqual(langCheck.matched, true, 'Must be valid Bangla');
    });

    it('6.2: Bengali Question 2 provides grounded recommendations without medical misattribution', async () => {
      const qBn = 'আমার আর্থিক স্বাস্থ্য উন্নত করতে কোন ৩টি পদক্ষেপ নেওয়া উচিত?';
      const res = await executeCoachInquiry({ query: qBn, fullContext: eduContext, language: 'bn' });

      assert.strictEqual(res.source, 'fallback');
      assert.ok(res.answer.includes('১.') && res.answer.includes('২.') && res.answer.includes('৩.'), 'Must have 3 numbered actions');

      // Action 1: Living cushion, not false medical reserve
      assert.ok(res.answer.includes('Education'), 'Must cite Education');
      assert.ok(!res.answer.includes('চিকিৎসা ব্যয় হয়েছে'), 'Must not claim medical spending in Education');
      assert.ok(res.answer.includes('জরুরি জীবনযাত্রার তহবিল') || res.answer.includes('Emergency Living Cushion'), 'Must recommend living cushion');

      // Action 2: Unallocated remainder
      assert.ok(res.answer.includes('৪৮,০০০') || res.answer.includes('48,000'), 'Must cite ৳48,000');
      assert.ok(res.answer.includes('অবণ্টিত উদ্বৃত্ত') || res.answer.includes('নিশ্চিত ডিসপোজেবল উদ্বৃত্ত নয়'), 'Must explain unallocated surplus');

      // Action 3: Living expense baseline
      assert.ok(res.answer.includes('বাসা ভাড়া') || res.answer.includes('বাজার'), 'Must advise logging rent and food');

      // Health score is preliminary
      assert.ok(res.answer.includes('প্রাথমিক') || res.answer.includes('সীমিত তথ্যের কারণে'), 'Must state preliminary score in Bengali');

      // Feature claims: No vault
      assert.ok(!res.answer.includes('ভল্ট'), 'Must not claim in-app vault in Bengali');

      const langCheck = verifyLanguageMatch(res.answer, 'bn');
      assert.strictEqual(langCheck.matched, true, 'Must be valid Bangla');
    });
  });

  // =========================================================================
  // 7. CONTEXT ISOLATION BETWEEN DIFFERENT USERS
  // =========================================================================
  describe('7. Context Isolation Between Users', () => {
    it('7.1: User B with genuine healthcare spending receives healthcare recommendations', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: healthContext, language: 'en' });

      // User B actually has Heath spending (৳171,994)
      assert.ok(res.answer.includes('Heath'), 'User B recommendations must cite Heath');
      assert.ok(res.answer.includes('171,994'), 'User B recommendations must cite ৳171,994');
      assert.ok(res.answer.includes('Dedicated Emergency Healthcare Reserve'), 'User B must receive healthcare reserve action');

      // User B response must NEVER mention User A data
      assert.ok(!res.answer.includes('Education'), 'User B response must not mention Education');
      assert.ok(!/(^|[^\d])50,000([^\d]|$)/.test(res.answer), 'User B response must not cite User A 50,000 income');
    });

    it('7.2: User A response never mentions User B healthcare data', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      assert.ok(!res.answer.includes('Heath'), 'User A response must not cite Heath');
      assert.ok(!res.answer.includes('171,994'), 'User A response must not cite 171,994');
      assert.ok(!res.answer.includes('250,000'), 'User A response must not cite 250,000');
    });
  });

  // =========================================================================
  // 8. NUMBER VALIDATOR COMPLIANCE
  // =========================================================================
  describe('8. Number Validator Compliance', () => {
    it('8.1: Education user recommendations pass number validation', async () => {
      const q = 'What are the 3 most important actions I should take to improve my financial health?';
      const res = await executeCoachInquiry({ query: q, fullContext: eduContext, language: 'en' });

      const validation = validateCoachNumbers(res.answer, eduContext, [], 'health_recommendations', q);
      assert.strictEqual(validation.valid, true, `Validation failed: ${validation.reason}`);
    });

    it('8.2: Education user Bengali recommendations pass number validation', async () => {
      const qBn = 'আমার আর্থিক স্বাস্থ্য উন্নত করতে কোন ৩টি পদক্ষেপ নেওয়া উচিত?';
      const res = await executeCoachInquiry({ query: qBn, fullContext: eduContext, language: 'bn' });

      const validation = validateCoachNumbers(res.answer, eduContext, [], 'health_recommendations', qBn);
      assert.strictEqual(validation.valid, true, `Validation failed: ${validation.reason}`);
    });
  });
});

