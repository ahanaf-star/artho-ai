import fs from 'node:fs';
import path from 'node:path';

const dashboardPath = path.resolve('src/components/Dashboard.tsx');
const savingsGoalsPath = path.resolve('src/components/SavingsGoals.tsx');
const sidebarPath = path.resolve('src/components/Sidebar.tsx');
const appPath = path.resolve('src/App.tsx');

const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
const savingsGoalsCode = fs.readFileSync(savingsGoalsPath, 'utf8');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
const appCode = fs.readFileSync(appPath, 'utf8');

console.log('--- Verifying Dashboard Layout Changes ---');

// 1. Savings Goals Snapshot should NOT be in Dashboard.tsx
if (dashboardCode.includes('Savings Goals Snapshot')) {
  throw new Error('FAILED: "Savings Goals Snapshot" still present in Dashboard.tsx');
}
if (dashboardCode.includes('heroGoal') || dashboardCode.includes('heroProgress')) {
  throw new Error('FAILED: "heroGoal" or "heroProgress" still present in Dashboard.tsx');
}
if (dashboardCode.includes('Manage All Goals')) {
  throw new Error('FAILED: "Manage All Goals" link still present in Dashboard.tsx');
}
console.log('✓ "Savings Goals Snapshot" is completely removed from Dashboard.tsx');

// 2. Financial Health Score and Spending by Category side by side
const sideBySideGridMatch = dashboardCode.includes('grid grid-cols-1 lg:grid-cols-2 gap-space-md items-stretch');
if (!sideBySideGridMatch) {
  throw new Error('FAILED: Could not find "grid grid-cols-1 lg:grid-cols-2 gap-space-md items-stretch"');
}
console.log('✓ Side-by-side grid "grid grid-cols-1 lg:grid-cols-2" properly configured');

// 3. Financial Health Score elements preserved
const requiredHealthScoreItems = [
  'ArthoBachao AI Financial Health Score',
  'healthMetrics.status',
  'healthMetrics.score',
  'Saving Consistency',
  'Spending Control',
  'Cash Flow Stability',
  'Goal Progress',
  'View Health Breakdown',
  "onNavigate('financial-health')",
];
for (const item of requiredHealthScoreItems) {
  if (!dashboardCode.includes(item)) {
    throw new Error(`FAILED: Financial Health Score missing "${item}"`);
  }
}
console.log('✓ All Financial Health Score features and breakdown elements preserved');

// 4. Spending by Category elements preserved
const requiredSpendingItems = [
  'Spending by Category',
  'Total: {formatBDT(overview.totalExpenses)} this billing cycle',
  'This Month',
  'Detailed Category Report →',
  "onNavigate('spending-analysis')",
  'overview.categories.map',
];
for (const item of requiredSpendingItems) {
  if (!dashboardCode.includes(item)) {
    throw new Error(`FAILED: Spending by Category missing "${item}"`);
  }
}
console.log('✓ All Spending by Category features and donut elements preserved');

// 5. Dedicated Savings Goals page and sidebar links preserved
if (!fs.existsSync(savingsGoalsPath) || savingsGoalsCode.length < 500) {
  throw new Error('FAILED: Dedicated SavingsGoals.tsx file missing or truncated');
}
if (!sidebarCode.includes('savings-goals')) {
  throw new Error('FAILED: Sidebar does not contain savings-goals navigation');
}
if (!appCode.includes('savings-goals')) {
  throw new Error('FAILED: App.tsx does not route savings-goals');
}
console.log('✓ Dedicated Savings Goals page and sidebar/app navigation fully preserved');

console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
