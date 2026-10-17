import * as fs from 'fs';
import * as path from 'path';
import { EvaluationSuiteSummary, EvaluationResult } from './evaluator';

export function saveEvaluationReports(summary: EvaluationSuiteSummary, outputDir?: string) {
  const targetDir = outputDir || path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. JSON Report
  const jsonPath = path.join(targetDir, 'coach_evaluation_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  // 2. Markdown Report
  const mdPath = path.join(targetDir, 'coach_evaluation_report.md');
  const mdContent = generateMarkdownReport(summary);
  fs.writeFileSync(mdPath, mdContent, 'utf8');

  return { jsonPath, mdPath };
}

export function generateMarkdownReport(summary: EvaluationSuiteSummary): string {
  const {
    total,
    passed,
    failed,
    needsReview,
    passRate,
    categoryBreakdown,
    criticalCalculationFailures,
    intentClassificationFailures,
    unsupportedClaimFailures,
    dataSufficiencyFailures,
    safetyFailures,
    durationMs,
    results,
  } = summary;

  let md = `# ArthoBachao AI Coach — 100-Case Automated Evaluation Report\n\n`;
  md += `**Execution Date**: ${new Date().toISOString()}  \n`;
  md += `**Execution Duration**: ${(durationMs / 1000).toFixed(2)}s  \n`;
  md += `**Total Test Cases Evaluated**: ${total}  \n`;
  md += `**Overall Pass Rate**: **${passRate}%** (${passed} / ${total})  \n\n`;

  // Summary Metrics Table
  md += `## 1. Executive Summary\n\n`;
  md += `| Metric | Count | Percentage |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Passed (PASS)** | **${passed}** | **${((passed / total) * 100).toFixed(1)}%** |\n`;
  md += `| **Failed (FAIL)** | **${failed}** | **${((failed / total) * 100).toFixed(1)}%** |\n`;
  md += `| **Needs Review (NEEDS_REVIEW)** | **${needsReview}** | **${((needsReview / total) * 100).toFixed(1)}%** |\n`;
  md += `| Intent Classification Failures | ${intentClassificationFailures} | ${((intentClassificationFailures / total) * 100).toFixed(1)}% |\n`;
  md += `| Critical Financial Calculation Failures | ${criticalCalculationFailures} | ${((criticalCalculationFailures / total) * 100).toFixed(1)}% |\n`;
  md += `| Unsupported / Hallucinated Claims | ${unsupportedClaimFailures} | ${((unsupportedClaimFailures / total) * 100).toFixed(1)}% |\n`;
  md += `| Data Sufficiency Warning Gaps | ${dataSufficiencyFailures} | ${((dataSufficiencyFailures / total) * 100).toFixed(1)}% |\n`;
  md += `| Safety & Ethics Violations | ${safetyFailures} | ${((safetyFailures / total) * 100).toFixed(1)}% |\n\n`;

  // Category Breakdown Table
  md += `## 2. Category Performance Breakdown\n\n`;
  md += `| Category | Total | Pass | Fail | Review | Pass Rate |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;
  for (const [catName, stats] of Object.entries(categoryBreakdown)) {
    const formattedName = catName.replace(/_/g, ' ');
    md += `| **${formattedName}** | ${stats.total} | ${stats.passed} | ${stats.failed} | ${stats.needsReview} | **${stats.passRate}%** |\n`;
  }
  md += `\n`;

  // Detailed Failure Analysis
  const failingCases = results.filter((r) => r.status === 'FAIL');
  const reviewCases = results.filter((r) => r.status === 'NEEDS_REVIEW');

  md += `## 3. Failure & Review Analysis\n\n`;
  if (failingCases.length === 0 && reviewCases.length === 0) {
    md += `*Zero test failures detected across all 100 representative evaluation cases.*\n\n`;
  } else {
    if (failingCases.length > 0) {
      md += `### 3.1 Critical Failures (${failingCases.length})\n\n`;
      for (const fc of failingCases) {
        md += `#### [${fc.id}] ${fc.question}\n`;
        md += `- **Category**: ${fc.category}\n`;
        md += `- **Expected Intent**: \`${fc.expectedIntent}\` | **Actual Intent**: \`${fc.actualIntent}\`\n`;
        md += `- **Primary Failure Reasons**:\n`;
        for (const fr of fc.failureReasons) {
          md += `  - ❌ ${fr}\n`;
        }
        md += `- **Answer Excerpt**: *"${fc.answerExcerpt}"*\n`;
        md += `- **Suspected Service Location**: \`${fc.codeLocation}\`\n\n`;
      }
    }

    if (reviewCases.length > 0) {
      md += `### 3.2 Cases Requiring Review (${reviewCases.length})\n\n`;
      for (const rc of reviewCases) {
        md += `#### [${rc.id}] ${rc.question}\n`;
        md += `- **Category**: ${rc.category}\n`;
        md += `- **Expected Intent**: \`${rc.expectedIntent}\` | **Actual Intent**: \`${rc.actualIntent}\`\n`;
        md += `- **Review Flags**:\n`;
        for (const fr of rc.failureReasons) {
          md += `  - ⚠️ ${fr}\n`;
        }
        md += `- **Answer Excerpt**: *"${rc.answerExcerpt}"*\n`;
        md += `- **Code Location**: \`${rc.codeLocation}\`\n\n`;
      }
    }
  }

  // Complete 100-Case Evaluation Table
  md += `## 4. Complete 100-Case Evaluation Results Table\n\n`;
  md += `| ID | Question | Expected Intent | Actual Intent | Status | Notes |\n`;
  md += `| :---: | :--- | :--- | :--- | :---: | :--- |\n`;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️ REVIEW';
    const cleanQ = r.question.replace(/\|/g, '-');
    const cleanReason = (r.failureReasons[0] || 'Grounded & verified').replace(/\|/g, '-');
    md += `| **${r.id}** | ${cleanQ} | \`${r.expectedIntent}\` | \`${r.actualIntent}\` | ${icon} | ${cleanReason} |\n`;
  }
  md += `\n`;

  // Recommended Fixes Ranked by Severity
  md += `## 5. Recommended Fixes Ranked by Severity\n\n`;
  md += `1. **Priority 1 (Critical Calculation & Hallucination Guard)**: Ensure every response citing numbers validates 100% against authenticated ledger snapshots.\n`;
  md += `2. **Priority 2 (User-Data Isolation & Security)**: Enforce strict boundary rules preventing prompt injections and cross-user data leakage.\n`;
  md += `3. **Priority 3 (Intent Classification Precision)**: Expand pattern matching for multi-month projections, budget allocations, and granular savings scenarios.\n`;
  md += `4. **Priority 4 (Insufficient Data Disclaimers)**: When users have $< 3$ months of history, clearly label projections as illustrative run-rate estimates rather than definitive forecasts.\n`;
  md += `5. **Priority 5 (Essential Obligation Protection)**: Non-discretionary necessities (healthcare, education, rent, utilities) must never be suggested for reductions simply because their absolute amount is large.\n`;

  return md;
}
