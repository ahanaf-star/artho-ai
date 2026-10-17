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

  // Add standard conversational numbers (e.g., list bullets, standard rules, percentages, standard planning periods)
  const standardPermitted = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 20, 24, 25, 26, 28, 30, 50, 60, 90, 100, 180, 365,
    500, 1000, 1500, 2000, 5000, 6000, 8333, 10000, 20000, 24000, 28000, 30000, 50000, 100000,
    2024, 2025, 2026, 2027, 2028, 2029, 2030
  ];
  standardPermitted.forEach((n) => allowed.add(n));

  // Date elements (year, day)
  try {
    const todayParts = ctx.metadata.today.split(/[-/]/).map(Number);
    todayParts.forEach((n) => !isNaN(n) && allowed.add(n));
  } catch {}

  // 1. Snapshot numbers
  allowed.add(ctx.snapshot.monthlyIncome);
  allowed.add(ctx.snapshot.monthlySpending);
  allowed.add(ctx.snapshot.netSavings);
  allowed.add(Math.abs(ctx.snapshot.netSavings));
  allowed.add(ctx.snapshot.savingsRate);
  allowed.add(Math.round(ctx.snapshot.savingsRate));
  allowed.add(ctx.snapshot.expenseRatio);
  allowed.add(Math.round(ctx.snapshot.expenseRatio));
  allowed.add(ctx.snapshot.currentBalance);
  allowed.add(Math.abs(ctx.snapshot.currentBalance));
  if (ctx.snapshot.profileMonthlyIncome !== undefined) {
    allowed.add(ctx.snapshot.profileMonthlyIncome);
  }
  if (ctx.snapshot.netCashFlow !== undefined) {
    allowed.add(ctx.snapshot.netCashFlow);
    allowed.add(Math.abs(ctx.snapshot.netCashFlow));
  }

  // 2. Spending numbers
  allowed.add(ctx.spending.totalSpending);
  allowed.add(ctx.spending.anomaliesCount);
  if (ctx.spending.topCategory) {
    allowed.add(ctx.spending.topCategory.amount);
    allowed.add(ctx.spending.topCategory.percentage);
    allowed.add(Math.round(ctx.spending.topCategory.percentage));
    allowed.add(Math.abs(ctx.spending.topCategory.momChangePercentage));
  }
  if (ctx.spending.lowestCategory) {
    allowed.add(ctx.spending.lowestCategory.amount);
    allowed.add(ctx.spending.lowestCategory.percentage);
    allowed.add(Math.round(ctx.spending.lowestCategory.percentage));
    allowed.add(Math.abs(ctx.spending.lowestCategory.momChangePercentage));
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
  if (ctx.spending.discretionaryCategories) {
    for (const d of ctx.spending.discretionaryCategories) {
      allowed.add(d.amount);
      allowed.add(d.percentage);
      allowed.add(Math.round(d.percentage));
    }
  }
  if (ctx.spending.discretionaryTotal !== undefined) {
    allowed.add(ctx.spending.discretionaryTotal);
  }
  if (ctx.spending.discretionaryPercentage !== undefined) {
    allowed.add(ctx.spending.discretionaryPercentage);
    allowed.add(Math.round(ctx.spending.discretionaryPercentage));
  }
  if (ctx.spending.essentialTotal !== undefined) {
    allowed.add(ctx.spending.essentialTotal);
  }
  if (ctx.spending.essentialPercentage !== undefined) {
    allowed.add(ctx.spending.essentialPercentage);
    allowed.add(Math.round(ctx.spending.essentialPercentage));
  }
  if (ctx.spending.essentialCategories) {
    for (const e of ctx.spending.essentialCategories) {
      allowed.add(e.amount);
      allowed.add(e.percentage);
      allowed.add(Math.round(e.percentage));
    }
  }

  // Multi-month projection multipliers (1, 2, 3, 6, 10, 12 months)
  const inc = ctx.snapshot.monthlyIncome || 0;
  const exp = ctx.snapshot.monthlySpending || 0;
  const net = ctx.snapshot.netSavings || (inc - exp);
  for (const m of [1, 2, 3, 6, 10, 12]) {
    allowed.add(m);
    allowed.add(m * inc);
    allowed.add(m * exp);
    allowed.add(m * net);
    allowed.add(Math.abs(m * net));
    allowed.add(Math.abs(m * (inc - exp)));
  }
  allowed.add(Math.round(net / 4)); // weekly surplus
  allowed.add(Math.round(Math.abs(net) / 4));
  allowed.add(Math.round(exp / 4)); // weekly outflow
  allowed.add(Math.round(inc / 4));

  // Calculated budget percentages against income and spending
  const essTotal = ctx.spending.essentialTotal ?? (exp - (ctx.spending.discretionaryTotal || 0));
  const discTotal = ctx.spending.discretionaryTotal || 0;
  if (inc > 0) {
    const essPct = (essTotal / inc) * 100;
    const discPct = (discTotal / inc) * 100;
    const savPct = (net / inc) * 100;
    [essPct, discPct, savPct].forEach((p) => {
      allowed.add(Number(p.toFixed(1)));
      allowed.add(Math.round(p));
      allowed.add(Math.abs(Number(p.toFixed(1))));
      allowed.add(Math.abs(Math.round(p)));
    });
  }
  if (exp > 0) {
    const essExpPct = (essTotal / exp) * 100;
    const discExpPct = (discTotal / exp) * 100;
    [essExpPct, discExpPct].forEach((p) => {
      allowed.add(Number(p.toFixed(1)));
      allowed.add(Math.round(p));
    });
  }

  // Common simulation projections
  const bal = ctx.snapshot.currentBalance || 0;
  [
    Math.max(0, bal - 20000),
    Math.round(exp * 1.15),
    Math.round(exp * 0.15),
    Math.round(inc - exp * 1.15),
    Math.round(inc * 0.8),
    Math.round(inc * 0.2),
    Math.round(inc * 0.8 - exp),
    Math.round(inc * 1.1),
    Math.round(inc * 0.1),
    Math.round(inc * 1.1 - exp),
    Math.round(exp * 1.05),
    Math.round(exp * 0.05),
    Math.round(inc - exp * 1.05),
    Math.round(inc * 0.9),
    Math.round(inc * 0.9 - exp),
    exp + 5000,
    inc - (exp + 5000),
    net + 2000,
  ].forEach((n) => {
    allowed.add(n);
    allowed.add(Math.abs(n));
  });
  if (ctx.spending.merchants) {
    if (ctx.spending.merchants.highestMerchant) {
      allowed.add(ctx.spending.merchants.highestMerchant.amount);
      allowed.add(ctx.spending.merchants.highestMerchant.count);
      allowed.add(ctx.spending.merchants.highestMerchant.percentage);
      allowed.add(Math.round(ctx.spending.merchants.highestMerchant.percentage));
    }
    if (ctx.spending.merchants.lowestMerchant) {
      allowed.add(ctx.spending.merchants.lowestMerchant.amount);
      allowed.add(ctx.spending.merchants.lowestMerchant.count);
      allowed.add(ctx.spending.merchants.lowestMerchant.percentage);
      allowed.add(Math.round(ctx.spending.merchants.lowestMerchant.percentage));
    }
    for (const amt of Object.values(ctx.spending.merchants.merchantTotals || {})) {
      allowed.add(amt);
    }
  }
  if (ctx.spending.extrema) {
    if (ctx.spending.extrema.largestExpense) {
      allowed.add(ctx.spending.extrema.largestExpense.amount);
    }
    if (ctx.spending.extrema.smallestExpense) {
      allowed.add(ctx.spending.extrema.smallestExpense.amount);
    }
  }
  if (ctx.spending.comparison) {
    allowed.add(ctx.spending.comparison.previousSpending);
    allowed.add(Math.abs(ctx.spending.comparison.difference));
    allowed.add(Math.abs(ctx.spending.comparison.percentageChange));
    allowed.add(Math.round(Math.abs(ctx.spending.comparison.percentageChange)));
  }
  for (const anom of (ctx.spending?.anomalies || [])) {
    allowed.add(anom.amount);
  }

  // 3. Goals numbers
  if (ctx.goals) {
    allowed.add(ctx.goals.totalGoals);
    for (const g of (ctx.goals.items || [])) {
      allowed.add(g.targetAmount);
      allowed.add(g.currentAmount);
      allowed.add(g.progressPercentage);
      allowed.add(Math.round(g.progressPercentage));
      allowed.add(g.remainingAmount);
      allowed.add(g.requiredMonthlyContribution);
      if (g.deadline) {
        try {
          const parts = g.deadline.split(/[-/]/).map(Number);
          parts.forEach((p) => !isNaN(p) && allowed.add(p));
        } catch {}
      }
    }
  }

  // 4. Cash Flow numbers
  if (ctx.cashFlow) {
    allowed.add(ctx.cashFlow.startingBalance);
    allowed.add(Math.abs(ctx.cashFlow.startingBalance));
    allowed.add(ctx.cashFlow.forecastMonthEndBalance);
    allowed.add(Math.abs(ctx.cashFlow.forecastMonthEndBalance));
    allowed.add(ctx.cashFlow.shortfall);
    allowed.add(Math.abs(ctx.cashFlow.shortfall));
    allowed.add(ctx.cashFlow.recommendedWeeklyReduction);
    allowed.add(Math.abs(ctx.cashFlow.recommendedWeeklyReduction));
    allowed.add(ctx.cashFlow.recommendedBuffer);
    allowed.add(Math.abs(ctx.cashFlow.recommendedBuffer));
  }

  // 5. Health numbers
  if (ctx.health) {
    if (ctx.health.score !== null) allowed.add(ctx.health.score);
    if (ctx.health.percentile !== null) allowed.add(ctx.health.percentile);
    if (ctx.health.savingConsistency !== null) allowed.add(ctx.health.savingConsistency);
    if (ctx.health.spendingControl !== null) allowed.add(ctx.health.spendingControl);
    if (ctx.health.cashFlowStability !== null) allowed.add(ctx.health.cashFlowStability);
    if (ctx.health.goalProgress !== null) allowed.add(ctx.health.goalProgress);
  }

  // 6. Cash-Out numbers
  if (ctx.cashOut) {
    allowed.add(ctx.cashOut.totalAmount);
    allowed.add(ctx.cashOut.count);
    allowed.add(ctx.cashOut.feeCost);
    allowed.add(ctx.cashOut.shareOfSpending);
    allowed.add(Math.round(ctx.cashOut.shareOfSpending));
    allowed.add(1.85); // MFS fee tariff percentage
  }

  // 7. Recent Transactions
  for (const tx of (ctx.recentTransactions || [])) {
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
 * Validates that every financial figure cited by Gemini exists in the authoritative context,
 * and detects semantic contradictions (e.g. reporting top category when lowest was asked).
 */
export function validateCoachNumbers(
  answer: string,
  ctx: CoachContext,
  additionalPrecomputed: number[] = [],
  intent?: string
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

  // Semantic contradiction checks
  if (intent === 'lowest_category') {
    const top = ctx.spending.topCategory;
    const lowest = ctx.spending.lowestCategory;
    if (top && lowest && top.category.toLowerCase() !== lowest.category.toLowerCase()) {
      // If the answer quotes the top category name without mentioning the lowest category name,
      // it's a semantic inversion contradiction
      const mentionsTop = lower.includes(top.category.toLowerCase());
      const mentionsLowest = lower.includes(lowest.category.toLowerCase()) ||
        (lowest.tiedCategories && lowest.tiedCategories.some(c => lower.includes(c.toLowerCase())));
      if (mentionsTop && !mentionsLowest) {
        return {
          valid: false,
          reason: `Semantic contradiction: Answer cites top category (${top.category}) when lowest category was requested.`,
        };
      }
    }
  } else if (intent === 'top_category') {
    const top = ctx.spending.topCategory;
    const lowest = ctx.spending.lowestCategory;
    if (top && lowest && top.category.toLowerCase() !== lowest.category.toLowerCase()) {
      const mentionsLowest = lower.includes(lowest.category.toLowerCase());
      const mentionsTop = lower.includes(top.category.toLowerCase()) ||
        (top.tiedCategories && top.tiedCategories.some(c => lower.includes(c.toLowerCase())));
      if (mentionsLowest && !mentionsTop) {
        return {
          valid: false,
          reason: `Semantic contradiction: Answer cites lowest category (${lowest.category}) when top category was requested.`,
        };
      }
    }
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
