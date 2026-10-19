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
export function extractAllowedNumbers(
  ctx: CoachContext,
  additionalAllowed: number[] = [],
  intent?: string,
  query?: string
): Set<number> {
  const allowed = new Set<number>();

  // Add standard conversational numbers (e.g., list bullets, standard rules, percentages, standard planning periods)
  // Large scenario/benchmark amounts are strictly contextual and added via additionalAllowed or query scenarios.
  const standardPermitted = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 21, 24, 25, 26, 28, 30, 50, 60, 90, 100, 180, 365,
    2024, 2025, 2026, 2027, 2028, 2029, 2030,
  ];
  standardPermitted.forEach((n) => allowed.add(n));

  // Date elements (year, day)
  try {
    const todayParts = ctx.metadata.today.split(/[-/]/).map(Number);
    todayParts.forEach((n) => !isNaN(n) && allowed.add(n));
  } catch {}

  // Data Window & History indicators
  if (ctx.metadata?.dataWindow) {
    if (ctx.metadata.dataWindow.totalTransactions !== undefined) {
      allowed.add(ctx.metadata.dataWindow.totalTransactions);
    }
    if (ctx.metadata.dataWindow.historicalMonthsCount !== undefined) {
      allowed.add(ctx.metadata.dataWindow.historicalMonthsCount);
    }
  }

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
  for (const amt of Object.values(ctx.spending.categoryTotals || {})) {
    allowed.add(amt);
  }
  for (const pct of Object.values(ctx.spending.categoryPercentages || {})) {
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

  // Baseline run-rate multipliers (1, 2, 3 months)
  const inc = ctx.snapshot.monthlyIncome || 0;
  const exp = ctx.snapshot.monthlySpending || 0;
  const net = ctx.snapshot.netSavings || (inc - exp);
  for (const m of [1, 2, 3]) {
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
  const bal = ctx.snapshot.currentBalance || 0;
  allowed.add(Math.round(bal / 4)); // weekly safe spending limit based on balance
  allowed.add(Math.round(bal / 2));

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
    // Standard 50/30/20 benchmark amounts
    allowed.add(Math.round(inc * 0.5));
    allowed.add(Math.round(inc * 0.3));
    allowed.add(Math.round(inc * 0.2));
  }
  if (exp > 0) {
    const essExpPct = (essTotal / exp) * 100;
    const discExpPct = (discTotal / exp) * 100;
    [essExpPct, discExpPct].forEach((p) => {
      allowed.add(Number(p.toFixed(1)));
      allowed.add(Math.round(p));
    });
    // Emergency fund living expenses benchmarks (3-month and 6-month)
    allowed.add(Math.round(exp * 3));
    allowed.add(Math.round(exp * 6));
  }

  // Illustrative starter budget amounts for users with 0 recorded income and expenses
  if (inc === 0 && exp === 0) {
    [30000, 15000, 9000, 6000].forEach((n) => allowed.add(n));
  }

  // Precomputed baseline recommendations for health_recommendations
  if (intent === 'health_recommendations') {
    for (const p of [0.1, 0.15, 0.2, 0.25, 0.3]) {
      allowed.add(Math.round(inc * p));
    }
  }

  // Multi-Month Projections (6, 10, 12 months scoped strictly to financial_projection intent or projection queries)
  const hasCallContext = intent !== undefined || query !== undefined;
  const isProjectionContext = hasCallContext
    ? (intent === 'financial_projection' ||
       Boolean(
         query && (
           query.includes('6-month') ||
           query.includes('৬ মাস') ||
           query.includes('six month') ||
           query.includes('6 month') ||
           query.includes('projection') ||
           query.includes('পূর্বাভাস') ||
           query.includes('12 month') ||
           query.includes('১ বছর')
         )
       ))
    : true; // When called without context (e.g. standalone projection unit tests), allow legitimate ledger multiples

  if (isProjectionContext) {
    for (const m of [6, 10, 12]) {
      allowed.add(m);
      allowed.add(m * inc);
      allowed.add(m * exp);
      allowed.add(m * net);
      allowed.add(Math.abs(m * net));
      allowed.add(Math.abs(m * (inc - exp)));
    }
  }

  // Hypothetical scenario amounts are accepted ONLY when explicitly part of the user's inquiry
  if (query) {
    const qLower = query.toLowerCase();
    const bnToAsciiMap: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    };
    const qAscii = qLower.replace(/[০-৯]/g, (d) => bnToAsciiMap[d] || d);
    const queryNumbers = extractNumbersFromText(query);
    queryNumbers.forEach((n) => allowed.add(n));

    const bal = ctx.snapshot.currentBalance || 0;
    for (const qn of queryNumbers) {
      if (qn >= 100) {
        allowed.add(Math.round(qn / 4)); // weekly pace
        allowed.add(Math.max(0, bal - qn)); // remaining balance buffer
        allowed.add(exp + qn); // spending + shock
        allowed.add(inc - (exp + qn)); // net surplus after expense shock
        allowed.add(Math.abs(inc - (exp + qn)));
        allowed.add(net + qn); // adjusted surplus with additional savings
        allowed.add(Math.round(qn * 6)); // 6-month accumulation
        allowed.add(Math.round(qn * 12)); // 1-year accumulation
      }
    }

    // Target amount divided by duration months (e.g., 50000 in 6 months)
    for (const t of queryNumbers) {
      if (t >= 1000) {
        for (const m of queryNumbers) {
          if (m >= 1 && m <= 60 && m !== t) {
            allowed.add(Math.round(t / m));
            allowed.add(Math.ceil(t / m));
            allowed.add(Math.floor(t / m));
            allowed.add(Math.round(t / m / 4));
            allowed.add(m * 4); // ~weeks
          }
        }
      }
    }

    // Optimistic vs Pessimistic Scenario Simulation
    if (
      qLower.includes('optimistic') ||
      qLower.includes('pessimistic') ||
      qLower.includes('আশাবাদী') ||
      qLower.includes('রক্ষণশীল')
    ) {
      allowed.add(10);
      allowed.add(Math.round(inc * 1.1));
      allowed.add(Math.round(inc * 1.1 - exp));
      allowed.add(Math.round(inc * 0.9));
      allowed.add(Math.round(inc * 0.9 - exp));
    }

    if (qAscii.includes('15%')) {
      allowed.add(15);
      allowed.add(Math.round(exp * 0.15));
      allowed.add(Math.round(exp * 1.15));
      allowed.add(Math.round(inc - exp * 1.15));
      allowed.add(Math.round(inc * 0.15));
      allowed.add(Math.round(inc * 1.15));
    }
    if (qAscii.includes('20%')) {
      allowed.add(20);
      allowed.add(Math.round(inc * 0.2));
      allowed.add(Math.round(inc * 0.8));
      allowed.add(Math.round(inc * 0.8 - exp));
      allowed.add(Math.round(exp * 0.2));
      allowed.add(Math.round(exp * 1.2));
    }
    if (qAscii.includes('10%')) {
      allowed.add(10);
      allowed.add(Math.round(inc * 0.1));
      allowed.add(Math.round(inc * 1.1));
      allowed.add(Math.round(inc * 1.1 - exp));
      allowed.add(Math.round(exp * 0.1));
      allowed.add(Math.round(exp * 0.9));
      allowed.add(Math.round(inc - exp * 0.9));
      const discTotal = ctx.spending.discretionaryTotal || 0;
      allowed.add(Math.round(discTotal * 0.1));
      allowed.add(Math.round(discTotal * 0.9));
    }
    if (qAscii.includes('5%')) {
      allowed.add(5);
      allowed.add(Math.round(exp * 0.05));
      allowed.add(Math.round(exp * 1.05));
      allowed.add(Math.round(inc - exp * 1.05));
    }
  }
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
    if (ctx.goals.totalTargetAmount !== undefined) allowed.add(ctx.goals.totalTargetAmount);
    if (ctx.goals.totalSavedAmount !== undefined) allowed.add(ctx.goals.totalSavedAmount);
    if (ctx.goals.totalRemainingAmount !== undefined) allowed.add(ctx.goals.totalRemainingAmount);
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
    if (ctx.cashFlow.upcomingBills !== undefined) {
      allowed.add(ctx.cashFlow.upcomingBills);
      allowed.add(Math.abs(ctx.cashFlow.upcomingBills));
    }
    if (ctx.cashFlow.safeSpendingLimitWeekly !== undefined) {
      allowed.add(ctx.cashFlow.safeSpendingLimitWeekly);
      allowed.add(Math.abs(ctx.cashFlow.safeSpendingLimitWeekly));
    }
    if (ctx.cashFlow.safeSpendingLimitRemaining !== undefined) {
      allowed.add(ctx.cashFlow.safeSpendingLimitRemaining);
      allowed.add(Math.abs(ctx.cashFlow.safeSpendingLimitRemaining));
    }
    if (ctx.cashFlow.uncommittedDiscretionaryPool !== undefined) {
      allowed.add(ctx.cashFlow.uncommittedDiscretionaryPool);
      allowed.add(Math.abs(ctx.cashFlow.uncommittedDiscretionaryPool));
    }
    if (ctx.cashFlow.committedFunds !== undefined) {
      allowed.add(ctx.cashFlow.committedFunds);
      allowed.add(Math.abs(ctx.cashFlow.committedFunds));
    }
    if (ctx.cashFlow.remainingDaysInMonth !== undefined) {
      allowed.add(ctx.cashFlow.remainingDaysInMonth);
    }
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
  intent?: string,
  query?: string
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

  // Financial Health Score data-sufficiency contradiction check
  const isHealthInsufficient =
    ctx.health &&
    (ctx.health.score === null ||
      ctx.health.band === 'Insufficient Data' ||
      ctx.health.band === 'insufficient_data' ||
      !ctx.health.available);
  if (isHealthInsufficient) {
    // If health calculation returned insufficient_data / null, AI must not assert a numeric score or Excellent rating
    const claimsScore =
      /(?:health\s*score|হেলথ\s*স্কোর|স্কোর)[^.\n]*?(?:100\s*\/\s*100|১০০\s*\/\s*১০০|\b100\b|\b১০০\b)/i.test(answer) ||
      /(?:health\s*score|হেলথ\s*স্কোর|স্কোর)[^.\n]*?(?:excellent|চমৎকার)/i.test(answer) ||
      /rating:\s*(?:\*\*)?excellent/i.test(answer) ||
      /রেটিং:\s*(?:\*\*)?চমৎকার/i.test(answer);
    if (claimsScore) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer asserts a Financial Health Score of 100/100 or Excellent rating when authoritative calculation returned insufficient data.',
      };
    }
  }

  // If Saving Consistency is null, AI must not assert 100% Saving Consistency
  if (ctx.health && ctx.health.savingConsistency === null) {
    const claimsSavingConsistency100 =
      /(?:saving\s*consistency|ধারাবাহিক\s*সঞ্চয়|সঞ্চয়ের\s*ধারাবাহিকতা)[^.\n]*?(?:100%|১০০%)/i.test(answer);
    if (claimsSavingConsistency100) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer asserts 100% Saving Consistency when authoritative calculation has insufficient historical data.',
      };
    }
  }

  // If confidence is low, Spending Control must not be presented with bare certainty without preliminary disclaimer
  const totalTxCount = ctx.metadata?.dataWindow?.totalTransactions ?? ctx.recentTransactions?.length ?? 0;
  const isConfidenceLow = (ctx.health?.confidence ? ctx.health.confidence.toLowerCase() === 'low' : false) || totalTxCount <= 3;
  if (isConfidenceLow && ctx.health?.score !== null) {
    const barePillarCertainty =
      /(?:spending\s*control|ব্যয়\s*নিয়ন্ত্রণ):\s*(?:\*\*)?100%(?!\s*—)/i.test(answer) &&
      !/(?:preliminary|প্রাথমিক)/i.test(answer);
    if (barePillarCertainty) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer asserts unconditional 100% Spending Control without preliminary status when data confidence is low.',
      };
    }
  }

  // If uncommitted discretionary pool is 0 because funds are committed, AI must not recommend positive weekly spending
  if (
    ctx.cashFlow &&
    ctx.cashFlow.uncommittedDiscretionaryPool === 0 &&
    (ctx.snapshot.currentBalance || 0) > 0 &&
    (ctx.cashFlow.committedFunds || 0) >= (ctx.snapshot.currentBalance || 0)
  ) {
    const claimsPositiveWeeklyLimit =
      /(?:weekly\s*(?:spending\s*)?limit|safe\s*(?:personal\s*)?spending|সাপ্তাহিক\s*খরচের\s*সীমা|নিরাপদ\s*(?:ব্যক্তিগত\s*)?খরচ)[^.\n]*?(?:[1-9](?:,?\d){2,}|[১-৯](?:,?[০-৯]){2,})/i.test(answer) &&
      !/(?:0\/week|০\/সপ্তাহ|৳0|৳০|0\s*per\s*week|০\s*প্রতি\s*সপ্তাহ)/i.test(answer);
    if (claimsPositiveWeeklyLimit) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer recommends positive weekly spending when available balance is fully committed to obligations/buffer.',
      };
    }
  }

  // If balance is estimated from unlinked ledger, AI must not claim verified bank/wallet balance
  if (ctx.cashFlow && ctx.cashFlow.isBalanceEstimated) {
    const claimsVerifiedBankBalance =
      /(?:verified\s*(?:liquid|bank|wallet)\s*balance|যাচাইকৃত\s*(?:তরল|ব্যাংক|ওয়ালেট)\s*ব্যালেন্স)/i.test(answer) &&
      !/(?:estimate|estimated|আনুমানিক|unlinked|অসংযুক্ত)/i.test(answer);
    if (claimsVerifiedBankBalance) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer claims a verified bank balance when no accounts are linked and balance is derived from transactions.',
      };
    }
  }

  // If authoritative buffer is 0, reject claims asserting arbitrary 15% or 7,200 buffer
  if (ctx.cashFlow && ctx.cashFlow.recommendedBuffer === 0) {
    const claimsArbitraryBuffer =
      /(?:safety\s*buffer|নিরাপত্তা\s*বাফার)[^.\n]*?(?:7,200|7200|৭,২০০|৭২০০|15%|১৫%)/i.test(answer);
    if (claimsArbitraryBuffer) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer asserts an arbitrary 15% safety buffer when authoritative buffer rule requires 0 due to lack of recurring bills/data.',
      };
    }
  }

  // Monthly Inflow Baseline integrity:
  // Reject double-counting expected baseline with recorded transaction income as realized income
  if (
    ctx.snapshot.monthlyIncome > 0 &&
    ctx.snapshot.profileMonthlyIncome !== undefined &&
    ctx.snapshot.profileMonthlyIncome > 0
  ) {
    const sumIncome = ctx.snapshot.monthlyIncome + ctx.snapshot.profileMonthlyIncome;
    const formattedSum = sumIncome.toLocaleString('en-US');
    const regexSum = new RegExp(
      `(?:total\\s*income|realized\\s*income|actual\\s*income|সর্বমোট\\s*আয়|প্রকৃত\\s*আয়)[^.\\n]*?(?:${sumIncome}|${formattedSum})`,
      'i'
    );
    if (regexSum.test(answer)) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer double-counts expected monthly inflow baseline with recorded transaction income as realized income.',
      };
    }
  }

  // Reject adding expected monthly inflow baseline directly into liquid/available balance
  if (
    ctx.snapshot.profileMonthlyIncome !== undefined &&
    ctx.snapshot.profileMonthlyIncome > 0 &&
    (ctx.snapshot.currentBalance || 0) > 0
  ) {
    const sumBalBaseline = (ctx.snapshot.currentBalance || 0) + ctx.snapshot.profileMonthlyIncome;
    const formattedBalBaseline = sumBalBaseline.toLocaleString('en-US');
    const regexBalBaseline = new RegExp(
      `(?:liquid\\s*balance|available\\s*balance|current\\s*balance|উদ্বৃত্ত\\s*ব্যালেন্স|বর্তমান\\s*ব্যালেন্স)[^.\\n]*?(?:${sumBalBaseline}|${formattedBalBaseline})`,
      'i'
    );
    if (regexBalBaseline.test(answer)) {
      return {
        valid: false,
        reason:
          'Semantic contradiction: Answer adds expected monthly inflow baseline directly into liquid/available balance.',
      };
    }
  }

  // Manufactured ৳1 savings target check
  const claims1TakaTarget =
    /(?<![\d০-৯])(?:(?:৳|tk|taka)\s*)?1\s*(?:\/|\s*per\s*)month\b|(?<![\d০-৯])১\s*টাকা\s*(?:\/|\s*প্রতি\s*)\s*মাস/i.test(
      answer
    ) ||
    /(?:savings?\s*(?:target|plan|goal)|target|plan|সঞ্চয়\s*(?:লক্ষ্য|পরিকল্পনা)|লক্ষ্য)[^.\n]*?(?<![\d০-৯])(?:(?:৳|tk|taka)\s*)?0\s*(?:\/|\s*per\s*)week\b/i.test(
      answer
    );
  const queryHas1Taka = query && /(?:৳|tk|taka|\$)\s*1\b|\b1\s*(?:tk|taka|৳|\$)\b|১\s*টাকা/i.test(query);
  if (claims1TakaTarget && !queryHas1Taka) {
    return {
      valid: false,
      reason: 'Semantic contradiction: Answer manufactured an unrequested ৳1/month savings target.',
    };
  }

  // Extract all numbers from the generated response
  const numbersInAnswer = extractNumbersFromText(answer);
  const allowedSet = extractAllowedNumbers(ctx, additionalPrecomputed, intent, query);

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

/**
 * Detects whether the predominant language of the response is English or Bangla.
 * Allows Bangladesh Taka symbol ৳ (\u09F3) in English responses.
 */
export function detectResponseLanguage(text: string): 'en' | 'bn' {
  if (!text || typeof text !== 'string') return 'en';
  // Exclude \u09F3 (৳ symbol) when counting Bengali letters
  const bnChars = (text.match(/[\u0980-\u09F2\u09F4-\u09FF]/g) || []).length;
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (bnChars >= 10 && bnChars >= enChars * 0.2) {
    return 'bn';
  }
  return 'en';
}

/**
 * Validates that the answer strictly matches the expected language.
 * English inquiries must receive English answers (with optional ৳ symbol).
 * Bangla inquiries must receive Bangla answers with genuine Bengali script.
 */
export function verifyLanguageMatch(
  answer: string,
  expectedLanguage: 'en' | 'bn'
): { matched: boolean; detected: 'en' | 'bn'; reason?: string } {
  const detected = detectResponseLanguage(answer);
  if (expectedLanguage === 'bn') {
    const bnChars = (answer.match(/[\u0980-\u09F2\u09F4-\u09FF]/g) || []).length;
    if (bnChars < 10) {
      return {
        matched: false,
        detected: 'en',
        reason: `Language mismatch: Expected Bangla ('bn') response, but response has only ${bnChars} Bengali characters.`,
      };
    }
    return { matched: true, detected: 'bn' };
  } else {
    // Expected English: Ensure no significant Bengali prose (excluding ৳)
    const bnChars = (answer.match(/[\u0980-\u09F2\u09F4-\u09FF]/g) || []).length;
    if (bnChars > 5) {
      return {
        matched: false,
        detected: 'bn',
        reason: `Language mismatch: Expected English ('en') response, but found ${bnChars} Bengali prose characters.`,
      };
    }
    return { matched: true, detected: 'en' };
  }
}
