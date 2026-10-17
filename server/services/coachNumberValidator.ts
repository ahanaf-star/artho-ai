import { CoachContext } from './coachContextBuilder';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  unrecognizedNumbers?: number[];
  disallowedPhrases?: string[];
}

/**
 * Normalizes Bengali digits to ASCII 0-9
 */
function convertBnToAsciiDigits(str: string): string {
  const bnToAscii: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return str.replace(/[০-৯]/g, (ch) => bnToAscii[ch] || ch);
}

/**
 * Gathers all authoritative numerical figures present in the CoachContext
 */
export function extractAllowedNumbers(ctx: CoachContext, additionalAllowed: number[] = []): Set<number> {
  const allowed = new Set<number>();

  // Add standard conversational numbers (e.g., list bullets, standard rules, percentages)
  const standardPermitted = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 20, 24, 25, 26, 28, 30, 50, 100];
  standardPermitted.forEach((n) => allowed.add(n));

  // Date elements (year, day)
  try {
    const todayParts = ctx.metadata.today.split('-').map(Number);
    todayParts.forEach((n) => !isNaN(n) && allowed.add(n));
  } catch {}

  // 1. Snapshot numbers
  allowed.add(ctx.snapshot.monthlyIncome);
  allowed.add(ctx.snapshot.monthlySpending);
  allowed.add(ctx.snapshot.netSavings);
  allowed.add(ctx.snapshot.savingsRate);
  allowed.add(Math.round(ctx.snapshot.savingsRate));
  allowed.add(ctx.snapshot.expenseRatio);
  allowed.add(Math.round(ctx.snapshot.expenseRatio));
  allowed.add(ctx.snapshot.currentBalance);

  // 2. Spending numbers
  allowed.add(ctx.spending.totalSpending);
  allowed.add(ctx.spending.anomaliesCount);
  if (ctx.spending.topCategory) {
    allowed.add(ctx.spending.topCategory.amount);
    allowed.add(ctx.spending.topCategory.percentage);
    allowed.add(Math.round(ctx.spending.topCategory.percentage));
    allowed.add(Math.abs(ctx.spending.topCategory.momChangePercentage));
  }
  for (const cat of ctx.spending.topCategories) {
    allowed.add(cat.amount);
    allowed.add(cat.percentage);
    allowed.add(Math.round(cat.percentage));
    allowed.add(Math.abs(cat.momChangePercentage));
  }
  for (const amt of Object.values(ctx.spending.categoryTotals)) {
    allowed.add(amt);
  }
  for (const pct of Object.values(ctx.spending.categoryPercentages)) {
    allowed.add(pct);
    allowed.add(Math.round(pct));
  }
  for (const anom of ctx.spending.anomalies) {
    allowed.add(anom.amount);
  }

  // 3. Goals numbers
  allowed.add(ctx.goals.totalGoals);
  for (const g of ctx.goals.items) {
    allowed.add(g.targetAmount);
    allowed.add(g.currentAmount);
    allowed.add(g.progressPercentage);
    allowed.add(Math.round(g.progressPercentage));
    allowed.add(g.remainingAmount);
    allowed.add(g.requiredMonthlyContribution);
  }

  // 4. Cash Flow numbers
  allowed.add(ctx.cashFlow.startingBalance);
  allowed.add(ctx.cashFlow.forecastMonthEndBalance);
  allowed.add(ctx.cashFlow.shortfall);
  allowed.add(ctx.cashFlow.recommendedWeeklyReduction);
  allowed.add(ctx.cashFlow.recommendedBuffer);

  // 5. Health numbers
  if (ctx.health.score !== null) allowed.add(ctx.health.score);
  if (ctx.health.percentile !== null) allowed.add(ctx.health.percentile);
  if (ctx.health.savingConsistency !== null) allowed.add(ctx.health.savingConsistency);
  if (ctx.health.spendingControl !== null) allowed.add(ctx.health.spendingControl);
  if (ctx.health.cashFlowStability !== null) allowed.add(ctx.health.cashFlowStability);
  if (ctx.health.goalProgress !== null) allowed.add(ctx.health.goalProgress);

  // 6. Cash-Out numbers
  allowed.add(ctx.cashOut.totalAmount);
  allowed.add(ctx.cashOut.count);
  allowed.add(ctx.cashOut.feeCost);
  allowed.add(ctx.cashOut.shareOfSpending);
  allowed.add(Math.round(ctx.cashOut.shareOfSpending));
  allowed.add(1.85); // MFS fee tariff percentage

  // 7. Recent Transactions
  for (const tx of ctx.recentTransactions) {
    allowed.add(tx.amount);
  }

  // Additional precomputed numbers passed in by the caller
  for (const n of additionalAllowed) {
    if (typeof n === 'number' && !isNaN(n)) {
      allowed.add(n);
    }
  }

  return allowed;
}

/**
 * Extracts numbers from text (handles both Western and Bengali digits, commas, decimals)
 */
export function extractNumbersFromText(text: string): number[] {
  const normalized = convertBnToAsciiDigits(text);

  // Match sequences of digits with optional commas and optional decimals
  // E.g. "38,500", "24.2", "9300", "1.85"
  const regex = /(?:^|[^\w.])([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/g;
  const numbers: number[] = [];

  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const rawStr = match[1].replace(/,/g, '');
    const num = parseFloat(rawStr);
    if (!isNaN(num)) {
      numbers.push(num);
    }
  }

  return numbers;
}

/**
 * Validates that every financial figure cited by Gemini exists in the authoritative context
 */
export function validateCoachNumbers(
  answer: string,
  ctx: CoachContext,
  additionalPrecomputed: number[] = []
): ValidationResult {
  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    return { valid: false, reason: 'Answer is empty or not a string' };
  }

  // Check for disallowed phrases (financial advice liabilities)
  const disallowed = [
    'guaranteed profit',
    'guaranteed return',
    'guaranteed prediction',
    'buy this stock',
    'invest in this stock',
    'licensed financial advisor',
    'loan approved',
    'credit approved',
    'গ্যারান্টিড লাভ',
    'গ্যারান্টিযুক্ত রিটার্ন',
    'স্টক কিনুন',
  ];

  const lower = answer.toLowerCase();
  const matchedDisallowed = disallowed.filter((phrase) => lower.includes(phrase));
  if (matchedDisallowed.length > 0) {
    return {
      valid: false,
      reason: `Disallowed regulatory/liability phrase detected: ${matchedDisallowed.join(', ')}`,
      disallowedPhrases: matchedDisallowed,
    };
  }

  // Extract all numbers from the generated response
  const numbersInAnswer = extractNumbersFromText(answer);
  const allowedSet = extractAllowedNumbers(ctx, additionalPrecomputed);

  const unrecognized: number[] = [];
  for (const n of numbersInAnswer) {
    // Check exact or rounded matches
    if (
      !allowedSet.has(n) &&
      !allowedSet.has(Math.round(n)) &&
      !allowedSet.has(Math.floor(n)) &&
      !allowedSet.has(Math.ceil(n))
    ) {
      unrecognized.push(n);
    }
  }

  if (unrecognized.length > 0) {
    return {
      valid: false,
      reason: `Unverified/hallucinated numerical values detected in answer: ${unrecognized.join(', ')}`,
      unrecognizedNumbers: unrecognized,
    };
  }

  return { valid: true };
}
