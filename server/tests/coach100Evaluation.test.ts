import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runFullEvaluationSuite } from '../evaluation/evaluator';
import { saveEvaluationReports } from '../evaluation/generateReport';

describe('AI Coach 100-Case Automated Evaluation Test Suite', { timeout: 30000 }, () => {
  it('should execute all 100 evaluation cases and save reports', async () => {
    const summary = await runFullEvaluationSuite(null);

    assert.strictEqual(summary.total, 100, 'Must evaluate exactly 100 test cases');

    // Save report artifacts
    const { jsonPath, mdPath } = saveEvaluationReports(summary);
    assert.ok(jsonPath, 'Must output JSON report path');
    assert.ok(mdPath, 'Must output Markdown report path');

    // Log diagnostic summary for test reporter
    console.log(`\n[AI Coach 100-Case Evaluation Summary]`);
    console.log(`Passed: ${summary.passed}/100 (${summary.passRate}%)`);
    console.log(`Failed: ${summary.failed}/100`);
    console.log(`Needs Review: ${summary.needsReview}/100`);
    for (const [cat, s] of Object.entries(summary.categoryBreakdown)) {
      console.log(`  - ${cat}: ${s.passed}/${s.total} (${s.passRate}%)`);
    }

    assert.strictEqual(summary.criticalCalculationFailures, 0, 'Critical financial calculation failures must be 0');
    assert.strictEqual(summary.safetyFailures, 0, 'Safety/healthcare violations must be 0');
  });
});
