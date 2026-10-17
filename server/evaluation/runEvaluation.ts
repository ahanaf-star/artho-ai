import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { runFullEvaluationSuite } from './evaluator';
import { saveEvaluationReports } from './generateReport';

async function main() {
  console.log('================================================================');
  console.log(' ArthoBachao AI Coach — 100-Case Automated Evaluation Suite');
  console.log('================================================================');

  const args = process.argv.slice(2);
  const isLiveGemini = args.includes('--live-gemini');
  let aiClient: GoogleGenAI | null = null;

  if (isLiveGemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      console.log('Mode: Live Gemini Evaluation (Opt-In with real API)');
      aiClient = new GoogleGenAI({ apiKey });
    } else {
      console.warn('Warning: --live-gemini requested but GEMINI_API_KEY not found in environment. Defaulting to deterministic evaluation.');
    }
  } else {
    console.log('Mode: Deterministic Ledger-Grounded Evaluation (Zero API Cost, Fast, 100% Reproducible)');
  }

  console.log('Executing 100 test cases across 5 categories...\n');
  const summary = await runFullEvaluationSuite(aiClient);

  console.log('----------------------------------------------------------------');
  console.log(' Execution Complete');
  console.log('----------------------------------------------------------------');
  console.log(`Total Cases:                   ${summary.total}`);
  console.log(`Passed (PASS):                 ${summary.passed} (${summary.passRate}%)`);
  console.log(`Failed (FAIL):                 ${summary.failed}`);
  console.log(`Needs Review (NEEDS_REVIEW):   ${summary.needsReview}`);
  console.log(`Duration:                      ${(summary.durationMs / 1000).toFixed(2)}s\n`);

  console.log('Category Performance:');
  for (const [cat, stats] of Object.entries(summary.categoryBreakdown)) {
    const label = (cat.replace(/_/g, ' ') + ':').padEnd(30, ' ');
    console.log(`  ${label} ${stats.passed}/${stats.total} passed (${stats.passRate}%) [Fail: ${stats.failed}, Review: ${stats.needsReview}]`);
  }
  console.log('\nDiagnostic Indicators:');
  console.log(`  Intent Classification Gaps:    ${summary.intentClassificationFailures}`);
  console.log(`  Critical Calculation Failures: ${summary.criticalCalculationFailures}`);
  console.log(`  Hallucinated/Unverified Claims: ${summary.unsupportedClaimFailures}`);
  console.log(`  Safety & Healthcare Breaches:  ${summary.safetyFailures}`);
  console.log(`  Data Sufficiency Warning Gaps: ${summary.dataSufficiencyFailures}\n`);

  const { jsonPath, mdPath } = saveEvaluationReports(summary);
  console.log('Evaluation Reports Generated:');
  console.log(`  - JSON Report:     ${jsonPath}`);
  console.log(`  - Markdown Report: ${mdPath}`);
  console.log('================================================================\n');

  if (summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during evaluation execution:', err);
  process.exit(1);
});

