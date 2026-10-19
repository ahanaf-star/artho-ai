import { CoachContext, FactItem } from './coachContextBuilder';

export type CoachIntent =
  | 'financial_status'
  | 'spending_total'
  | 'spending_vs_income'
  | 'top_category'
  | 'lowest_category'
  | 'category_spending'
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
  matchedCategory?: string;
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
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\u09DF/g, '\u09AF\u09BC') // Normalize precomposed য় to য+nukta
    .replace(/\u09DC/g, '\u09A1\u09BC') // Normalize precomposed ড় to ড+nukta
    .replace(/\u09DD/g, '\u09A2\u09BC') // Normalize precomposed ঢ় to ঢ+nukta
    .replace(/[৳$,?!.।]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Robust keyword matcher that normalizes both query and pattern text
 */
export function matchesKeyword(normText: string, pattern: string): boolean {
  return normText.includes(normalizeText(pattern));
}

function parseMultiplierAmount(numStr: string, multiplierStr?: string): number {
  let val = parseFloat(numStr.replace(/,/g, ''));
  if (isNaN(val)) return 0;
  if (multiplierStr) {
    const m = multiplierStr.toLowerCase().trim();
    if (m === 'lac' || m === 'lakh' || m === 'লাখ' || m === 'লক্ষ') {
      val *= 100000;
    } else if (m === 'crore' || m === 'cr' || m === 'কোটি') {
      val *= 10000000;
    } else if (m === 'k' || m === 'thousand' || m === 'হাজার') {
      val *= 1000;
    }
  }
  return Math.round(val);
}

/**
 * Extracts target amount and duration or monthly recurring target from queries like:
 * "save ৳30,000 in 6 months", "save 50000 in 10 months", "৬ মাসে ৩০,০০০ টাকা সঞ্চয়",
 * "How can I save 6000 tk per month?", "আমি প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব?"
 */
export function parseSavingsTarget(
  query: string,
  netSavingsOrCtx: number | CoachContext = 0
): ParsedSavingsPlan | undefined {
  const currentNetSavings =
    typeof netSavingsOrCtx === 'number'
      ? netSavingsOrCtx
      : (netSavingsOrCtx as any)?.snapshot?.netSavings ?? 0;

  // Avoid misclassifying simulations or projections as savings plans
  if (/(?:simulate|simulation|scenario|forecast|trajectory|risk|resilience|পূর্বাভাস|কত\s*(?:টাকা)?\s*জমবে|কত\s*(?:টাকা)?\s*সঞ্চ[য়য়]|প্রভাব\s*পড়বে|প্রভাব\s*পড়বে|বাফার)/i.test(query)) {
    return undefined;
  }

  // Avoid misclassifying income analysis or income inquiries as savings plans
  if (
    /(?:analyze|review|check|breakdown|status|tell\s+me|show|what\s+is|how\s+is|summary\s+of)\s+(?:my\s+)?(?:monthly\s+|total\s+|recorded\s+)?(?:income|earnings|inflows?)\b/i.test(query) ||
    /(?:my\s+)?(?:monthly\s+|total\s+|recorded\s+)?(?:income|earnings|inflow)\s+(?:analysis|breakdown|status|review|report)\b/i.test(query) ||
    /(?:আয়|আয়|উপার্জন)\s*(?:পর্যালোচনা|বিশ্লেষণ|কত|হিসাব|রিভিউ)/i.test(query)
  ) {
    return undefined;
  }

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

  // Pattern 1: Fixed duration in English: "save [amount] in [duration] [months/years]"
  const enMatch1 = normalizedDigits.match(
    /(?:save|target|reach|buy|accumulate|deposit|put aside|set aside).*?(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(lac|lakh|crore|cr|k|thousand)?\s*(?:bdt|tk|taka|৳|\$)?\s*(?:in|within|over|for)?\s*([0-9]+)\s*(months?|mas|years?|yrs?|yr)/i
  );
  if (enMatch1) {
    const targetAmount = parseMultiplierAmount(enMatch1[1], enMatch1[2]);
    const isYear = /year|yr/i.test(enMatch1[4]);
    const monthsDuration = parseInt(enMatch1[3], 10) * (isYear ? 12 : 1);
    if (targetAmount >= 100 && monthsDuration > 0) {
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

  // Pattern 1b: "in [duration] [months/years] save [amount]"
  const enMatch2 = normalizedDigits.match(
    /(?:in|within|over|for)?\s*([0-9]+)\s*(months?|mas|years?|yrs?|yr).*?(?:save|target|reach|buy|accumulate|deposit|put aside|set aside).*?(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(lac|lakh|crore|cr|k|thousand)?/i
  );
  if (enMatch2) {
    const isYear = /year|yr/i.test(enMatch2[2]);
    const monthsDuration = parseInt(enMatch2[1], 10) * (isYear ? 12 : 1);
    const targetAmount = parseMultiplierAmount(enMatch2[3], enMatch2[4]);
    if (targetAmount >= 100 && monthsDuration > 0) {
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

  // Pattern 2: Fixed duration in Bengali: "[months/years] মাসে/বছরে [amount] টাকা"
  const bnMatch1 = normalizedDigits.match(/([0-9]+)\s*(মাসে|মাস|বছরে|বছর)\s*([0-9,]+)\s*(লাখ|লক্ষ|কোটি|হাজার)?\s*(?:টাকা)?/);
  if (bnMatch1) {
    const isYear = /বছর/.test(bnMatch1[2]);
    const monthsDuration = parseInt(bnMatch1[1], 10) * (isYear ? 12 : 1);
    const targetAmount = parseMultiplierAmount(bnMatch1[3], bnMatch1[4]);
    if (targetAmount >= 100 && monthsDuration > 0) {
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

  const bnMatch2 = normalizedDigits.match(/([0-9,]+)\s*(লাখ|লক্ষ|কোটি|হাজার)?\s*(?:টাকা)?\s*([0-9]+)\s*(মাসে|মাস|বছরে|বছর)/);
  if (bnMatch2) {
    const targetAmount = parseMultiplierAmount(bnMatch2[1], bnMatch2[2]);
    const isYear = /বছর/.test(bnMatch2[4]);
    const monthsDuration = parseInt(bnMatch2[3], 10) * (isYear ? 12 : 1);
    if (targetAmount >= 100 && monthsDuration > 0) {
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

  // Pattern 3: English monthly recurring savings target (e.g. "save 6000 tk per month", "save ৳6,000 monthly", "save 1 lac per month")
  const hasSavingsWordEn = /(?:save|reach|target|stash|accumulate|deposit|put aside|set aside)/i.test(normalizedDigits);
  const isMonthlyEn = hasSavingsWordEn && /(?:per|each|every|a)\s*month|monthly/i.test(normalizedDigits);
  if (isMonthlyEn) {
    const m =
      normalizedDigits.match(
        /(?:save|reach|target|stash|accumulate|deposit|put aside|set aside).*?(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(lac|lakh|crore|cr|k|thousand)?\s*(?!\s*(?:%|months?|mas))\s*(?:bdt|tk|taka|৳|\$)?/i
      ) ||
      normalizedDigits.match(
        /(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(lac|lakh|crore|cr|k|thousand)?\s*(?!\s*(?:%|months?|mas)).*?(?:(?:per|each|every|a)\s*month|monthly)/i
      );
    if (m) {
      const targetAmount = parseMultiplierAmount(m[1], m[2]);
      if (targetAmount >= 100) {
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

  // Pattern 4: Bengali monthly recurring savings target (e.g. "প্রতি মাসে ৬০০০ টাকা কীভাবে সঞ্চয় করব", "মাসে ৬০০০ টাকা সঞ্চয়", "মাসে ১ লাখ টাকা সঞ্চয়")
  const hasSavingsWordBn = /(?:সঞ্চয়|সঞ্চয়|সেভ|জমা|বাঁচাব|বাঁচাবো)/.test(normalizedDigits);
  const isMonthlyBn = hasSavingsWordBn && /(?:প্রতি\s*মাসে|মাসে|মাসিক)/.test(normalizedDigits);
  if (isMonthlyBn) {
    const m =
      normalizedDigits.match(/(?:প্রতি\s*মাসে|মাসে|মাসিক).*?([0-9,]+)\s*(লাখ|লক্ষ|কোটি|হাজার)?\s*(?:টাকা)?/) ||
      normalizedDigits.match(/([0-9,]+)\s*(লাখ|লক্ষ|কোটি|হাজার)?\s*(?:টাকা)?.*?(?:প্রতি\s*মাসে|মাসে|মাসিক)/);
    if (m) {
      const targetAmount = parseMultiplierAmount(m[1], m[2]);
      if (targetAmount >= 100) {
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

  // Pattern 5: Standalone target (e.g. "Save ৳50,000", "Save 50000", "Save 1 lac")
  const standaloneMatch = normalizedDigits.match(/^(?:please\s+)?(?:how\s+to\s+)?save\s*(?:bdt|tk|taka|৳|\$)?\s*([0-9,]+)\s*(lac|lakh|crore|cr|k|thousand)?(?!\s*(?:%|months?|mas))(?:\s*(?:bdt|tk|taka|৳|\$))?\.?$/i);
  if (standaloneMatch) {
    const targetAmount = parseMultiplierAmount(standaloneMatch[1], standaloneMatch[2]);
    if (targetAmount >= 100) {
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
    if (matchesKeyword(norm, p)) {
      return {
        intent: 'out_of_scope',
        confidence: 0.95,
        matchedKeywords: [p],
      };
    }
  }

  // 0b. Explicit Income Analysis or Inquiry check (prioritize before savings plan checks)
  const isIncomeInquiry =
    /(?:analyze|review|check|breakdown|status|tell\s+me|show|what\s+is|how\s+is)\s+(?:my\s+)?(?:monthly\s+|total\s+|recorded\s+)?(?:income|earnings|inflows?)\b/i.test(norm) ||
    /(?:my\s+)?(?:monthly\s+|total\s+|recorded\s+)?(?:income|earnings|inflow)\s+(?:analysis|breakdown|status|review|report)\b/i.test(norm) ||
    /(?:আয়|আয়|উপার্জন)\s*(?:পর্যালোচনা|বিশ্লেষণ|কত|হিসাব|রিভিউ)/i.test(norm);
  if (isIncomeInquiry) {
    return {
      intent: 'income_total',
      confidence: 0.96,
      matchedKeywords: ['income_inquiry_explicit'],
    };
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

  // 0c. Spending vs. Income Deficit Check (e.g. "Am I spending more than I earn?", "Do I spend more than my income?")
  const spendingVsIncomePatterns = [
    'spending more than i earn',
    'spending more than my income',
    'spend more than i earn',
    'spend more than my income',
    'spend more than earn',
    'expenses higher than my income',
    'expenses exceed income',
    'spending exceeds income',
    'outflow exceeds inflow',
    'living beyond my means',
    'living beyond means',
    'deficit this month',
    'am i in a deficit',
    'am i running a deficit',
    'do i have a deficit',
    'do i spend more than i earn',
    'do i spend more than my income',
    'am i spending more than i earn',
    'am i spending more than my income',
    'spending more than earning',
    'spends more than earns',
    'আয়ের চেয়ে বেশি খরচ',
    'আয়ের চেয়ে বেশি খরচ',
    'আয়ের চেয়ে ব্যয় বেশি',
    'আয়ের চেয়ে ব্যয় বেশি',
    'ব্যয় কি আয়ের চেয়ে বেশি',
    'ব্যয় কি আয়ের চেয়ে বেশি',
    'খরচ কি আয়ের চেয়ে বেশি',
    'খরচ কি আয়ের চেয়ে বেশি',
    'আয়ের তুলনায় খরচ বেশি',
    'আয়ের তুলনায় খরচ বেশি',
    'ঘাটতি হচ্ছে কি',
    'ঘাটতিতে আছি কি',
    'আয়ের বেশি খরচ',
    'আয়ের বেশি খরচ',
  ];
  for (const p of spendingVsIncomePatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'spending_vs_income', confidence: 0.96, matchedKeywords: [p] };
    }
  }

  const isSmartSpendingVsIncome =
    (norm.includes('more than') || norm.includes('exceed') || norm.includes('higher than') || norm.includes('চেয়ে বেশি') || norm.includes('চেয়ে বেশি')) &&
    (norm.includes('income') || norm.includes('earn') || norm.includes('আয়') || norm.includes('আয়')) &&
    (norm.includes('spend') || norm.includes('expense') || norm.includes('outflow') || norm.includes('খরচ') || norm.includes('ব্যয়') || norm.includes('ব্যয়'));
  if (isSmartSpendingVsIncome) {
    return { intent: 'spending_vs_income', confidence: 0.94, matchedKeywords: ['spending_vs_income_smart'] };
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
    'এজেন্ট ফি',
    'এজেন্ট ফিতে',
  ];
  for (const p of cashOutPatterns) {
    if (matchesKeyword(norm, p)) {
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
    'simulate',
    'simulation',
    'scenario',
    'scenarios',
    'pessimistic',
    'optimistic',
    'financial activity',
    'project three months',
    'project 3 months',
    'project next month',
    'project my finances for next month',
    'project my finances',
    'project my finances for',
    'based on current trends',
    'next month s financial position',
    'next month financial position',
    'next month s savings',
    'next month\'s savings',
    'estimate next month',
    'estimate next month\'s savings',
    'next month savings',
    'accumulate in 6 months',
    'accumulate in',
    'money will i accumulate',
    'accumulate',
    'can my balance absorb',
    'absorb it',
    'balance absorb',
    'unexpected ৳20,000',
    'unexpected 20,000',
    'project my finances for 3 months',
    'for 3 months with incomplete',
    'incomplete transaction history',
    'income-loss resilience',
    'loss resilience',
    'resilience',
    'financial trajectory',
    'trajectory',
    'আর্থিক পূর্বাভাস',
    'ভবিষ্যতের পূর্বাভাস',
    'ভবিষ্যত আর্থিক অবস্থান',
    'ভবিষ্যৎ পূর্বাভাস',
    'ভবিষ্যত পূর্বাভাস',
    'আগামী ৬ মাস',
    'আগামী ছয় মাস',
    'পরবর্তী ৬ মাস',
    'পরবর্তী ছয় মাস',
    'কত জমবে',
    'কত সঞ্চয় হতে পারে',
    'কত সঞ্চয় হতে পারে',
    'খরচ বাড়লে',
    'খরচ বাড়লে',
    'কী প্রভাব পড়বে',
    'কী প্রভাব পড়বে',
    'প্রভাব পড়বে',
    'প্রভাব পড়বে',
    'ব্যালেন্স তা সামলাতে পারবে',
    'অপ্রত্যাশিত খরচ আসলে',
    'পূর্বাভাস',
    'পূর্বাভাস বিশ্লেষণ',
    'পূর্বাভাস দাও',
    'পূর্বাভাস কেমন হবে',
    'পূর্বাভাসের জন্য',
    'বর্তমান ধারা অনুযায়ী',
    'বর্তমান ধারা অনুযায়ী',
    'আগামী মাসে আমার আর্থিক অবস্থান',
    'আগামী মাসে আর্থিক',
    'আগামী ৬ মাসে আমার কত টাকা সঞ্চয়',
    'আগামী ৬ মাসে কত সঞ্চয়',
    'আগামী ৬ মাসে',
    'আগামী 6 মাসে',
    'কত টাকা সঞ্চয় হতে পারে',
    'কত টাকা সঞ্চয় হতে পারে',
  ];
  for (const p of projectionPatterns) {
    if (matchesKeyword(norm, p)) {
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
    'running out of money',
    'run out of money',
    'risk of running out',
    'safe personal spending limit',
    'safe personal spending',
    'safe personal',
    'safe spending for the rest',
    'safe spending limit',
    'safe spending',
    'spending limit for the rest of this month',
    'spending limit for the rest',
    'spending limit for the remaining',
    'weekly spending limit for the remaining',
    'weekly spending limit',
    'rest of the month',
    'rest of this month',
    'expenses affecting cash flow',
    'affecting cash flow',
    'why money is not left',
    'no money left',
    'ক্যাশ ফ্লো',
    'মাস শেষ',
    'মাস শেষে',
    'টাকা শেষ',
    'টাকা শেষ হয়ে যায়',
    'টাকা শেষ হয়ে যায়',
    'টাকা শেষ হয়ে যাওয়ার ঝুঁকি',
    'টাকা শেষ হয়ে যাওয়ার ঝুঁকি',
    'টাকা শেষ হওয়ার ঝুঁকি',
    'টাকা শেষ হওয়ার ঝুঁকি',
    'কত টাকা থাকতে পারে',
    'টানাপোড়েন',
    'টানাটানি',
    'টানাটানি শুরু',
    'সম্ভাব্য ব্যালেন্স',
    'ব্যালেন্স কত দাঁড়াবে',
    'ব্যালেন্স কত দাঁড়াবে',
    'সেফটি বাফার',
    'নিরাপত্তা বাফার',
    'বাফার রাখা দরকার',
    'ঘাটতি',
    'ঘাটতি থাকা',
    'ঘাটতি হওয়ার ঝুঁকি',
    'ঘাটতি হওয়ার ঝুঁকি',
    'বাকি দিনগুলোতে খরচের নিরাপদ সীমা',
    'বাকি দিনগুলোর জন্য আমার সাপ্তাহিক খরচের সীমা',
    'বাকি দিনগুলোর জন্য খরচের সীমা',
    'বাকি দিনগুলোতে খরচের',
    'খরচের নিরাপদ সীমা',
    'সাপ্তাহিক খরচের সীমা',
    'নিরাপদ সীমা',
    'how much money do i have left',
    'how much money is left',
    'how much money left',
    'how much do i have left',
    'how much is left',
    'money do i have left',
    'money i have left',
    'how much left',
    'what is left',
    'money left',
    'টাকা কত বাকি আছে',
    'কত টাকা বাকি আছে',
    'কত টাকা অবশিষ্ট আছে',
    'কত অবশিষ্ট আছে',
    'অবশিষ্ট টাকা',
    'আমার কত টাকা আছে',
    'কত টাকা আছে',
    'কত টাকা জমা আছে',
  ];
  if (!norm.includes('checklist')) {
    for (const p of monthEndPatterns) {
      if (matchesKeyword(norm, p)) {
        return { intent: 'month_end_balance', confidence: 0.9, matchedKeywords: [p] };
      }
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
    if (matchesKeyword(norm, p)) {
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
    'merchants receive the most',
    'merchants receive most',
    'which merchants receive',
    'top merchants',
    'highest merchants',
    'top vendor',
    'highest vendor',
    'সবচেয়ে বেশি মার্চেন্ট',
    'কোন মার্চেন্টে বেশি',
    'শীর্ষ মার্চেন্ট',
    'সর্বোচ্চ মার্চেন্ট',
    'কোন মার্চেন্টে সবচেয়ে বেশি',
  ];
  for (const p of highestMerchPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'highest_merchant', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 3c. Largest Individual Expense Transaction
  const largestExpensePatterns = [
    'five largest',
    'largest expense transactions',
    'largest expense transaction',
    'largest expense',
    'largest expenses',
    'biggest expense transactions',
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
    if (matchesKeyword(norm, p)) {
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
    if (matchesKeyword(norm, p)) {
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
    'spend least',
    'lowest spending',
    'lowest spend',
    'lowest expense',
    'least expense',
    'smallest category',
    'minimum spending category',
    'minimum spend',
    'which category i spend lowest',
    'which category did i spend the least',
    'which category did i spend least',
    'which category i spend least',
    'which category lowest',
    'which category least',
    'spend lowest money',
    'spend least money',
    'spend lowest',
    'lowest money',
    'least money',
    'lowest cost category',
    'least expensive category',
    'where do i spend lowest',
    'where i spend lowest',
    'where i spend least',
    'সর্বনিম্ন খরচ',
    'সবচেয়ে কম খরচ',
    'সবচেয়ে কম ব্যয়',
    'সবচেয়ে কম খরচ',
    'সবচেয়ে কম ব্যয়',
    'কোন খাতে সবচেয়ে কম',
    'কোন খাতে সবচেয়ে কম',
    'কোন খাতে কম টাকা',
    'সবচেয়ে কম টাকা',
    'সবচেয়ে কম টাকা',
    'কম টাকা খরচ',
    'কোন খাতে কম',
    'কম খরচ',
    'ন্যূনতম খরচ',
    'সর্বনিম্ন ব্যয়ের খাত',
    'সর্বনিম্ন খরচের খাত',
    'সবচেয়ে কম খরচের খাত',
    'সবচেয়ে কম খরচের খাত',
  ];
  for (const p of lowestCatPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'lowest_category', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  const isLowestCategoryQuery =
    !/(?:merchant|মার্চেন্ট|vendor|shop\s+at)/i.test(norm) &&
    (/(?:category|খাত|ক্যাটাগরি).*?(?:lowest|least|minimum|smallest|সবচেয়ে\s*কম|সবচেয়ে\s*কম|সর্বনিম্ন)/i.test(norm) ||
      /(?:lowest|least|minimum|smallest|সবচেয়ে\s*কম|সবচেয়ে\s*কম|সর্বনিম্ন).*?(?:category|খাত|ক্যাটাগরি)/i.test(norm) ||
      (/(?:spend|spent|spending|expense|outflow|money|cost|খরচ|ব্যয়|ব্যয়)/i.test(norm) &&
        /(?:lowest|least|minimum|smallest|সবচেয়ে\s*কম|সবচেয়ে\s*কম|সর্বনিম্ন)/i.test(norm)));
  if (isLowestCategoryQuery) {
    return { intent: 'lowest_category', confidence: 0.94, matchedKeywords: ['lowest_category_smart_match'] };
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
    'spend most',
    'biggest outflow',
    'highest category spending',
    'most expensive category',
    'which category i spend highest',
    'which category i spend most',
    'which category did i spend the most',
    'which category did i spend most',
    'which category highest',
    'which category most',
    'spend highest money',
    'spend most money',
    'highest money',
    'most money',
    'highest cost category',
    'where do i spend highest',
    'where i spend highest',
    'where i spend most',
    'শীর্ষ খাত',
    'সবচেয়ে বেশি খরচ',
    'সবচেয়ে বেশি খরচ',
    'সবচেয়ে বেশি ব্যয়',
    'সবচেয়ে বেশি ব্যয়',
    'কোন খাতে সবচেয়ে বেশি',
    'কোন খাতে সবচেয়ে বেশি',
    'কোন খাতে বেশি টাকা',
    'সবচেয়ে বেশি টাকা',
    'সবচেয়ে বেশি টাকা',
    'বেশি টাকা খরচ',
    'কোন খাতে বেশি',
    'কোথায় বেশি খরচ',
    'সর্বোচ্চ খরচ',
    'সর্বোচ্চ খরচের খাত',
    'শীর্ষ খরচের খাত',
  ];
  for (const p of topCatPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'top_category', confidence: 0.93, matchedKeywords: [p] };
    }
  }

  const isTopCategoryQuery =
    !/(?:merchant|মার্চেন্ট|vendor|shop\s+at)/i.test(norm) &&
    (/(?:category|খাত|ক্যাটাগরি).*?(?:highest|most|top|maximum|biggest|largest|সবচেয়ে\s*বেশি|সবচেয়ে\s*বেশি|সর্বোচ্চ|শীর্ষ)/i.test(norm) ||
      /(?:highest|most|top|maximum|biggest|largest|সবচেয়ে\s*বেশি|সবচেয়ে\s*বেশি|সর্বোচ্চ|শীর্ষ).*?(?:category|খাত|ক্যাটাগরি)/i.test(norm) ||
      (/(?:spend|spent|spending|expense|outflow|money|cost|খরচ|ব্যয়|ব্যয়)/i.test(norm) &&
        /(?:highest|most|top|maximum|biggest|largest|সবচেয়ে\s*বেশি|সবচেয়ে\s*বেশি|সর্বোচ্চ|শীর্ষ)/i.test(norm)));
  if (isTopCategoryQuery) {
    return { intent: 'top_category', confidence: 0.93, matchedKeywords: ['top_category_smart_match'] };
  }

  // 3g. Specific Category Spending Inquiry (e.g. "How much did I spend on Health?", "What did I spend on Food?", "স্বাস্থ্য খাতে খরচ কত?")
  const categoryMapForInquiry: Record<string, string[]> = {
    'Health': ['health', 'healthcare', 'medical', 'medicine', 'medicines', 'doctor', 'hospital', 'clinic', 'pharma', 'pharmacy', 'চিকিৎসা', 'স্বাস্থ্য', 'ডাক্তার', 'ওষুধ', 'ঔষধ'],
    'Food & Groceries': ['food & groceries', 'groceries', 'grocery', 'food', 'dining', 'dine', 'restaurant', 'bazar', 'bazaar', 'shawarma', 'cafe', 'খাবার', 'বাজার', 'গ্রোসারি', 'রেস্টুরেন্ট'],
    'Shopping & Gadgets': ['shopping & gadgets', 'shopping', 'gadgets', 'gadget', 'clothes', 'clothing', 'apparel', 'electronics', 'দারাজ', 'শপিং', 'কেনাকাটা', 'গ্যাজেট'],
    'Utility & Fixed Costs': ['utility & fixed costs', 'utilities', 'utility', 'bills', 'bill', 'electric', 'electricity', 'current bill', 'gas', 'water', 'wasa', 'desco', 'dpdc', 'internet', 'wifi', 'broadband', 'বিদ্যুৎ', 'গ্যাস', 'পানি', 'ইউটিলিটি', 'বিল', 'ওয়াইফাই'],
    'Transportation': ['transportation', 'transport', 'commute', 'uber', 'pathao', 'cng', 'bus', 'metro', 'fare', 'fuel', 'petrol', 'octane', 'ভাড়া', 'ভাড়া', 'যাতায়াত', 'যাতায়াত', 'পরিবহন'],
    'Cash-out & Bank Fees': ['cash-out & bank fees', 'cash out', 'cash-out', 'bank fees', 'bank fee', 'atm fee', 'tariff', 'fee leak', 'bkash fee', 'nagad fee', 'ক্যাশ আউট', 'ক্যাশআউট', 'ব্যাংক ফি', 'এজেন্ট ফি'],
    'Entertainment & Others': ['entertainment & others', 'entertainment', 'movies', 'movie', 'leisure', 'games', 'outing', 'বিনোদন', 'অন্যান্য'],
    'Education': ['education', 'tuition', 'school', 'college', 'university', 'books', 'শিক্ষা', 'টিউশন', 'পড়াশোনা', 'লেখাপড়া'],
  };

  const isAskingCategoryAmount =
    !isLowestCategoryQuery &&
    !isTopCategoryQuery &&
    !/(?:anomaly|unusual|higher\s+than\s+usual|spike|surge|অস্বাভাবিক|অপ্রত্যাশিত)/i.test(norm) &&
    (/(?:how\s+much|what|show|tell\s+me|check|breakdown).*?(?:spend|spent|spending|expense|cost|outflow|কত\s*খরচ|কত\s*টাকা|খরচের\s*পরিমাণ)/i.test(norm) ||
      /(?:spend|spent|spending|expense|cost|outflow|খরচ|ব্যয়|ব্যয়).*?(?:on|in|for|বাবদ|খাতে)/i.test(norm) ||
      /(?:spending|expense|cost|outflow|খরচ|ব্যয়|ব্যয়)\s*(?:on|in|for|বাবদ|খাতে)/i.test(norm) ||
      /(?:health|food|groceries|shopping|gadgets|transportation|utility|utilities|education)\s*(?:spending|expense|cost|outflow|খরচ)/i.test(norm));

  if (isAskingCategoryAmount) {
    for (const [catName, keywords] of Object.entries(categoryMapForInquiry)) {
      for (const kw of keywords) {
        if (norm.includes(kw)) {
          return {
            intent: 'category_spending',
            confidence: 0.95,
            matchedCategory: catName,
            matchedKeywords: [kw, 'category_inquiry'],
          };
        }
      }
    }
  }

  // 3h. Zero Spending Categories
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
    if (matchesKeyword(norm, p)) {
      return { intent: 'zero_spending', confidence: 0.92, matchedKeywords: [p] };
    }
  }

  // 3h. Month-over-Month Comparison
  const momComparisonPatterns = [
    'compare this month with last month',
    'this month with last month',
    'compare this month',
    'compare with last month',
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
    if (matchesKeyword(norm, p)) {
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
    'analyze my income',
    'analyze income',
    'income analysis',
    'review my income',
    'review income',
    'check my income',
    'check income',
    'what is my income',
    'what\'s my income',
    'what s my income',
    'how is my income',
    'income status',
    'income breakdown',
    'expected income',
    'baseline income',
    'inflow baseline',
    'monthly inflow',
    'monthly inflow baseline',
    'expected monthly income',
    'tell me about my income',
    'show my income',
    'income overview',
    'earnings overview',
    'income vs baseline',
    'baseline vs recorded',
    'মোট আয়',
    'মোট আয়',
    'এ মাসের আয়',
    'এ মাসের আয়',
    'কত টাকা আয়',
    'কত টাকা আয়',
    'আমার আয় কত',
    'আমার আয় কত',
    'উপার্জন কত',
    'আয় বিশ্লেষণ',
    'আয় বিশ্লেষণ',
    'আমার আয় বিশ্লেষণ',
    'আমার আয় বিশ্লেষণ',
    'আয়ের হিসাব',
    'আয়ের হিসাব',
    'মাসিক আয় কত',
    'মাসিক আয় কত',
    'প্রত্যাশিত আয়',
    'প্রত্যাশিত আয়',
    'ইনফ্লো বেসলাইন',
    'আয়ের বিবরণ',
    'আয়ের বিবরণ',
  ];
  const isBudgetAllocation =
    norm.includes('allocate') ||
    norm.includes('allocation') ||
    norm.includes('across categories') ||
    norm.includes('distribution') ||
    norm.includes('distribute') ||
    norm.includes('বণ্টন') ||
    norm.includes('বিভিন্ন খাতে');
  if (!isBudgetAllocation) {
    for (const p of incomeTotalPatterns) {
      if (matchesKeyword(norm, p)) {
        return { intent: 'income_total', confidence: 0.92, matchedKeywords: [p] };
      }
    }
  }

  // 4. Unusual Spending & Anomalies (skip if query asks to "plan for" or "prepare for")
  const isPlanningForUnexpected =
    norm.includes('plan for') ||
    norm.includes('prepare for') ||
    norm.includes('absorb') ||
    norm.includes('can my balance absorb') ||
    norm.includes('বাজেট') ||
    norm.includes('পরিকল্পনা') ||
    norm.includes('প্রস্তুত') ||
    norm.includes('সামলানোর') ||
    norm.includes('সাজাব') ||
    norm.includes('ব্যালেন্স তা সামলাতে');
  if (!isPlanningForUnexpected) {
    const anomalyPatterns = [
      'unusual',
      'anomaly',
      'surge',
      'unexpected expense',
      'higher than usual',
      'food surge',
      'spike',
      'requiring attention',
      'categories requiring attention',
      'needs attention',
      'unusual categories',
      'অস্বাভাবিক',
      'হঠাৎ বৃদ্ধি',
      'অপ্রত্যাশিত',
      'সার্জ',
      'বেশি লেগেছে',
    ];
    for (const p of anomalyPatterns) {
      if (matchesKeyword(norm, p)) {
        return { intent: 'unusual_spending', confidence: 0.88, matchedKeywords: [p] };
      }
    }
  }

  // 4b. Emergency Fund Planning & Future Goal Prioritization
  const isEmergencyFundPlanning =
    (norm.includes('emergency fund') || norm.includes('জরুরি তহবিল') || norm.includes('জরুরী তহবিল') || norm.includes('emergency reserve')) &&
    (norm.includes('build') || norm.includes('create') || norm.includes('how') || norm.includes('start') || norm.includes('should i save') || norm.includes('কীভাবে') || norm.includes('গড়ব') || norm.includes('গড়বো') || norm.includes('তৈরি') || norm.includes('কত টাকা'));
  if (isEmergencyFundPlanning) {
    return { intent: 'savings_plan', confidence: 0.95, matchedKeywords: ['emergency_fund_plan'] };
  }

  const isNextGoalPlanning =
    norm.includes('next financial goal') ||
    norm.includes('next goal') ||
    norm.includes('পরবর্তী আর্থিক লক্ষ্য') ||
    norm.includes('পরবর্তী লক্ষ্য') ||
    norm.includes('next year') ||
    norm.includes('আগামী বছর') ||
    norm.includes('financial stability') ||
    norm.includes('আর্থিক স্থিতিশীলতা') ||
    norm.includes('step-by-step') ||
    norm.includes('ধাপে ধাপে') ||
    norm.includes('how long will it take to reach') ||
    norm.includes('কত সময় লাগবে') ||
    norm.includes('কত সময় লাগবে');
  if (isNextGoalPlanning) {
    return { intent: 'savings_plan', confidence: 0.94, matchedKeywords: ['next_goal_planning'] };
  }

  // 5. Savings Goals Progress & On-Track Status
  const goalPatterns = [
    'what are my current savings goals',
    'what are my savings goals',
    'current savings goals',
    'my savings goals',
    'my current goals',
    'existing savings goals',
    'how much more do i need to save',
    'how much more to save',
    'how much more do i have to save',
    'am i on track to reach my savings goal',
    'am i on track for my goal',
    'can i afford my savings goal',
    'can i afford my goal',
    'reach my savings goal',
    'reach my goal',
    'savings progress',
    'progress on my goals',
    'savings goal',
    'savings goals',
    'goal',
    'on track',
    'emergency fund',
    'target amount',
    'progress on goal',
    'goal deadline',
    'save for a laptop',
    'laptop',
    'within a deadline',
    'multiple savings goals',
    'prioritize multiple',
    'emergency reserve',
    'emergency reserves',
    'prioritize financial goals',
    'prioritize emergency',
    'আমার সঞ্চয় লক্ষ্য',
    'আমার সঞ্চয় লক্ষ্য',
    'বর্তমান সঞ্চয় লক্ষ্য',
    'বর্তমান সঞ্চয় লক্ষ্য',
    'আর কত সঞ্চয় করতে হবে',
    'আর কত সঞ্চয় করতে হবে',
    'লক্ষ্য পূরণ করতে পারব কি',
    'লক্ষ্য',
    'টার্গেট',
    'ইমার্জেন্সি ফান্ড',
    'জরুরি তহবিল',
    'তহবিল জমার',
    'অগ্রগতি কেমন',
    'জমার অগ্রগতি',
    'লক্ষ্যের অগ্রগতি',
    'ল্যাপটপ',
    'ল্যাপটপ কেনার',
    'ল্যাপটপ কিনতে',
    'লক্ষ্যমাত্রা',
    'অন ট্র্যাক',
  ];
  for (const p of goalPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'savings_goal_progress', confidence: 0.9, matchedKeywords: [p] };
    }
  }

  // 6. Savings Plan & Saving More
  const savingsPlanPatterns = [
    'save more',
    'how can i save',
    'how much should i save',
    'how much should i save every week',
    'save every week',
    'save each week',
    'hit my monthly target',
    'day i get paid',
    'save money on the day',
    'save on the day',
    'save on payday',
    'savings rate',
    'reach 30%',
    'increase savings',
    'savings plan',
    'start saving',
    'how to start saving',
    'how to save money',
    'savings capacity',
    'monthly savings capacity',
    'realistic savings',
    'weekly savings needed',
    'weekly savings',
    'variable income',
    'savings with variable income',
    'payday',
    'savings improvement plan',
    'savings improvement',
    'three-month savings',
    '3-month savings',
    'percentage of my income should i save',
    'percentage of income should i save',
    'what percentage of my income',
    'what percentage should i save',
    'percentage should i save',
    'what percentage to save',
    'percent of income to save',
    'percent of my income should i save',
    'how much should i save every month',
    'how much should i save each month',
    'how much should i save a month',
    'how much should i save monthly',
    'how to save more',
    'stop overspending',
    'prevent overspending',
    'how can i stop overspending',
    'how to stop overspending',
    'how do i stop overspending',
    'emergency fund',
    'build an emergency fund',
    'how can i build an emergency fund',
    'how to build an emergency fund',
    'how much should i save for emergencies',
    'next financial goal',
    'what should be my next goal',
    'what should be my next financial goal',
    'what goals should i focus on',
    'focus on next year',
    'goals for next year',
    'goals next year',
    'financial stability',
    'how do i achieve financial stability',
    'achieve financial stability',
    'how long will it take to reach my target',
    'how long to reach target',
    'how long to reach goal',
    'can i reach this goal with my current income',
    'can i reach this goal',
    'reach this goal with my current income',
    'step-by-step savings plan',
    'step by step savings plan',
    'step-by-step plan',
    'বেশি সঞ্চয়',
    'সঞ্চয় বাড়াব',
    'কীভাবে সঞ্চয়',
    'সঞ্চয়ের হার',
    'সপ্তাহে কত টাকা সঞ্চয়',
    'সপ্তাহে কত টাকা সঞ্চয়',
    'সপ্তাহে সঞ্চয়',
    'সপ্তাহে সঞ্চয়',
    'বেতন বা আয় পাওয়ার দিনই',
    'বেতন বা আয় পাওয়ার দিনই',
    'বেতন পাওয়ার দিন',
    'বেতন পাওয়ার দিন',
    'আয় পাওয়ার দিন',
    'আয় পাওয়ার দিন',
    'আয় আসলে সঞ্চয়',
    'আয় আসলে সঞ্চয়',
    'অনিয়মিত বা পরিবর্তনশীল আয়ে',
    'অনিয়মিত বা পরিবর্তনশীল আয়ে',
    'পরিবর্তনশীল আয়ে',
    'পরিবর্তনশীল আয়ে',
    'পরিবর্তনশীল আয়',
    'পরিবর্তনশীল আয়',
    'নিয়মিত সঞ্চয়',
    'নিয়মিত সঞ্চয়',
    '৩ মাসে সঞ্চয়',
    '৩ মাসে সঞ্চয়',
    'কত শতাংশ সঞ্চয় করা উচিত',
    'কত শতাংশ সঞ্চয় করা উচিত',
    'কত পারসেন্ট সঞ্চয় করা উচিত',
    'কত পার্সেন্ট সঞ্চয়',
    'প্রতি মাসে কত সঞ্চয় করা উচিত',
    'প্রতি মাসে কত সঞ্চয় করা উচিত',
    'অতিরিক্ত খরচ বন্ধ',
    'অতিরিক্ত খরচ কীভাবে বন্ধ করব',
    'অতিরিক্ত খরচ থামাব কীভাবে',
    'জরুরি তহবিল কীভাবে গড়ব',
    'জরুরি তহবিল কীভাবে তৈরি করব',
    'জরুরি তহবিলে কত টাকা থাকা দরকার',
    'পরবর্তী আর্থিক লক্ষ্য কী হওয়া উচিত',
    'পরবর্তী লক্ষ্য কী হওয়া উচিত',
    'আগামী বছর কোন লক্ষ্যে নজর দেওয়া উচিত',
    'আর্থিক স্থিতিশীলতা কীভাবে অর্জন করব',
    'টার্গেটে পৌঁছাতে কত সময় লাগবে',
    'টার্গেটে পৌঁছাতে কত সময় লাগবে',
    'বর্তমান আয়ে কি এই লক্ষ্য অর্জন সম্ভব',
    'বর্তমান আয়ে কি এই লক্ষ্য অর্জন সম্ভব',
    'ধাপে ধাপে সঞ্চয় পরিকল্পনা',
  ];
  if (!norm.includes('checklist')) {
    for (const p of savingsPlanPatterns) {
      if (matchesKeyword(norm, p)) {
        return { intent: 'savings_plan', confidence: 0.88, matchedKeywords: [p] };
      }
    }
  }

  // 6b. Actionable Financial Health Recommendations (3 actions, habits, improvements, checklists)
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
    'problems and possible actions',
    'problems and actions',
    'personalized improvements',
    'improvements',
    'good habits and areas',
    'good habits',
    'financial habits',
    'habits should i build',
    'priority action',
    'priority actions',
    'prioritize expense reduction',
    'habits for the next',
    'next 30 days',
    'weekly financial action plan',
    'action plan',
    'savings opportunities',
    'impact of specific spending',
    'repeated overspending',
    'prepare for unexpected',
    'plan for unexpected',
    'financial risks',
    'habit to stop',
    'checklist',
    'checklist for my mid-month',
    'mid-month and month-end',
    'month-end financial reviews',
    'financial improvement plan',
    'improvement plan',
    'major financial purchase',
    'before making a major',
    'major purchase',
    'missing financial data',
    'what missing financial data',
    'financial data should i add',
    '90-day',
    'কী পদক্ষেপ নেব',
    'কী কী পদক্ষেপ',
    'তিনটি পদক্ষেপ',
    'তিনটি পরামর্শ',
    '৩টি পদক্ষেপ',
    'উন্নতি করার ৩টি',
    'উন্নতি করার উপায়',
    'আর্থিক স্বাস্থ্য উন্নতি',
    'অগ্রাধিকারমূলক',
    'পদক্ষেপ কী কী',
    '৩টি অগ্রাধিকারমূলক',
    'উন্নতির জন্য এখনই',
    'আগামী ৩০ দিনে',
    'আগামী ৩০ দিন',
    'অভ্যাসগুলো গড়ে',
    'অভ্যাস গড়ে',
    'অভ্যাসগুলো',
    'আর্থিক স্বাস্থ্য উন্নত করতে',
    'বারবার অতিরিক্ত খরচ',
    'অতিরিক্ত খরচ কীভাবে নিয়ন্ত্রণ',
    'অতিরিক্ত খরচ নিয়ন্ত্রণ',
    'বড় কোনো খরচের সিদ্ধান্ত',
    'বড় খরচের সিদ্ধান্ত',
    'সিদ্ধান্ত নেওয়ার আগে',
    'কী কী বিষয় যাচাই',
    'চেকলিস্ট',
    'চেকলিস্ট দাও',
    'পক্ষকালের',
    'পক্ষকালের আর্থিক পর্যালোচনার',
    'কী কী আর্থিক তথ্য যুক্ত',
    'কী তথ্য যুক্ত করতে হবে',
    'আরও নিখুঁত পরামর্শ পেতে',
    'আরও নিখুঁত পরামর্শ পেতে অ্যাপে',
  ];
  for (const p of recommendationPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'health_recommendations', confidence: 0.94, matchedKeywords: [p] };
    }
  }

  // 6c. Budget & Spending Reduction Advice (Prioritized before generic total spending)
  const budgetPatterns = [
    'budget',
    'reduce spending',
    'cut spending',
    'which category should i cut',
    'where should i reduce',
    'trim expense',
    'essential and discretionary',
    'non-discretionary vs discretionary',
    'fixed and variable',
    'fixed expenses',
    'variable expenses',
    'allocate',
    'allocate my income',
    'allocate my monthly income',
    'allocate income across',
    'allocate income',
    'how should i allocate',
    'how to allocate',
    'how should i budget',
    'help me budget',
    'budget my monthly income',
    'distribute my income',
    'distribution across categories',
    'allocation across categories',
    'allocation',
    'spending limits',
    'category spending limits',
    'spending limit',
    'justified spending',
    'spending reductions',
    'spending reduction',
    'potential 10% spending reduction',
    'reduction in discretionary',
    'discretionary spending by',
    'optimize spending when medical',
    'medical expenses are large',
    'safe personal spending',
    'safe personal',
    'arriving at different times',
    'different times',
    'spendable funds',
    'remaining spendable',
    'weekly plan for the remaining',
    'weekly plan',
    'বাজেট',
    'খরচ কমাব',
    'খরচ কাটব',
    'কোন খাত কমাব',
    'বণ্টন',
    'কীভাবে বণ্টন',
    'আয় বণ্টন',
    'আয় বণ্টন',
    'বিভিন্ন খাতে',
    'কোন খাতটি কমানো',
    'খাতটি কমানো',
    'কোন খাত কমানো',
    'প্রয়োজনীয় ও নমনীয়',
    'প্রয়োজনীয় ও নমনীয়',
    'নমনীয় খরচ',
    'নমনীয় খরচ',
    'স্থায়ী খরচ',
    'স্থায়ী খরচ',
    'ভারসাম্য',
    'পরিবর্তনশীল খরচের',
    'পরিবর্তনশীল খরচ',
    'বাকি দিনগুলোতে খরচের',
    'নিরাপদ সীমা',
    'খরচের নিরাপদ সীমা',
    'সাপ্তাহিক খরচের সীমা',
    'খরচের সীমা কত',
    'বাকি দিনগুলোর জন্য',
    '১০% কমালে',
    '10% কমালে',
    'কমালে কী লাভ',
    'নমনীয় খরচ ১০%',
    'নমনীয় খরচ ১০%',
    'কোনো রেকর্ড করা আয় না থাকলে',
    'রেকর্ড করা আয় না থাকলে',
    'কোনো রেকর্ড করা আয় না থাকলে',
    'রেকর্ড করা আয় না থাকলে',
    'জরুরি চিকিৎসা খরচে হাত না দিয়ে',
    'চিকিৎসা খরচে হাত না দিয়ে',
    'হাত না দিয়ে কীভাবে অন্য খরচ',
    'জরুরি চিকিৎসা',
    'হাত না দিয়ে',
  ];
  for (const p of budgetPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'budget_help', confidence: 0.85, matchedKeywords: [p] };
    }
  }

  // 6d. Comprehensive Financial Status & Financial Overview
  const financialStatusPatterns = [
    'what s my financial status',
    'what is my financial status',
    'my financial status',
    'how am i doing financially',
    'how am i doing',
    'financial status',
    'current financial status',
    'overall financial status',
    'financial standing',
    'status of my finances',
    'overview of my finances',
    'সার্বিক আর্থিক অবস্থা',
    'আর্থিক অবস্থা কেমন',
    'আর্থিক পরিস্থিতি',
    'আর্থিক অবস্থান',
    'আর্থিক চিত্র',
    'কেমন চলছে আমার আর্থিক',
  ];
  for (const p of financialStatusPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'financial_status', confidence: 0.95, matchedKeywords: [p] };
    }
  }

  // 7. Financial Health Score
  const healthPatterns = [
    'health score',
    'financial health',
    'how healthy',
    'health status',
    'my score',
    'financial stability risks',
    'stability risks',
    'financial situation to a beginner',
    'financial position in simple language',
    'আর্থিক স্বাস্থ্য',
    'হেলথ স্কোর',
    'স্কোর কত',
    'আর্থিক অবস্থা',
    'আর্থিক স্থিতিশীলতার ক্ষেত্রে',
    'প্রধান দুর্বলতা',
    'দুর্বলতা বা ঝুঁকি',
    'স্থিতিশীলতার ক্ষেত্রে প্রধান',
  ];
  for (const p of healthPatterns) {
    if (matchesKeyword(norm, p)) {
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
    'overall spending behavior',
    'break down expenses',
    'breakdown',
    'কত টাকা খরচ',
    'মোট খরচ',
    'এ মাসের খরচ',
    'কত খরচ করেছি',
  ];
  for (const p of totalSpendingPatterns) {
    if (matchesKeyword(norm, p)) {
      return { intent: 'spending_total', confidence: 0.9, matchedKeywords: [p] };
    }
  }

  // 9. Transaction Lookup
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
    if (matchesKeyword(norm, p)) {
      return { intent: 'transaction_lookup', confidence: 0.88, matchedKeywords: [p] };
    }
  }

  // 10. General Education
  const generalEduPatterns = [
    'what is the 50/30/20',
    'what is 50/30/20',
    '50/30/20 rule',
    '50/30/20',
    'budgeting rule',
    'explain 50/30/20',
    'explain rule',
    'evaluate expensive purchases',
    'expensive purchases',
    'কীভাবে কাজ করে',
    'কাকে বলে',
  ];
  for (const p of generalEduPatterns) {
    if (matchesKeyword(norm, p)) {
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
      if (fullContext.snapshot.profileMonthlyIncome !== undefined) {
        addFact('snapshot.profileMonthlyIncome', fullContext.snapshot.profileMonthlyIncome);
        if (fullContext.snapshot.profileMonthlyIncomeCurrency) {
          addFact('snapshot.profileMonthlyIncomeCurrency', fullContext.snapshot.profileMonthlyIncomeCurrency);
        }
      }
    }
  };

  // Goals facts included whenever assessing goals, status, or financial health
  const includeGoals = () => {
    addFact('goals.totalGoals', fullContext.goals.totalGoals);
    addFact('goals.available', fullContext.goals.available);
    if (fullContext.goals.items && fullContext.goals.items.length > 0) {
      fullContext.goals.items.forEach((g, idx) => {
        const prefix = `goals.goal${idx + 1}`;
        addFact(`${prefix}.title`, g.title);
        addFact(`${prefix}.targetAmount`, g.targetAmount);
        addFact(`${prefix}.currentAmount`, g.currentAmount);
        addFact(`${prefix}.progressPercentage`, g.progressPercentage);
        addFact(`${prefix}.remainingAmount`, g.remainingAmount);
        addFact(`${prefix}.deadline`, g.deadline);
        addFact(`${prefix}.isOnTrack`, g.isOnTrack);
        if (g.requiredMonthlyContribution > 0) {
          addFact(`${prefix}.requiredMonthlyContribution`, g.requiredMonthlyContribution);
        }
      });
    }
  };

  switch (intent) {
    case 'financial_status':
      includeSnapshot(true);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
        addFact('spending.topCategoryPercentage', fullContext.spending.topCategory.percentage);
      }
      if (fullContext.spending.lowestCategory) {
        addFact('spending.lowestCategory', fullContext.spending.lowestCategory.category);
        addFact('spending.lowestCategoryAmount', fullContext.spending.lowestCategory.amount);
      }
      includeGoals();
      if (fullContext.health.score !== null) {
        addFact('health.score', fullContext.health.score);
        addFact('health.band', fullContext.health.band);
      }
      addFact('cashFlow.forecastMonthEndBalance', fullContext.cashFlow.forecastMonthEndBalance);
      break;
    case 'spending_vs_income':
      includeSnapshot(true);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      if (fullContext.spending.topCategory) {
        addFact('spending.topCategory', fullContext.spending.topCategory.category);
        addFact('spending.topCategoryAmount', fullContext.spending.topCategory.amount);
        addFact('spending.topCategoryPercentage', fullContext.spending.topCategory.percentage);
      }
      addFact('snapshot.netCashFlow', fullContext.snapshot.netCashFlow);
      break;

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
      if (fullContext.spending.lowestCategory) {
        addFact('spending.lowestCategory', fullContext.spending.lowestCategory.category);
        addFact('spending.lowestCategoryAmount', fullContext.spending.lowestCategory.amount);
      }
      if (fullContext.spending.categoryTotals) {
        for (const [cat, amt] of Object.entries(fullContext.spending.categoryTotals)) {
          if (amt > 0) {
            addFact(`spending.category.${cat}`, amt);
          }
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
      if (fullContext.spending.categoryTotals) {
        for (const [cat, amt] of Object.entries(fullContext.spending.categoryTotals)) {
          if (amt > 0) {
            addFact(`spending.category.${cat}`, amt);
          }
        }
      }
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      break;

    case 'category_spending':
      includeSnapshot(true);
      addFact('spending.totalSpending', fullContext.spending.totalSpending);
      if (intentResult.matchedCategory) {
        const catKey = Object.keys(fullContext.spending.categoryTotals || {}).find(
          (k) => k.toLowerCase() === intentResult.matchedCategory?.toLowerCase()
        ) || intentResult.matchedCategory;
        const amt = fullContext.spending.categoryTotals?.[catKey] ?? 0;
        const pct = fullContext.spending.categoryPercentages?.[catKey] ?? 0;
        addFact(`spending.category.${catKey}`, amt);
        addFact(`spending.categoryPct.${catKey}`, pct);
      }
      if (fullContext.spending.categoryTotals) {
        for (const [cat, amt] of Object.entries(fullContext.spending.categoryTotals)) {
          if (amt > 0) {
            addFact(`spending.category.${cat}`, amt);
          }
        }
      }
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
        addFact('spending.topCategoryPercentage', fullContext.spending.topCategory.percentage);
      }
      if (fullContext.spending.lowestCategory) {
        addFact('spending.lowestCategory', fullContext.spending.lowestCategory.category);
        addFact('spending.lowestCategoryAmount', fullContext.spending.lowestCategory.amount);
        addFact('spending.lowestCategoryPercentage', fullContext.spending.lowestCategory.percentage);
      }
      if (fullContext.spending.categoryTotals) {
        for (const [cat, amt] of Object.entries(fullContext.spending.categoryTotals)) {
          if (amt > 0) {
            addFact(`spending.category.${cat}`, amt);
            if (fullContext.spending.categoryPercentages?.[cat] !== undefined) {
              addFact(`spending.categoryPct.${cat}`, fullContext.spending.categoryPercentages[cat]);
            }
          }
        }
      }
      if (fullContext.goals.totalGoals > 0) {
        includeGoals();
      }
      break;

    case 'month_end_balance':
      includeSnapshot(true);
      addFact('cashFlow.startingBalance', fullContext.cashFlow.startingBalance);
      addFact('cashFlow.forecastMonthEndBalance', fullContext.cashFlow.forecastMonthEndBalance);
      addFact('cashFlow.recommendedBuffer', fullContext.cashFlow.recommendedBuffer);
      addFact('cashFlow.shortfall', fullContext.cashFlow.shortfall);
      addFact('cashFlow.recommendedWeeklyReduction', fullContext.cashFlow.recommendedWeeklyReduction);
      if (fullContext.cashFlow.upcomingBills !== undefined) {
        addFact('cashFlow.upcomingBills', fullContext.cashFlow.upcomingBills);
      }
      if (fullContext.cashFlow.safeSpendingLimitWeekly !== undefined) {
        addFact('cashFlow.safeSpendingLimitWeekly', fullContext.cashFlow.safeSpendingLimitWeekly);
      }
      if (fullContext.cashFlow.uncommittedDiscretionaryPool !== undefined) {
        addFact('cashFlow.uncommittedDiscretionaryPool', fullContext.cashFlow.uncommittedDiscretionaryPool);
      }
      break;

    case 'savings_goal_progress':
      includeSnapshot(true);
      includeGoals();
      break;

    case 'savings_plan':
      includeSnapshot(true);
      includeGoals();
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
        if (fullContext.snapshot.profileMonthlyIncomeCurrency) {
          addFact('snapshot.profileMonthlyIncomeCurrency', fullContext.snapshot.profileMonthlyIncomeCurrency);
        }
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
      addFact('health.confidence', fullContext.health.confidence);
      addFact('dataWindow.totalTransactions', fullContext.metadata.dataWindow.totalTransactions);
      addFact('dataWindow.historicalMonthsCount', fullContext.metadata.dataWindow.historicalMonthsCount ?? 1);
      addFact('health.savingConsistency', fullContext.health.savingConsistency);
      addFact('health.spendingControl', fullContext.health.spendingControl);
      addFact('health.cashFlowStability', fullContext.health.cashFlowStability);
      addFact('health.goalProgress', fullContext.health.goalProgress);
      includeGoals();
      break;

    case 'health_recommendations':
      includeSnapshot(true);
      addFact('health.score', fullContext.health.score);
      addFact('health.band', fullContext.health.band);
      addFact('health.confidence', fullContext.health.confidence);
      addFact('dataWindow.totalTransactions', fullContext.metadata.dataWindow.totalTransactions);
      addFact('dataWindow.historicalMonthsCount', fullContext.metadata.dataWindow.historicalMonthsCount ?? 1);
      addFact('health.savingConsistency', fullContext.health.savingConsistency);
      addFact('health.spendingControl', fullContext.health.spendingControl);
      addFact('health.cashFlowStability', fullContext.health.cashFlowStability);
      addFact('health.goalProgress', fullContext.health.goalProgress);
      includeGoals();
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
