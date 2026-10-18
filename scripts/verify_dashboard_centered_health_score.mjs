import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function runVerification() {
  console.log('====================================================');
  console.log('VERIFYING DASHBOARD CENTERED HEALTH SCORE & NO AI COACH PROMO CARD');
  console.log('====================================================');

  const dashboardPath = path.resolve('src/components/Dashboard.tsx');
  const sidebarPath = path.resolve('src/components/Sidebar.tsx');
  const aiCoachPath = path.resolve('src/components/AICoach.tsx');

  assert(fs.existsSync(dashboardPath), 'Dashboard.tsx must exist');
  assert(fs.existsSync(sidebarPath), 'Sidebar.tsx must exist');
  assert(fs.existsSync(aiCoachPath), 'AICoach.tsx must exist');

  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  // TEST 1: Confirm AI Coach promotional card and modal are removed from Dashboard
  console.log('[TEST 1] Verifying removal of AI Coach promotional card from Dashboard...');
  assert(
    !dashboardContent.includes('Ask AI Coach'),
    'Dashboard must not contain "Ask AI Coach" button'
  );
  assert(
    !dashboardContent.includes('AICoachModal'),
    'Dashboard must not import or render AICoachModal'
  );
  assert(
    !dashboardContent.includes('isCoachModalOpen'),
    'Dashboard must not have isCoachModalOpen state'
  );
  assert(
    !dashboardContent.includes('ArthoBachao AI Coach'),
    'Dashboard must not contain "ArthoBachao AI Coach" heading'
  );
  console.log('✓ PASS: AI Coach promotional card and its modal are completely removed from Dashboard.');

  // TEST 2: Confirm Financial Health Score card is centered and compact
  console.log('[TEST 2] Verifying Financial Health Score card is centered and compact...');
  assert(
    dashboardContent.includes('flex justify-center'),
    'Financial Health Score wrapper must use "flex justify-center" to center the card'
  );
  assert(
    dashboardContent.includes('max-w-md'),
    'Financial Health Score card must use "max-w-md" for a compact layout'
  );
  assert(
    !dashboardContent.includes('lg:col-span-4') && !dashboardContent.includes('lg:col-span-8'),
    'Old 4/8 column grid split for Row 1 must be removed'
  );
  console.log('✓ PASS: Financial Health Score card is centered and restricted to a compact max-w-md container.');

  // TEST 3: Confirm all Financial Health Score elements are preserved
  console.log('[TEST 3] Verifying all Financial Health Score elements are preserved...');
  const expectedElements = [
    'Artho AI Financial Health Score',
    'healthMetrics.status',
    'Saving Consistency',
    'Spending Control',
    'Cash Flow Stability',
    'Goal Progress',
    'View Health Breakdown',
    "onNavigate('financial-health')",
  ];
  for (const el of expectedElements) {
    assert(
      dashboardContent.includes(el),
      `Expected Financial Health Score card to include "${el}"`
    );
  }
  console.log('✓ PASS: All score metrics, sub-metrics, status indicators, and breakdown link are intact.');

  // TEST 4: Confirm Sidebar navigation still retains AI Coach
  console.log('[TEST 4] Verifying Sidebar navigation retains AI Coach...');
  assert(
    sidebarContent.includes("'ai-coach'"),
    'Sidebar must retain navigation item for "ai-coach"'
  );
  assert(
    sidebarContent.includes('AI Coach'),
    'Sidebar must display "AI Coach" label'
  );
  console.log('✓ PASS: Sidebar navigation and AI Coach screen are fully preserved.');

  console.log('====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH ZERO FAILURES!');
  console.log('====================================================');
}

runVerification();
