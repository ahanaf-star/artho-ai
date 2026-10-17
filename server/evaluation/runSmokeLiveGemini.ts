import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { createFixtures } from './fixtures';
import { EVALUATION_TEST_CASES, TestCase } from './testCases';
import { classifyIntent } from '../services/intentClassifier';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { validateCoachNumbers, verifyLanguageMatch } from '../services/coachNumberValidator';

// Select 10 representative cases (5 English + 5 Bangla, 2 per category)
const SMOKE_CASE_IDS = [
  'TC-001', // Spending Analysis (EN)
  'TC-011', // Spending Analysis (BN)
  'TC-021', // Savings Planning (EN)
  'TC-031', // Savings Planning (BN)
  'TC-041', // Budget Planning (EN)
  'TC-051', // Budget Planning (BN)
  'TC-061', // Financial Projection (EN)
  'TC-071', // Financial Projection (BN)
  'TC-081', // Personalized Recommendations (EN)
  'TC-091', // Personalized Recommendations (BN)
];

interface SmokeResult {
  id: string;
  category: string;
  language: string;
  question: string;
  source: string;
  languageMatch: boolean;
  numbersValid: boolean;
  unverifiedNumbers: number[];
  healthcareProtected: boolean;
  passed: boolean;
  notes: string;
}

export async function runLiveGeminiSmokeTest() {
  console.log('================================================================');
  console.log(' ArthoBachao AI Coach — Live Gemini Opt-In Smoke Test');
  console.log('================================================================');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('\n[NOTICE] GEMINI_API_KEY is not configured in environment or .env.');
    console.log('Gracefully skipping live Gemini smoke test (deterministic suite remains 100% verified).');
    console.log('To execute live smoke test:');
    console.log('  1. Set GEMINI_API_KEY in your environment or .env');
    console.log('  2. Run: npm run test:coach-smoke\n');
    console.log('================================================================');
    return { skipped: true, passed: 0, total: 0 };
  }

  const aiClient = new GoogleGenAI({ apiKey });
  const fixtures = createFixtures();
  const selectedCases = EVALUATION_TEST_CASES.filter((tc) => SMOKE_CASE_IDS.includes(tc.id));
  console.log(`Executing live smoke test for ${selectedCases.length} representative cases (5 EN + 5 BN)...`);

  const results: SmokeResult[] = [];

  for (const tc of selectedCases) {
    const fixture = fixtures[tc.fixtureKey];
    if (!fixture) {
      console.warn(`[WARN] Missing fixture ${tc.fixtureKey} for ${tc.id}`);
      continue;
    }

    const intentResult = classifyIntent(tc.question, fixture.snapshot.netSavings);

    try {
      const response = await executeCoachInquiry({
        userId: 'smoke-test-synthetic-user',
        query: tc.question,
        language: tc.language,
        fullContext: fixture,
        intentResult,
        aiClient,
      });

      const langResult = verifyLanguageMatch(response.answer, tc.language);
      const langMatch = langResult.matched;
      const numberVal = validateCoachNumbers(response.answer, fixture, [], intentResult.intent, tc.question);

      // Healthcare protection check: Ensure essential health is not recommended for cuts
      const lowerAns = response.answer.toLowerCase();
      const isProtective =
        lowerAns.includes('never be reduced') ||
        lowerAns.includes('should never be reduced') ||
        lowerAns.includes('without touching essential') ||
        lowerAns.includes('protect essential') ||
        lowerAns.includes('হাত না দিয়ে') ||
        lowerAns.includes('ঝুঁকি নেওয়া অনুচিত');

      const prescribesCut =
        /(?:reduce|cut|trim)\b.*?\b(?:health|heath|medical|medicine)/i.test(lowerAns) ||
        /(?:health|heath|medical|medicine)\b.*?\b(?:cut|reduced|trimmed)/i.test(lowerAns);

      const healthcareProtected = !(prescribesCut && !isProtective);

      const unrecognized = numberVal.unrecognizedNumbers || [];
      const passed =
        response.answer.length > 20 &&
        langMatch &&
        numberVal.valid &&
        healthcareProtected;

      results.push({
        id: tc.id,
        category: tc.category,
        language: tc.language.toUpperCase(),
        question: tc.question,
        source: response.source || 'gemini',
        languageMatch: langMatch,
        numbersValid: numberVal.valid,
        unverifiedNumbers: unrecognized,
        healthcareProtected,
        passed,
        notes: passed ? `Verified (${response.source || 'gemini'})` : `Fail: ${unrecognized.length ? `unverified [${unrecognized.join(', ')}]` : !langMatch ? 'language mismatch' : 'healthcare breach'}`,
      });

      console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${tc.id} (${tc.language.toUpperCase()}) - ${tc.question.slice(0, 45)}...`);
    } catch (err: any) {
      results.push({
        id: tc.id,
        category: tc.category,
        language: tc.language.toUpperCase(),
        question: tc.question,
        source: 'error',
        languageMatch: false,
        numbersValid: false,
        unverifiedNumbers: [],
        healthcareProtected: true,
        passed: false,
        notes: `API Error: ${err.message}`,
      });
      console.log(`  [ERROR] ${tc.id} - ${err.message}`);
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n----------------------------------------------------------------');
  console.log(`Live Smoke Test Summary: ${passedCount} / ${results.length} Passed`);
  console.log('----------------------------------------------------------------');

  results.forEach((r) => {
    console.log(`  ${r.id} | ${r.language} | ${r.category} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.notes}`);
  });

  console.log('================================================================');
  return { skipped: false, passed: passedCount, total: results.length, results };
}

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runLiveGeminiSmokeTest().catch((e) => {
    console.error('Smoke test runtime exception:', e);
    process.exit(1);
  });
}
