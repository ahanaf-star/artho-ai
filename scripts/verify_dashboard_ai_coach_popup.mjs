import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function runDashboardVerification() {
  console.log('====================================================');
  console.log('VERIFYING DASHBOARD AI INSIGHT REMOVAL & POPUP BUTTON');
  console.log('====================================================');

  const dashboardPath = path.resolve('src/components/Dashboard.tsx');
  const modalPath = path.resolve('src/components/modals/AICoachModal.tsx');

  assert(fs.existsSync(dashboardPath), 'Dashboard.tsx must exist');
  assert(fs.existsSync(modalPath), 'AICoachModal.tsx must exist');

  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // TEST 1: Confirm old AI Insight Spotlight items are completely removed
  console.log('[TEST 1] Checking removal of old AI Insight Spotlight elements...');
  const forbiddenPhrases = [
    'ArthoBachao AI Intelligence',
    'Personalized Algorithmic Insight',
    'Gulshan & Banani Zone',
    'High Impact',
    'Observed Surge',
    'Suggested Cap',
    'Speedup Horizon',
    'Apply Suggested Budget',
    'Budget Rule Active',
    'Ask ArthoBachao AI Details',
    'budgetApplied',
    'setBudgetApplied',
    'handleApplyBudget',
  ];

  for (const phrase of forbiddenPhrases) {
    assert(
      !dashboardContent.includes(phrase),
      `Expected Dashboard.tsx to NOT include "${phrase}", but it was found!`
    );
  }
  console.log('✓ PASS: All old AI Insight Spotlight text, states, and buttons are completely removed.');

  // TEST 2: Confirm new "Ask AI Coach" button exists
  console.log('[TEST 2] Verifying "Ask AI Coach" button exists in Dashboard.tsx...');
  assert(
    dashboardContent.includes('Ask AI Coach'),
    'Expected "Ask AI Coach" button text to exist in Dashboard.tsx'
  );
  assert(
    dashboardContent.includes('setIsCoachModalOpen(true)'),
    'Clicking the button must trigger setIsCoachModalOpen(true)'
  );
  console.log('✓ PASS: "Ask AI Coach" button is present and triggers modal open.');

  // TEST 3: Confirm AICoachModal is imported and rendered
  console.log('[TEST 3] Checking AICoachModal integration in Dashboard.tsx...');
  assert(
    dashboardContent.includes("import { AICoachModal } from './modals/AICoachModal'"),
    'AICoachModal must be imported in Dashboard.tsx'
  );
  assert(
    dashboardContent.includes('<AICoachModal'),
    'AICoachModal must be rendered in Dashboard.tsx'
  );
  assert(
    dashboardContent.includes("onNavigate('ai-coach')"),
    'AICoachModal must receive onOpenCoach handler navigating to "ai-coach"'
  );
  console.log('✓ PASS: AICoachModal is imported and wired to navigate to "ai-coach".');

  // TEST 4: Confirm AICoachModal meets all requirements
  console.log('[TEST 4] Verifying AICoachModal requirements...');
  assert(
    modalContent.includes('Get personalized financial guidance from your AI Coach.'),
    'Modal must display: "Get personalized financial guidance from your AI Coach."'
  );
  assert(
    modalContent.includes('Open AI Coach'),
    'Modal must display primary button: "Open AI Coach"'
  );
  assert(
    modalContent.includes('onOpenCoach()'),
    'Primary button must trigger onOpenCoach()'
  );
  assert(
    modalContent.includes('Escape'),
    'Modal must handle Escape key to close'
  );
  assert(
    modalContent.includes('onClick={onClose}'),
    'Backdrop click must close modal'
  );
  assert(
    modalContent.includes('e.stopPropagation()'),
    'Modal card click must not close modal'
  );
  console.log('✓ PASS: AICoachModal fulfills all modal requirements (message, buttons, keyboard/backdrop handlers).');

  console.log('====================================================');
  console.log('ALL DASHBOARD AI COACH POPUP VERIFICATIONS PASSED!');
  console.log('====================================================');
}

runDashboardVerification();
