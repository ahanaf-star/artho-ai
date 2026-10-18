import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { createFixtures } from './fixtures';
import { EVALUATION_TEST_CASES, TestCase } from './testCases';
import { classifyIntent } from '../services/intentClassifier';
import { executeCoachInquiry } from '../services/coachGeminiService';
import { validateCoachNumbers, verifyLanguageMatch } from '../services/coachNumberValidator';
import { isConfiguredApiKey, APPROVED_GEMINI_MODELS } from '../config/geminiConfig';

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

export interface SmokeResult {
  id: string;
  category: string;
  language: string;
  question: string;
  geminiGenerated: boolean;
  fallbackUsed: boolean;
  modelUsed?: string;
  languageMatch: boolean;
  numbersValid: boolean;
  unverifiedNumbers: number[];
  healthcareProtected: boolean;
  dataSufficiencyCompliant: boolean;
  status: 'LIVE_GEMINI_PASS' | 'FALLBACK_USED' | 'API_ERROR';
  errorMessage?: string;
  notes: string;
}

export async function runLiveGeminiSmokeTest() {
  console.log('================================================================');
  console.log(' Artho AI Coach — Live Gemini Opt-In Smoke Test');
  console.log('================================================================');

  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = isConfiguredApiKey(apiKey);

  if (!isKeyConfigured) {
    const reason = !apiKey
      ? 'GEMINI_API_KEY is not configured in environment or .env'
      : 'GEMINI_API_KEY contains a placeholder value or is too short';

    console.log(`\n[API CONFIGURATION WARNING] ${reason}.`);
    console.log('Live Gemini calls cannot succeed without a valid Google GenAI key.');
    console.log('Security Notice: No secrets or credentials will be logged.');
    console.log('\nTo configure a valid key securely:');
    console.log('  1. In development: Add GEMINI_API_KEY="..." to your local .env (never commit .env)');
    console.log('  2. In production: Add GEMINI_API_KEY to Render Environment Variables dashboard');
    console.log('  3. Then re-run: npm run test:coach-smoke\n');
  } else {
    console.log(`\n[API CONFIGURATION] Detected configured GEMINI_API_KEY (${apiKey!.trim().length} chars). Testing live model calls.`);
    console.log(`[MODEL CONFIGURATION] Approved models: ${APPROVED_GEMINI_MODELS.join(', ')}`);
  }

  const aiClient = isKeyConfigured ? new GoogleGenAI({ apiKey: apiKey!.trim() }) : null;
  const fixtures = createFixtures();
  const selectedCases = EVALUATION_TEST_CASES.filter((tc) => SMOKE_CASE_IDS.includes(tc.id));
  console.log(`Evaluating ${selectedCases.length} representative cases (5 EN + 5 BN, 2 per category)...`);

  const results: SmokeResult[] = [];

  for (const tc of selectedCases) {
    const fixture = fixtures[tc.fixtureKey];
    if (!fixture) {
      console.warn(`[WARN] Missing fixture ${tc.fixtureKey} for ${tc.id}`);
      continue;
    }

    const intentResult = classifyIntent(tc.question, fixture.snapshot.netSavings);
    let capturedError: string | undefined;

    try {
      const response = await executeCoachInquiry({
        userId: 'smoke-test-synthetic-user',
        query: tc.question,
        language: tc.language,
        fullContext: fixture,
        intentResult,
        aiClient,
      });

      const geminiGenerated = response.source === 'ai';
      const fallbackUsed = response.source === 'fallback';

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

      // Data sufficiency disclaimer check: If fixture has sparse history (< 3 months) and intent is projection
      let dataSufficiencyCompliant = true;
      if (tc.fixtureKey === 'INCOMPLETE_HISTORY' || tc.category === 'FINANCIAL_PROJECTION') {
        const hasWarning =
          lowerAns.includes('limitation') ||
          lowerAns.includes('historical') ||
          lowerAns.includes('3 months') ||
          lowerAns.includes('caution') ||
          lowerAns.includes('cannot be presented as a guaranteed forecast') ||
          lowerAns.includes('সীমাবদ্ধতা') ||
          lowerAns.includes('ঐতিহাসিক') ||
          lowerAns.includes('সতর্কতা');
        dataSufficiencyCompliant = hasWarning;
      }

      const unrecognized = numberVal.unrecognizedNumbers || [];

      // Determine strict status: A fallback response NEVER counts as a successful live Gemini response
      let status: 'LIVE_GEMINI_PASS' | 'FALLBACK_USED' | 'API_ERROR';
      let notes: string;

      if (geminiGenerated) {
        if (response.answer.length > 20 && langMatch && numberVal.valid && healthcareProtected) {
          status = 'LIVE_GEMINI_PASS';
          notes = `Live Gemini generation verified & compliant (model: ${response.modelUsed || 'approved'})`;
        } else {
          status = 'API_ERROR';
          notes = `Live Gemini failed guards: ${unrecognized.length ? `unverified numbers [${unrecognized.join(', ')}]` : !langMatch ? 'language mismatch' : 'healthcare breach'}`;
        }
      } else {
        status = 'FALLBACK_USED';
        notes = 'Fallback activated (Gemini did not generate response)';
      }

      results.push({
        id: tc.id,
        category: tc.category,
        language: tc.language.toUpperCase(),
        question: tc.question,
        geminiGenerated,
        fallbackUsed,
        modelUsed: response.modelUsed,
        languageMatch: langMatch,
        numbersValid: numberVal.valid,
        unverifiedNumbers: unrecognized,
        healthcareProtected,
        dataSufficiencyCompliant,
        status,
        errorMessage: capturedError,
        notes,
      });

      console.log(`  [${status}] ${tc.id} (${tc.language.toUpperCase()}) - ${tc.question.slice(0, 45)}... ${response.modelUsed ? `[${response.modelUsed}]` : ''}`);
    } catch (err: any) {
      const sanitizedMsg = (err.message || 'Unknown API Error').replace(/(?:AIza[0-9A-Za-z-_]{35}|[0-9A-Za-z-_]{50,60})/g, '[REDACTED_KEY]');
      results.push({
        id: tc.id,
        category: tc.category,
        language: tc.language.toUpperCase(),
        question: tc.question,
        geminiGenerated: false,
        fallbackUsed: false,
        languageMatch: false,
        numbersValid: false,
        unverifiedNumbers: [],
        healthcareProtected: true,
        dataSufficiencyCompliant: false,
        status: 'API_ERROR',
        errorMessage: sanitizedMsg,
        notes: `API Error: ${sanitizedMsg}`,
      });
      console.log(`  [API_ERROR] ${tc.id} - ${sanitizedMsg}`);
    }
  }

  const livePassCount = results.filter((r) => r.status === 'LIVE_GEMINI_PASS').length;
  const fallbackCount = results.filter((r) => r.status === 'FALLBACK_USED').length;
  const errorCount = results.filter((r) => r.status === 'API_ERROR').length;

  console.log('\n----------------------------------------------------------------');
  console.log(' Live Gemini Smoke Test Summary');
  console.log('----------------------------------------------------------------');
  console.log(`Total Cases Tested:            ${results.length}`);
  console.log(`Live Gemini Passed:            ${livePassCount} / ${results.length}`);
  console.log(`Fallback Used (Not Live AI):   ${fallbackCount} / ${results.length}`);
  console.log(`API Errors:                    ${errorCount} / ${results.length}`);
  console.log('----------------------------------------------------------------');

  results.forEach((r) => {
    console.log(`  ${r.id} | ${r.language} | ${r.category} | ${r.status} | ${r.notes}`);
  });

  console.log('================================================================');
  return {
    total: results.length,
    liveGeminiPassed: livePassCount,
    fallbackUsed: fallbackCount,
    apiErrors: errorCount,
    results,
  };
}

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runLiveGeminiSmokeTest().catch((e) => {
    console.error('Smoke test runtime exception:', e);
    process.exit(1);
  });
}
