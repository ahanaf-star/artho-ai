import { CoachContext, FactItem } from './coachContextBuilder';

export type CoachIntent =
  | 'spending_total'
  | 'top_category'
  | 'lowest_category'
  | 'highest_merchant'
  | 'lowest_merchant'
  | 'largest_expense'
  | 'smallest_expense'
  | 'income_total'
  | 'mom_comparison'
  | 'zero_spending'
  | 'month_end_balance'
  | 'savings_goal_progress'
  | 'savings_plan'
  | 'unusual_spending'
  | 'reduce_cash_outs'
  | 'financial_health'
  | 'health_recommendations'
  | 'financial_projection'
  | 'budget_help'
  | 'transaction_lookup'
  | 'general_education'
  | 'out_of_scope';

export interface ParsedSavingsPlan {
  targetAmount: number;
  monthsDuration?: number;
  monthlyTarget: number;
  weeklyTarget: number;
  requiredMonthly: number;
  currentMonthlySurplus: number;
  isFeasible: boolean;
  monthlyGap: number;
  surplusDiff: number;
  isRecurringMonthly?: boolean;
}

export interface IntentResult {
  intent: CoachIntent;
  confidence: number;
  parsedPlan?: ParsedSavingsPlan;
  matchedKeywords: string[];
}

export interface SlicedContext {
  intent: CoachIntent;
  dataWindow: {
    currentMonth: string;
    today: string;
    hasData: boolean;
  };
  facts: Record<string, any>;
  factKeys: string[];
  disclaimer: string;
}

/**
 * Normalizes text for keyword matching in English and Bengali
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[৳$,?!.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts target amount and duration or monthly recurring target from queries like:
 * "save ৳30,000 in 6 months", "save 50000 in 10 months", "৬ মাসে ৩০,০০০ টাকা সঞ্চয়",
 * "How can I save 6000 tk per month?", "আমি প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব?"
 */
export function parseSavingsTarget(
  query: string,
  currentNetSavings: number = 0
): ParsedSavingsPlan | undefined {
  // Convert Bengali numerals to Western digits for unified parsing
  const bnToEnDigits: Record<string, string> = {
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
  const normalizedDigits = query.replace(/[০-৯]/g, (d) => bnToEnDigits[d] || d);

  // Pattern 1: Fixed duration in English: "save [amount] in [months] months"
  const enMatch = normalizedDigits.match(
    /(?:save|target|reach)\s*(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(?:bdt|tk|taka|৳|\$)?\s*(?:in|within|over|for)?\s*([0-9]+)\s*(?:months?|mas)/i
  );
  if (enMatch) {
    const targetAmount = parseInt(enMatch[1].replace(/,/g, ''), 10);
    const monthsDuration = parseInt(enMatch[2], 10);
    if (targetAmount > 0 && monthsDuration > 0) {
      const requiredMonthly = Math.round(targetAmount / monthsDuration);
      const isFeasible = currentNetSavings >= requiredMonthly;
      const monthlyGap = Math.max(0, requiredMonthly - currentNetSavings);
      const surplusDiff = Math.abs(currentNetSavings - requiredMonthly);
      return {
        targetAmount,
        monthsDuration,
        monthlyTarget: requiredMonthly,
        weeklyTarget: Math.round(requiredMonthly / 4),
        requiredMonthly,
        currentMonthlySurplus: currentNetSavings,
        isFeasible,
        monthlyGap,
        surplusDiff,
        isRecurringMonthly: false,
      };
    }
  }

  // Pattern 2: Fixed duration in Bengali: "[months] মাসে [amount] টাকা" or "[amount] টাকা [months] মাসে"
  const bnMatch1 = normalizedDigits.match(/([0-9]+)\s*মাসে\s*([0-9,]+)\s*(?:টাকা)?/);
  if (bnMatch1) {
    const monthsDuration = parseInt(bnMatch1[1], 10);
    const targetAmount = parseInt(bnMatch1[2].replace(/,/g, ''), 10);
    if (targetAmount > 0 && monthsDuration > 0) {
      const requiredMonthly = Math.round(targetAmount / monthsDuration);
      const isFeasible = currentNetSavings >= requiredMonthly;
      const monthlyGap = Math.max(0, requiredMonthly - currentNetSavings);
      const surplusDiff = Math.abs(currentNetSavings - requiredMonthly);
      return {
        targetAmount,
        monthsDuration,
        monthlyTarget: requiredMonthly,
        weeklyTarget: Math.round(requiredMonthly / 4),
        requiredMonthly,
        currentMonthlySurplus: currentNetSavings,
        isFeasible,
        monthlyGap,
        surplusDiff,
        isRecurringMonthly: false,
      };
    }
  }

  const bnMatch2 = normalizedDigits.match(/([0-9,]+)\s*(?:টাকা)?\s*([0-9]+)\s*মাসে/);
  if (bnMatch2) {
    const targetAmount = parseInt(bnMatch2[1].replace(/,/g, ''), 10);
    const monthsDuration = parseInt(bnMatch2[2], 10);
    if (targetAmount > 0 && monthsDuration > 0) {
      const requiredMonthly = Math.round(targetAmount / monthsDuration);
      const isFeasible = currentNetSavings >= requiredMonthly;
      const monthlyGap = Math.max(0, requiredMonthly - currentNetSavings);
      const surplusDiff = Math.abs(currentNetSavings - requiredMonthly);
      return {
        targetAmount,
        monthsDuration,
        monthlyTarget: requiredMonthly,
        weeklyTarget: Math.round(requiredMonthly / 4),
        requiredMonthly,
        currentMonthlySurplus: currentNetSavings,
        isFeasible,
        monthlyGap,
        surplusDiff,
        isRecurringMonthly: false,
      };
    }
  }

  // Pattern 3: English monthly recurring savings target (e.g. "save 6000 tk per month", "save ৳6,000 monthly")
  const isMonthlyEn = /(?:per|each|every|a)\s*month|monthly/i.test(normalizedDigits);
  if (isMonthlyEn) {
    const m =
      normalizedDigits.match(
        /(?:save|reach|target|stash|accumulate).*?(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(?:bdt|tk|taka|৳|\$)?/i
      ) ||
      normalizedDigits.match(
        /(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(?:bdt|tk|taka|৳|\$)?.*?(?:(?:per|each|every|a)\s*month|monthly)/i
      );
    if (m) {
      const targetAmount = parseInt(m[1].replace(/,/g, ''), 10);
      if (targetAmount > 0) {
        const isFeasible = currentNetSavings >= targetAmount;
        const monthlyGap = Math.max(0, targetAmount - currentNetSavings);
        const surplusDiff = Math.abs(currentNetSavings - targetAmount);
        return {
          targetAmount,
          monthlyTarget: targetAmount,
          weeklyTarget: Math.round(targetAmount / 4),
          requiredMonthly: targetAmount,
          currentMonthlySurplus: currentNetSavings,
          isFeasible,
          monthlyGap,
          surplusDiff,
          isRecurringMonthly: true,
        };
      }
    }
  }

  // Pattern 4: Bengali monthly recurring savings target (e.g. "প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব", "মাসে ৬০০০ টাকা সঞ্চয়")
  const hasSavingsWordBn = /(?:সঞ্চয়|সঞ্চয়|সেভ|জমা|বাঁচাব|বাঁচাবো)/.test(normalizedDigits);
  const isMonthlyBn = hasSavingsWordBn && /(?:প্রতি\s*মাসে|মাসে|মাসিক)/.test(normalizedDigits);
  if (isMonthlyBn) {
    const m =
      normalizedDigits.match(/(?:প্রতি\s*মাসে|মাসে|মাসিক).*?([0-9,]+)\s*(?:টাকা)?/) ||
      normalizedDigits.match(/([0-9,]+)\s*(?:টাকা)?.*?(?:প্রতি\s*মাসে|মাসে|মাসিক)/);
    if (m) {
      const targetAmount = parseInt(m[1].replace(/,/g, ''), 10);
      if (targetAmount > 0) {
        const isFeasible = currentNetSavings >= targetAmount;
        const monthlyGap = Math.max(0, targetAmount - currentNetSavings);
        const surplusDiff = Math.abs(currentNetSavings - targetAmount);
        return {
          targetAmount,
          monthlyTarget: targetAmount,
          weeklyTarget: Math.round(targetAmount / 4),
          requiredMonthly: targetAmount,
          currentMonthlySurplus: currentNetSavings,
          isFeasible,
          monthlyGap,
          surplusDiff,
          isRecurringMonthly: true,
        };
      }
    }
  }

  return undefined;
}

/**
 * Deterministic rule-based intent classifier (Zero LLM calls)
 */
export function classifyIntent(query: string, currentNetSavings: number = 0): IntentResult {
  const norm = normalizeText(query);

  // Check for out-of-scope / unauthorized domains first
  // Investments / Stocks / Crypto / Medical / Code / Credit Approval
  const outOfScopePatterns = [
    'buy stock',
    'stock pick',
    'crypto',
    'bitcoin',
    'ethereum',
    'invest in shares',
    'share market tip',
    'শেয়ার বাজার',
    'স্টক কিনব',
    'ক্রিপ্টো',
    'approve loan',
    'loan guarantee',
    'credit decision',
    'medical advice',
    'doctor',
    'write code',
    'recipe',
  ];
  for (const p of outOfScopePatterns) {
    if (norm.includes(p)) {
      return {
        intent: 'out_of_scope',
        confidence: 0.95,
        matchedKeywords: [p],
      };
    }
  }

  // Check for savings plan with parsed parameters ("save 30,000 in 6 months")
  const parsedPlan = parseSavingsTarget(query, currentNetSavings);
  if (parsedPlan) {
    return {
      intent: 'savings_plan',
      confidence: 0.99,
      parsedPlan,
      matchedKeywords: ['parsed_target_plan'],
    };
  }

  // 1. Cash-out & MFS Fee reduction
  const cashOutPatterns = [
    'cash out',
    'cash-out',
    'mfs fee',
    'bkash charge',
    'nagad charge',
    'atm fee',
    'withdrawal fee',
    'bank fee',
    'tariff',
    'fee leak',
    'ক্যাশ আউট',
    'ক্যাশআউট',
    'উইথড্র ফি',
    'চার্জ কমাব',
    'ফি সাশ্রয়',
  ];
  for (const p of cashOutPatterns) {
    if (norm.includes(p)) {
      return { intent: 'reduce_cash_outs', confidence: 0.9, matchedKeywords: [p] };
    }
  }

  // 1b. Multi-Month Financial Projections & Long-Term Position
  const projectionPatterns = [
    'predict my financial position',
    'predict my financial',
    'predict my finances',
    'predict my balance',
    'financial position for the next',
    'financial position next',
    'position for the next six months',
    'for the next six months',
    'for the next 6 months',
    'next six months',
    'next 6 months',
    'next 3 months',
    'next 12 months',
    'six months based on',
    '6 months based on',
    'six-month projection',
    '6-month projection',
    'six month projection',
    '6 month projection',
    'financial projection',
    'future projection',
    'forecast for next',
    'forecast next 6',
    'forecast next six',
    'আর্থিক পূর্বাভাস',
    'ভবিষ্যতের পূর্বাভাস',
    'ভবিষ্যত আর্থিক অবস্থান',
    'আগামী ৬ মাস',
    'আগামী ছয় মাস',
    'পরবর্তী ৬ মাস',
    'পরবর্তী ছয় মাস',
  ];
  for (const p of projectionPatterns) {
    if (norm.includes(p)) {
      return { intent: 'financial_projection', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 2. Month-End Balance & Cash Flow Forecast
  const monthEndPatterns = [
    'month end',
    'month-end',
    'end of month',
    'run short',
    'short before',
    'left over',
    'projected balance',
    'forecast balance',
    'balance next month',
    'cash flow',
    'ক্যাশ ফ্লো',
    'মাস শেষ',
    'মাস শেষে',
    'টাকা শেষ',
    'কত টাকা থাকতে পারে',
    'টানাপোড়েন',
  ];
  for (const p of monthEndPatterns) {
    if (norm.includes(p)) {
      return { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [p] };
    }
  }

  // 3. Extrema & Direct Factual Spending Queries
  // 3a. Lowest Spending Merchant (checked before category queries so "least spent merchant" doesn't hit category)
  const lowestMerchPatterns = [
    'lowest merchant',
    'lowest spending merchant',
    'least spending merchant',
    'which merchant did i spend least',
    'which merchant did i spend the least',
    'spend least at',
    'spend the least at',
    'least spent merchant',
    'lowest vendor',
    'সবচেয়ে কম মার্চেন্ট',
    'কোন মার্চেন্টে কম',
    'সর্বনিম্ন মার্চেন্ট',
    'কোন মার্চেন্টে সবচেয়ে কম',
  ];
  for (const p of lowestMerchPatterns) {
    if (norm.includes(p)) {
      return { intent: 'lowest_merchant', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 3b. Highest Spending Merchant
  const highestMerchPatterns = [
    'highest merchant',
    'top merchant',
    'highest spending merchant',
    'most spending merchant',
    'which merchant did i spend most',
    'which merchant did i spend the most',
    'spend most at',
    'spend the most at',
    'top vendor',
    'highest vendor',
    'সবচেয়ে বেশি মার্চেন্ট',
    'কোন মার্চেন্টে বেশি',
    'শীর্ষ মার্চেন্ট',
    'সর্বোচ্চ মার্চেন্ট',
    'কোন মার্চেন্টে সবচেয়ে বেশি',
  ];
  for (const p of highestMerchPatterns) {
    if (norm.includes(p)) {
      return { intent: 'highest_merchant', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 3c. Largest Individual Expense Transaction
  const largestExpensePatterns = [
    'largest individual expense',
    'largest transaction',
    'largest single expense',
    'biggest single expense',
    'highest transaction',
    'biggest transaction',
    'biggest purchase',
    'largest purchase',
    'single largest',
    'single biggest',
    'maximum transaction',
    'একক সর্বোচ্চ খরচ',
    'সবচেয়ে বড় লেনদেন',
    'সবচেয়ে বড় খরচ',
    'সবচেয়ে দামি কেনাকাটা',
    'এককালীন সর্বোচ্চ',
  ];
  for (const p of largestExpensePatterns) {
    if (norm.includes(p)) {
      return { intent: 'largest_expense', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 3d. Smallest Individual Expense Transaction
  const smallestExpensePatterns = [
    'smallest individual expense',
    'smallest transaction',
    'smallest single expense',
    'lowest transaction',
    'smallest purchase',
    'minimum transaction',
    'single smallest',
    'একক সর্বনিম্ন খরচ',
    'সবচেয়ে ছোট লেনদেন',
    'সবচেয়ে ছোট খরচ',
    'ক্ষুদ্রতম লেনদেন',
  ];
  for (const p of smallestExpensePatterns) {
    if (norm.includes(p)) {
      return { intent: 'smallest_expense', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 3e. Lowest Spending Category
  const lowestCatPatterns = [
    'lowest category',
    'lowest spending category',
    'least spending category',
    'least spent category',
    'lowest expense category',
    'lowest category spending',
    'where do i spend least',
    'where do i spend the least',
    'spend the least',
    'lowest spending',
    'lowest spend',
    'lowest expense',
    'least expense',
    'smallest category',
    'minimum spending category',
    'minimum spend',
    'সর্বনিম্ন খরচ',
    'সবচেয়ে কম খরচ',
    'সবচেয়ে কম ব্যয়',
    'কোন খাতে সবচেয়ে কম',
    'কোন খাতে কম',
    'কম খরচ',
    'ন্যূনতম খরচ',
    'সর্বনিম্ন ব্যয়ের খাত',
    'সবচেয়ে কম খরচের খাত',
    'সবচেয়ে কম খরচের খাত',
  ];
  for (const p of lowestCatPatterns) {
    if (norm.includes(p)) {
      return { intent: 'lowest_category', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 3f. Top / Highest Spending Category
  const topCatPatterns = [
    'top category',
    'top spending category',
    'highest spending category',
    'highest expense category',
    'biggest expense category',
    'top spending',
    'highest category',
    'highest spending',
    'highest expense',
    'biggest expense',
    'where do i spend most',
    'where do i spend the most',
    'spend the most',
    'biggest outflow',
    'highest category spending',
    'most expensive category',
    'শীর্ষ খাত',
    'সবচেয়ে বেশি খরচ',
    'কোন খাতে বেশি',
    'কোথায় বেশি খরচ',
    'সর্বোচ্চ খরচ',
    'সর্বোচ্চ খরচের খাত',
  ];
  for (const p of topCatPatterns) {
    if (norm.includes(p)) {
      return { intent: 'top_category', confidence: 0.93, matchedKeywords: [p] };
    }
  }

  // 3g. Zero Spending Categories
  const zeroSpendingPatterns = [
    'zero spending',
    'zero expense',
    'no spending',
    'no expense',
    'categories with no spend',
    'where did i not spend',
    'did not spend',
    'didn t spend',
    'didn\'t spend',
    'কোনো খরচ হয়নি',
    'কোন খরচ হয়নি',
    'খরচ হয়নি এমন খাত',
    'শূন্য খরচ',
    'যে খাতে খরচ হয়নি',
  ];
  for (const p of zeroSpendingPatterns) {
    if (norm.includes(p)) {
      return { intent: 'zero_spending', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 3h. Month-over-Month Comparison
  const momComparisonPatterns = [
    'spend more than last month',
    'spend less than last month',
    'compared to last month',
    'comparison with last month',
    'month over month',
    'mom spending',
    'vs last month',
    'versus last month',
    'last month vs this month',
    'গত মাসের চেয়ে বেশি',
    'গত মাসের চেয়ে কম',
    'গত মাসের তুলনায়',
    'গত মাসের সাথে তুলনা',
    'আগের মাসের চেয়ে',
  ];
  for (const p of momComparisonPatterns) {
    if (norm.includes(p)) {
      return { intent: 'mom_comparison', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 3i. Total Income Inquiries
  const incomeTotalPatterns = [
    'total income',
    'how much did i earn',
    'how much income',
    'my earnings',
    'income this month',
    'monthly income',
    'মোট আয়',
    'এ মাসের আয়',
    'কত টাকা আয়',
    'আমার আয় কত',
    'উপার্জন কত',
  ];
  for (const p of incomeTotalPatterns) {
    if (norm.includes(p)) {
      return { intent: 'income_total', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 4. Unusual Spending & Anomalies
  const anomalyPatterns = [
    'unusual',
    'anomaly',
    'surge',
    'unexpected expense',
    'higher than usual',
    'food surge',
    'spike',
    'অস্বাভাবিক',
    'হঠাৎ বৃদ্ধি',
    'অপ্রত্যাশিত',
    'সার্জ',
    'বেশি লেগেছে',
  ];
  for (const p of anomalyPatterns) {
    if (norm.includes(p)) {
      return { intent: 'unusual_spending', confidence: 0.88, matchedKeywords: [p] };
    }
  }

  // 5. Savings Goals Progress & On-Track Status
  const goalPatterns = [
    'goal',
    'on track',
    'emergency fund',
    'target amount',
    'progress on goal',
    'goal deadline',
    'লক্ষ্য',
    'টার্গেট',
    'ইমার্জেন্সি ফান্ড',
    'লক্ষ্যমাত্রা',
    'অন ট্র্যাক',
  ];
  for (const p of goalPatterns) {
    if (norm.includes(p)) {
      return { intent: 'savings_goal_progress', confidence: 0.9, matchedKeywords: [p] };
    }
  }

  // 6. Savings Plan & Saving More
  const savingsPlanPatterns = [
    'save more',
    'how can i save',
    'savings rate',
    'reach 30%',
    'increase savings',
    'savings plan',
    'বেশি সঞ্চয়',
    'সঞ্চয় বাড়াব',
    'কীভাবে সঞ্চয়',
    'সঞ্চয়ের হার',
  ];
  for (const p of savingsPlanPatterns) {
    if (norm.includes(p)) {
      return { intent: 'savings_plan', confidence: 0.88, matchedKeywords: [p] };
    }
  }

  // 6b. Actionable Financial Health Recommendations (3 actions)
  const recommendationPatterns = [
    'actions i should take',
    'actions should i take',
    'three most useful actions',
    '3 most useful actions',
    'useful actions',
    'three actions',
    '3 actions',
    'actions to improve',
    'steps to improve',
    'recommendations to improve',
    'recommendations for my financial health',
    'recommendations to improve my financial health',
    'how can i improve my financial health',
    'how to improve my financial health',
    'improve my financial health',
    'ways to improve my financial health',
    'কী পদক্ষেপ নেব',
    'কী কী পদক্ষেপ',
    'তিনটি পদক্ষেপ',
    'তিনটি পরামর্শ',
    '৩টি পদক্ষেপ',
    'উন্নতি করার ৩টি',
    'উন্নতি করার উপায়',
    'আর্থিক স্বাস্থ্য উন্নতি',
  ];
  for (const p of recommendationPatterns) {
    if (norm.includes(p)) {
      return { intent: 'health_recommendations', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 7. Financial Health Score
  const healthPatterns = [
    'health score',
    'financial health',
    'how healthy',
    'health status',
    'my score',
    'আর্থিক স্বাস্থ্য',
    'হেলথ স্কোর',
    'স্কোর কত',
    'আর্থিক অবস্থা',
  ];
  for (const p of healthPatterns) {
    if (norm.includes(p)) {
      return { intent: 'financial_health', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 8. Total Spending Inquiries
  const totalSpendingPatterns = [
    'how much did i spend',
    'total spending',
    'total expense',
    'how much i spent',
    'spending this month',
    'কত টাকা খরচ',
    'মোট খরচ',
    'এ মাসের খরচ',
    'কত খরচ করেছি',
  ];
  for (const p of totalSpendingPatterns) {
    if (norm.includes(p)) {
      return { intent: 'spending_total', confidence: 0.9, matchedKeywords: [p] };
    }
  }

  // 9. Budget & Spending Reduction Advice
  const budgetPatterns = [
    'budget',
    'reduce spending',
    'cut spending',
    'which category should i cut',
    'where should i reduce',
    'trim expense',
    'বাজেট',
    'খরচ কমাব',
    'খরচ কাটব',
    'কোন খাত কমাব',
  ];
  for (const p of budgetPatterns) {
    if (norm.includes(p)) {
      return { intent: 'budget_help', confidence: 0.85, matchedKeywords: [p] };
    }
  }

  // 10. Transaction Lookup
  const txLookupPatterns = [
    'last transaction',
    'recent transaction',
    'recent spending',
    'latest purchase',
    'what was my last',
    'শেষ লেনদেন',
    'সাম্প্রতিক লেনদেন',
    'সাম্প্রতিক খরচ',
  ];
  for (const p of txLookupPatterns) {
    if (norm.includes(p)) {
      return { intent: 'transaction_lookup', confidence: 0.88, matchedKeywords: [p] };
    }
  }

  // 11. General Education
  const generalEduPatterns = [
    'what is the 50/30/20',
    'what is 50/30/20',
    '50/30/20 rule',
    '50/30/20',
    'budgeting rule',
    'explain 50/30/20',
    'explain rule',
    'কীভাবে কাজ করে',
    'কাকে বলে',
  ];
  for (const p of generalEduPatterns) {
    if (norm.includes(p)) {
      return { intent: 'general_education', confidence: 0.75, matchedKeywords: [p] };
    }
  }

  // Default fallback intent for general inquiries
  return {
    intent: 'spending_total',
    confidence: 0.6,
    matchedKeywords: ['default_fallback'],
  };
}

/**
 * Context Slicing: Returns only the exact fact subset needed for the classified intent
 */
export function sliceContext(fullContext: CoachContext, intentResult: IntentResult): SlicedContext {
  const { intent, parsedPlan } = intentResult;
  const facts: Record<string, any> = {};
  const factKeys: string[] = [];

  const addFact = (key: string, value: any) => {
    facts[key] = value;
    factKeys.push(key);
  };

  // Base snapshot facts included in most slices
  const includeSnapshot = (includeIncomeExpenses = true) => {
    addFact('snapshot.currentBalance', fullContext.snapshot.currentBalance);
    if (includeIncomeExpenses) {
      addFact('snapshot.monthlyIncome', fullContext.snapshot.monthlyIncome);
      addFact('snapshot.monthlySpending', fullContext.snapshot.monthlySpending);
      addFact('snapshot.netSavings', fullContext.snapshot.netSavings);
      addFact('snapshot.savingsRate', fullContext.snapshot.savingsRate);
    }
  };

  switch (intent) {
    case 'top_category':
      includeSnapshot(true);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
        addFact('spending.topCategoryPercentage', fullContext.spending.topCategory.percentage);
        addFact('spending.topCategoryMomChange', fullContext.spending.topCategory.momChangePercentage);
        if (fullContext.spending.topCategory.isTie && fullContext.spending.topCategory.tiedCategories) {
          addFact('spending.topCategoryTied', fullContext.spending.topCategory.tiedCategories);
        }
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'lowest_category':
      includeSnapshot(true);
      if (fullContext.spending.lowestCategory) {
        addFact('spending.lowestCategory', fullContext.spending.lowestCategory.category);
        addFact('spending.lowestCategoryAmount', fullContext.spending.lowestCategory.amount);
        addFact('spending.lowestCategoryPercentage', fullContext.spending.lowestCategory.percentage);
        addFact('spending.lowestCategoryMomChange', fullContext.spending.lowestCategory.momChangePercentage);
        if (fullContext.spending.lowestCategory.isTie && fullContext.spending.lowestCategory.tiedCategories) {
          addFact('spending.lowestCategoryTied', fullContext.spending.lowestCategory.tiedCategories);
        }
      }
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'highest_merchant':
      includeSnapshot(true);
      if (fullContext.spending.merchants.highestMerchant) {
        addFact('spending.highestMerchant', fullContext.spending.merchants.highestMerchant.merchant);
        addFact('spending.highestMerchantAmount', fullContext.spending.merchants.highestMerchant.amount);
        addFact('spending.highestMerchantPercentage', fullContext.spending.merchants.highestMerchant.percentage);
        addFact('spending.highestMerchantCount', fullContext.spending.merchants.highestMerchant.count);
        if (fullContext.spending.merchants.highestMerchant.isTie && fullContext.spending.merchants.highestMerchant.tiedMerchants) {
          addFact('spending.highestMerchantTied', fullContext.spending.merchants.highestMerchant.tiedMerchants);
        }
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'lowest_merchant':
      includeSnapshot(true);
      if (fullContext.spending.merchants.lowestMerchant) {
        addFact('spending.lowestMerchant', fullContext.spending.merchants.lowestMerchant.merchant);
        addFact('spending.lowestMerchantAmount', fullContext.spending.merchants.lowestMerchant.amount);
        addFact('spending.lowestMerchantPercentage', fullContext.spending.merchants.lowestMerchant.percentage);
        addFact('spending.lowestMerchantCount', fullContext.spending.merchants.lowestMerchant.count);
        if (fullContext.spending.merchants.lowestMerchant.isTie && fullContext.spending.merchants.lowestMerchant.tiedMerchants) {
          addFact('spending.lowestMerchantTied', fullContext.spending.merchants.lowestMerchant.tiedMerchants);
        }
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'largest_expense':
      includeSnapshot(true);
      if (fullContext.spending.extrema.largestExpense) {
        addFact('spending.largestExpenseAmount', fullContext.spending.extrema.largestExpense.amount);
        addFact('spending.largestExpenseCategory', fullContext.spending.extrema.largestExpense.category);
        addFact('spending.largestExpenseDate', fullContext.spending.extrema.largestExpense.date);
        if (fullContext.spending.extrema.largestExpense.merchant) {
          addFact('spending.largestExpenseMerchant', fullContext.spending.extrema.largestExpense.merchant);
        }
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'smallest_expense':
      includeSnapshot(true);
      if (fullContext.spending.extrema.smallestExpense) {
        addFact('spending.smallestExpenseAmount', fullContext.spending.extrema.smallestExpense.amount);
        addFact('spending.smallestExpenseCategory', fullContext.spending.extrema.smallestExpense.category);
        addFact('spending.smallestExpenseDate', fullContext.spending.extrema.smallestExpense.date);
        if (fullContext.spending.extrema.smallestExpense.merchant) {
          addFact('spending.smallestExpenseMerchant', fullContext.spending.extrema.smallestExpense.merchant);
        }
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'zero_spending':
      includeSnapshot(false);
      addFact('spending.zeroSpendingCategories', fullContext.spending.zeroSpendingCategories);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'mom_comparison':
      includeSnapshot(true);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      addFact('spending.previousMonthSpending', fullContext.spending.comparison.previousSpending);
      addFact('spending.momDifference', fullContext.spending.comparison.difference);
      addFact('spending.momPercentageChange', fullContext.spending.comparison.percentageChange);
      addFact('spending.momDirection', fullContext.spending.comparison.direction);
      break;

    case 'income_total':
      includeSnapshot(true);
      addFact('snapshot.monthlyIncome', fullContext.snapshot.monthlyIncome);
      addFact('snapshot.netSavings', fullContext.snapshot.netSavings);
      addFact('snapshot.savingsRate', fullContext.snapshot.savingsRate);
      break;

    case 'spending_total':
      includeSnapshot(true);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
      }
      break;

    case 'month_end_balance':
      includeSnapshot(true);
      addFact('cashFlow.startingBalance', fullContext.cashFlow.startingBalance);
      addFact('cashFlow.forecastMonthEndBalance', fullContext.cashFlow.forecastMonthEndBalance);
      addFact('cashFlow.recommendedBuffer', fullContext.cashFlow.recommendedBuffer);
      addFact('cashFlow.shortfall', fullContext.cashFlow.shortfall);
      addFact('cashFlow.recommendedWeeklyReduction', fullContext.cashFlow.recommendedWeeklyReduction);
      break;

    case 'savings_goal_progress':
      includeSnapshot(false);
      addFact('snapshot.netSavings', fullContext.snapshot.netSavings);
      addFact('goals.totalGoals', fullContext.goals.totalGoals);
      fullContext.goals.items.forEach((g, idx) => {
        const p = `goals.goal${idx + 1}`;
        addFact(`${p}.title`, g.title);
        addFact(`${p}.targetAmount`, g.targetAmount);
        addFact(`${p}.currentAmount`, g.currentAmount);
        addFact(`${p}.progressPercentage`, g.progressPercentage);
        addFact(`${p}.remainingAmount`, g.remainingAmount);
        addFact(`${p}.deadline`, g.deadline);
        addFact(`${p}.requiredMonthlyContribution`, g.requiredMonthlyContribution);
      });
      break;

    case 'savings_plan':
      includeSnapshot(true);
      addFact('goals.totalGoals', fullContext.goals.totalGoals);
      if (fullContext.goals.items.length > 0) {
        const g1 = fullContext.goals.items[0];
        addFact('goals.primaryGoal.title', g1.title);
        addFact('goals.primaryGoal.targetAmount', g1.targetAmount);
        addFact('goals.primaryGoal.currentAmount', g1.currentAmount);
        addFact('goals.primaryGoal.progressPercentage', g1.progressPercentage);
        addFact('goals.primaryGoal.requiredMonthlyContribution', g1.requiredMonthlyContribution);
      }
      if (parsedPlan) {
        addFact('savingsPlan.parsedTargetAmount', parsedPlan.targetAmount);
        if (parsedPlan.monthsDuration !== undefined) {
          addFact('savingsPlan.parsedMonthsDuration', parsedPlan.monthsDuration);
        }
        addFact('savingsPlan.targetAmount', parsedPlan.targetAmount);
        addFact('savingsPlan.monthlyTarget', parsedPlan.monthlyTarget);
        addFact('savingsPlan.weeklyTarget', parsedPlan.weeklyTarget);
        addFact('savingsPlan.requiredMonthly', parsedPlan.requiredMonthly);
        addFact('savingsPlan.currentMonthlySurplus', parsedPlan.currentMonthlySurplus);
        addFact('savingsPlan.isFeasible', parsedPlan.isFeasible);
        addFact('savingsPlan.monthlyGap', parsedPlan.monthlyGap);
        addFact('savingsPlan.surplusDiff', parsedPlan.surplusDiff);
        addFact('savingsPlan.isRecurringMonthly', Boolean(parsedPlan.isRecurringMonthly));
      }
      if (fullContext.spending.discretionaryCategories && fullContext.spending.discretionaryCategories.length > 0) {
        addFact('spending.discretionaryCategories', fullContext.spending.discretionaryCategories);
      }
      if (fullContext.snapshot.profileMonthlyIncome !== undefined) {
        addFact('snapshot.profileMonthlyIncome', fullContext.snapshot.profileMonthlyIncome);
      }
      addFact('cashFlow.recommendedWeeklyReduction', fullContext.cashFlow.recommendedWeeklyReduction);
      break;

    case 'unusual_spending':
      includeSnapshot(true);
      addFact('spending.anomaliesCount', fullContext.spending.anomaliesCount);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
      }
      fullContext.spending.anomalies.slice(0, 3).forEach((a, idx) => {
        addFact(`spending.anomaly${idx + 1}.category`, a.category);
        addFact(`spending.anomaly${idx + 1}.amount`, a.amount);
      });
      break;

    case 'reduce_cash_outs':
      includeSnapshot(false);
      addFact('cashOut.totalAmount', fullContext.cashOut.totalAmount);
      addFact('cashOut.count', fullContext.cashOut.count);
      addFact('cashOut.shareOfSpending', fullContext.cashOut.shareOfSpending);
      addFact('cashOut.feeCost', fullContext.cashOut.feeCost);
      addFact('cashOut.feeRate', fullContext.cashOut.feeRate);
      break;

    case 'financial_health':
      includeSnapshot(true);
      addFact('health.score', fullContext.health.score);
      addFact('health.band', fullContext.health.band);
      addFact('health.savingConsistency', fullContext.health.savingConsistency);
      addFact('health.spendingControl', fullContext.health.spendingControl);
      addFact('health.cashFlowStability', fullContext.health.cashFlowStability);
      addFact('health.goalProgress', fullContext.health.goalProgress);
      break;

    case 'health_recommendations':
      includeSnapshot(true);
      addFact('health.score', fullContext.health.score);
      addFact('health.band', fullContext.health.band);
      addFact('health.savingConsistency', fullContext.health.savingConsistency);
      addFact('health.spendingControl', fullContext.health.spendingControl);
      addFact('health.cashFlowStability', fullContext.health.cashFlowStability);
      addFact('health.goalProgress', fullContext.health.goalProgress);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
        addFact('spending.topCategoryPercentage', fullContext.spending.topCategory.percentage);
      }
      if (fullContext.spending.essentialTotal !== undefined) {
        addFact('spending.essentialTotal', fullContext.spending.essentialTotal);
      }
      if (fullContext.spending.discretionaryTotal !== undefined) {
        addFact('spending.discretionaryTotal', fullContext.spending.discretionaryTotal);
      }
      if (fullContext.spending.discretionaryCategories) {
        addFact('spending.discretionaryCategories', fullContext.spending.discretionaryCategories);
      }
      addFact('snapshot.netCashFlow', fullContext.snapshot.netCashFlow);
      addFact('goals.totalGoals', fullContext.goals.totalGoals);
      break;

    case 'financial_projection': {
      includeSnapshot(true);
      addFact('dataWindow.currentMonth', fullContext.metadata.dataWindow.currentMonth);
      addFact('dataWindow.hasData', fullContext.metadata.dataWindow.hasData);
      addFact('dataWindow.totalTransactions', fullContext.metadata.dataWindow.totalTransactions);
      const histCount = fullContext.metadata.dataWindow.historicalMonthsCount ?? 1;
      addFact('dataWindow.historicalMonthsCount', histCount);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
      }
      const pMonths = 6;
      const inc = fullContext.snapshot.monthlyIncome || 0;
      const exp = fullContext.snapshot.monthlySpending || 0;
      const net = fullContext.snapshot.netSavings || (inc - exp);
      addFact('projection.periodMonths', pMonths);
      addFact('projection.sixMonthExpectedIncome', inc * pMonths);
      addFact('projection.sixMonthExpectedExpenses', exp * pMonths);
      addFact('projection.sixMonthProjectedCashFlow', net * pMonths);
      addFact('projection.hasSufficientHistory', histCount >= 3);
      break;
    }

    case 'budget_help':
      includeSnapshot(true);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
        addFact('spending.topCategoryPercentage', fullContext.spending.topCategory.percentage);
      }
      if (fullContext.spending.essentialTotal !== undefined) {
        addFact('spending.essentialTotal', fullContext.spending.essentialTotal);
      }
      if (fullContext.spending.essentialPercentage !== undefined) {
        addFact('spending.essentialPercentage', fullContext.spending.essentialPercentage);
      }
      if (fullContext.spending.discretionaryTotal !== undefined) {
        addFact('spending.discretionaryTotal', fullContext.spending.discretionaryTotal);
      }
      if (fullContext.spending.discretionaryPercentage !== undefined) {
        addFact('spending.discretionaryPercentage', fullContext.spending.discretionaryPercentage);
      }
      if (fullContext.spending.discretionaryCategories) {
        addFact('spending.discretionaryCategories', fullContext.spending.discretionaryCategories);
      }
      if (fullContext.spending.essentialCategories) {
        addFact('spending.essentialCategories', fullContext.spending.essentialCategories);
      }
      addFact('spending.categoryTotals', fullContext.spending.categoryTotals);
      addFact('snapshot.netCashFlow', fullContext.snapshot.netCashFlow);
      break;

    case 'transaction_lookup':
      addFact('snapshot.currentBalance', fullContext.snapshot.currentBalance);
      fullContext.recentTransactions.slice(0, 5).forEach((t, idx) => {
        addFact(`recentTx${idx + 1}.type`, t.type);
        addFact(`recentTx${idx + 1}.amount`, t.amount);
        addFact(`recentTx${idx + 1}.category`, t.category);
        addFact(`recentTx${idx + 1}.date`, t.date);
        if (t.description) {
          addFact(`recentTx${idx + 1}.description`, t.description);
        }
      });
      break;

    case 'general_education':
      addFact('snapshot.currentBalance', fullContext.snapshot.currentBalance);
      addFact('snapshot.savingsRate', fullContext.snapshot.savingsRate);
      break;

    case 'out_of_scope':
      // Empty financial facts to prevent leakage on non-financial queries
      break;

    default:
      includeSnapshot(true);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
      }
      break;
  }

  return {
    intent,
    dataWindow: {
      currentMonth: fullContext.metadata.dataWindow.currentMonth,
      today: fullContext.metadata.today,
      hasData: fullContext.metadata.dataWindow.hasData,
    },
    facts,
    factKeys,
    disclaimer:
      'All figures are precomputed deterministically from the user’s authentic ledger. Do not derive or calculate any new numbers.',
  };
}
