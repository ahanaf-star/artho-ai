import fs from 'node:fs';
import path from 'node:path';

const savingsGoalsPath = path.resolve('src/components/SavingsGoals.tsx');
const code = fs.readFileSync(savingsGoalsPath, 'utf8');

console.log('--- Verifying Savings Goals Introduction Box ---');

// 1. Heading check
const expectedHeading = 'Plan Your Savings, Achieve Your Goals';
if (!code.includes(expectedHeading)) {
  throw new Error(`FAILED: Missing heading "${expectedHeading}"`);
}
console.log('✓ Heading verified: "Plan Your Savings, Achieve Your Goals"');

// 2. Description check
const expectedDescription =
  'Savings Goals helps you plan and track money for the things that matter to you. Set a target amount, choose a target date, and track your progress as you save.';
if (!code.includes(expectedDescription)) {
  throw new Error(`FAILED: Missing description "${expectedDescription}"`);
}
console.log('✓ Description verified: "Savings Goals helps you plan and track money..."');

// 3. Step 1 check
if (!code.includes('Set Your Goal')) {
  throw new Error('FAILED: Missing Step 1 title "Set Your Goal"');
}
const step1Desc =
  'Choose what you are saving for, such as a laptop, emergency fund, education, or a trip.';
if (!code.includes(step1Desc)) {
  throw new Error(`FAILED: Missing Step 1 description "${step1Desc}"`);
}
console.log('✓ Step 1 verified: Set Your Goal & description');

// 4. Step 2 check
if (!code.includes('Set Your Target')) {
  throw new Error('FAILED: Missing Step 2 title "Set Your Target"');
}
const step2Desc = 'Enter the amount you want to save and your target date.';
if (!code.includes(step2Desc)) {
  throw new Error(`FAILED: Missing Step 2 description "${step2Desc}"`);
}
console.log('✓ Step 2 verified: Set Your Target & description');

// 5. Step 3 check
if (!code.includes('Track Your Progress')) {
  throw new Error('FAILED: Missing Step 3 title "Track Your Progress"');
}
const step3Desc =
  'Update your savings as you contribute and monitor how close you are to reaching your target.';
if (!code.includes(step3Desc)) {
  throw new Error(`FAILED: Missing Step 3 description "${step3Desc}"`);
}
console.log('✓ Step 3 verified: Track Your Progress & description');

// 6. Helpful tip check
const tipDesc =
  'Set realistic targets and contribute regularly. Your progress should reflect your actual savings.';
if (!code.includes(tipDesc)) {
  throw new Error(`FAILED: Missing tip description "${tipDesc}"`);
}
console.log('✓ Tip verified: "Set realistic targets and contribute regularly..."');

// 7. Layout check (3 columns on desktop, stacked on mobile)
if (!code.includes('grid grid-cols-1 md:grid-cols-3 gap-space-md')) {
  throw new Error('FAILED: Missing 3-column responsive grid layout');
}
console.log('✓ Responsive 3-column grid verified ("grid grid-cols-1 md:grid-cols-3")');

// 8. Presence in both empty state and populated state
const emptyStateMatch = code.includes('if (!heroGoal)') && code.includes('renderIntroBox()');
if (!emptyStateMatch) {
  throw new Error('FAILED: renderIntroBox() not invoked in empty state');
}
const populatedStateMatch =
  code.includes('{renderIntroBox()}') &&
  code.includes('Main Workspace Layout');
if (!populatedStateMatch) {
  throw new Error('FAILED: renderIntroBox() not invoked in populated state');
}
console.log('✓ Intro box rendered above content in BOTH empty state and populated state');

// 9. Preservation of empty state components
if (!code.includes('No Savings Goals Active') || !code.includes('+ Create New Goal')) {
  throw new Error('FAILED: Empty state content ("No Savings Goals Active" or "+ Create New Goal") missing');
}
console.log('✓ Empty state ("No Savings Goals Active" & button) fully preserved');

// 10. No duplicate Create Goal buttons in intro box
const introBoxFn = code.split('const renderIntroBox = () => (')[1]?.split('  if (!heroGoal)')[0];
if (!introBoxFn) {
  throw new Error('FAILED: Could not parse renderIntroBox function');
}
if (introBoxFn.includes('onOpenCreateGoal')) {
  throw new Error('FAILED: Duplicate Create Goal button detected inside renderIntroBox');
}
console.log('✓ No duplicate Create Goal button inside intro box verified');

console.log('\nALL SAVINGS GOALS INTRO CHECKS PASSED!');
