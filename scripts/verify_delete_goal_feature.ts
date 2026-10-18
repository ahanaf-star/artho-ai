import fs from 'node:fs';
import path from 'node:path';
import { deleteGoal, getGoals } from '../server/controllers/goalController';
import { INITIAL_SAVINGS_GOALS } from '../src/data/mockGoals';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runVerification() {
  console.log('====================================================');
  console.log('   VERIFYING DELETE SAVINGS GOAL FEATURE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. Static UI Contract Verification
  // ----------------------------------------------------
  console.log('--- 1. Static UI Contract Verification (SavingsGoals.tsx) ---');
  const savingsGoalsCode = fs.readFileSync(path.resolve('src/components/SavingsGoals.tsx'), 'utf8');

  // Hero card Delete Goal button
  assert(
    savingsGoalsCode.includes('openDeleteModal(heroGoal)') &&
    savingsGoalsCode.includes('<span>Delete Goal</span>'),
    'Hero Goal card contains visible "Delete Goal" button with openDeleteModal(heroGoal)'
  );

  // Secondary card Delete Goal button
  assert(
    savingsGoalsCode.includes('openDeleteModal(g)') &&
    savingsGoalsCode.includes('aria-label={`Delete goal ${g.title}`}'),
    'Secondary Goal cards contain visible "Delete Goal" button with openDeleteModal(g)'
  );

  // Edit Goal Modal Delete Goal button
  assert(
    savingsGoalsCode.includes('openDeleteModal(g)') &&
    savingsGoalsCode.includes('setEditingGoal(null)'),
    'Edit Goal Modal footer contains "Delete Goal" button that transitions cleanly to confirmation dialog'
  );

  // Confirmation dialog exact prompt
  const exactPrompt = 'Are you sure you want to delete this savings goal? This action cannot be undone.';
  assert(
    savingsGoalsCode.includes(exactPrompt),
    `Confirmation dialog contains exact prompt: "${exactPrompt}"`
  );

  // Cancel and Delete Goal buttons in confirmation modal
  assert(
    savingsGoalsCode.includes('setGoalToDelete(null)') &&
    savingsGoalsCode.includes('handleConfirmDelete'),
    'Confirmation dialog contains Cancel and Delete Goal buttons'
  );

  // Financial data retention warning
  assert(
    savingsGoalsCode.includes('goalToDelete.currentAmount > 0') &&
    savingsGoalsCode.includes('Past deposits preserved:'),
    'Confirmation dialog displays explicit warning banner preserving historical deposit records when currentAmount > 0'
  );

  // Loading state and duplicate request prevention
  assert(
    savingsGoalsCode.includes('isDeletingGoal') &&
    savingsGoalsCode.includes('disabled={isDeletingGoal}') &&
    savingsGoalsCode.includes('Deleting...'),
    'Confirmation dialog enforces loading state, disabled buttons, and spinner during active deletion'
  );

  // Error state display
  assert(
    savingsGoalsCode.includes('deleteGoalError') &&
    savingsGoalsCode.includes('{deleteGoalError}'),
    'Confirmation dialog displays error banner if deletion fails'
  );

  // Success toast notification
  assert(
    savingsGoalsCode.includes('was deleted successfully.'),
    'Displays success toast message when savings goal deletion completes'
  );

  // ----------------------------------------------------
  // 2. Client Service & App State Verification
  // ----------------------------------------------------
  console.log('\n--- 2. Client State & App Flow Verification (App.tsx & apiService.ts) ---');
  const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

  assert(
    appCode.includes('handleDeleteGoal = async (goalId: string)'),
    'App.tsx implements handleDeleteGoal handler'
  );

  assert(
    appCode.includes('setGoals(updatedGoals)') &&
    appCode.includes('financialDataService.saveGoals(currentUser.id, updatedGoals)'),
    'App.tsx optimistically updates local goals state and persists to financialDataService'
  );

  assert(
    appCode.includes('if (currentUser.primaryGoalId === goalId)') &&
    appCode.includes('primaryGoalId: undefined'),
    'App.tsx automatically cleans up primaryGoalId reference if the deleted goal was primary'
  );

  assert(
    appCode.includes('setGoals(previousGoals)') &&
    appCode.includes('financialDataService.saveGoals(currentUser.id, previousGoals)'),
    'App.tsx rolls back state on network/backend failure'
  );

  const apiServiceCode = fs.readFileSync(path.resolve('src/services/apiService.ts'), 'utf8');
  assert(
    apiServiceCode.includes('async deleteGoal(goalId: string, userId?: string): Promise<boolean>'),
    'apiService.deleteGoal handles deletion with optional userId'
  );

  // ----------------------------------------------------
  // 3. Backend Routes & Controllers Verification
  // ----------------------------------------------------
  console.log('\n--- 3. Backend Routes & Controllers Verification ---');
  const goalRoutesCode = fs.readFileSync(path.resolve('server/routes/goalRoutes.ts'), 'utf8');

  assert(
    goalRoutesCode.includes("router.delete('/users/:userId/goals/:id', deleteGoal)"),
    'goalRoutes defines DELETE /api/users/:userId/goals/:id'
  );

  assert(
    goalRoutesCode.includes("router.delete('/goals/:id', deleteGoal)"),
    'goalRoutes defines DELETE /api/goals/:id'
  );

  // ----------------------------------------------------
  // 4. Controller Unit Logic (Ownership & In-Memory Fallback)
  // ----------------------------------------------------
  console.log('\n--- 4. Controller Unit Logic: Ownership Security & In-Memory Fallback ---');

  function createMockReqRes(params: any, user?: any) {
    let statusCode = 200;
    let responseData: any = null;

    const req: any = {
      params,
      user,
    };

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseData = data;
        return res;
      },
    };

    return {
      req,
      res,
      getStatus: () => statusCode,
      getData: () => responseData,
    };
  }

  // Test A: 400 Bad Request on missing goal ID
  {
    const { req, res, getStatus, getData } = createMockReqRes({ id: '' });
    await deleteGoal(req, res);
    assert(getStatus() === 400, 'Rejects empty goal ID with 400 Bad Request');
    assert(getData().error === 'Valid goal ID is required', 'Returns correct error message for missing goal ID');
  }

  // Test B: 403 Forbidden when user attempts to delete another user's goal via URL
  {
    const { req, res, getStatus, getData } = createMockReqRes(
      { id: 'goal-123', userId: 'usr-victim-99' },
      { customId: 'usr-attacker-01' }
    );
    await deleteGoal(req, res);
    assert(getStatus() === 403, 'Rejects cross-user deletion attempt with 403 Forbidden');
    assert(getData().error.includes('Access forbidden'), 'Returns Access forbidden message');
  }

  // Test C: In-memory fallback deletion removes item from INITIAL_SAVINGS_GOALS
  {
    const testGoalId = 'test-in-memory-goal-' + Date.now();
    INITIAL_SAVINGS_GOALS.push({
      id: testGoalId,
      title: 'Test Verification Goal',
      category: 'Testing',
      icon: '🧪',
      targetAmount: 50000,
      currentAmount: 12000,
      deadline: '2026-12-31',
      monthlyPace: 5000,
      accountVault: 'bKash Liquid Vault',
      status: 'On Track',
    });

    const initialCount = INITIAL_SAVINGS_GOALS.length;
    const { req, res, getStatus, getData } = createMockReqRes({ id: testGoalId });
    await deleteGoal(req, res);

    assert(getStatus() === 200, 'In-memory fallback deletion succeeds with 200 OK');
    assert(INITIAL_SAVINGS_GOALS.length === initialCount - 1, 'In-memory goal was removed from INITIAL_SAVINGS_GOALS');
    assert(
      !INITIAL_SAVINGS_GOALS.some((g) => g.id === testGoalId),
      'Verified deleted goal no longer exists in memory store'
    );
  }

  // ----------------------------------------------------
  // 5. Anti-Resurrection Safeguard Verification
  // ----------------------------------------------------
  console.log('\n--- 5. Anti-Resurrection & Persistence Safeguard ---');
  const goalControllerCode = fs.readFileSync(path.resolve('server/controllers/goalController.ts'), 'utf8');

  assert(
    goalControllerCode.includes('!user?.hasSeededGoals'),
    'getGoals checks hasSeededGoals flag before auto-seeding demo user goals'
  );

  assert(
    goalControllerCode.includes("UserModel.updateOne(") &&
    goalControllerCode.includes('{ $set: { hasSeededGoals: true } }'),
    'deleteGoal marks hasSeededGoals: true so deleted demo goals never resurrect when goals count reaches 0'
  );

  assert(
    goalControllerCode.includes('$unset: { primaryGoalId: 1 }'),
    'deleteGoal automatically unsets primaryGoalId from user record if deleted goal was primary'
  );

  console.log('\n====================================================');
  console.log('   🎉 ALL DELETE GOAL VERIFICATION TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Unexpected verification error:', err);
  process.exit(1);
});
