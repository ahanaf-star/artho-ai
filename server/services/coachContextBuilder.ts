import { TransactionModel, ITransaction } from '../models/Transaction';
import { SavingsGoalModel, ISavingsGoal } from '../models/SavingsGoal';
import { UserModel, IUser } from '../models/User';
import { isDbConnected } from '../config/database';
import {
  calculateMonthlyOverview,
  calculateFinancialHealthScore,
  calculateGoalProgressPercentage,
  calculateRemainingGoalAmount,
  calculateRequiredMonthlySavings,
  calculateScenarioPlans,
  detectSpendingAnomalies,
  getDetailedForecast,
  getLocalDateString,
  getPreviousMonth,
  getLatestTransactionMonth,
  parseLocalDate,
} from '../../src/services/financialCalculations';
import { Transaction, SavingsGoal } from '../../src/types/financial';

export const MFS_FEE_RATE = 0.0185; // 1.85% standard Bangladesh MFS cash-out tariff

export interface FactItem<T = number | string | boolean | null> {
  key: string;
  value: T;
  available: boolean;
  labelEn: string;
  labelBn: string;
}

export interface CoachContext {
  metadata: {
    today: string;
    dataWindow: {
      currentMonth: string;
      previousMonths: string[];
      hasData: boolean;
      totalTransactions: number;
    };
  };
  snapshot: {
    available: boolean;
    monthlyIncome: number;
    monthlySpending: number;
    netSavings: number;
    savingsRate: number;
    expenseRatio: number;
    currentBalance: number;
    facts: Record<string, FactItem>;
  };
  spending: {
    available: boolean;
    totalSpending: number;
    topCategory: {
      category: string;
      amount: number;
      percentage: number;
      momChangePercentage: number;
    } | null;
    topCategories: Array<{
      category: string;
      amount: number;
      percentage: number;
      momChangePercentage: number;
    }>;
    categoryTotals: Record<string, number>;
    categoryPercentages: Record<string, number>;
    anomalies: Array<{
      category: string;
      amount: number;
      reason?: string;
    }>;
    anomaliesCount: number;
    facts: Record<string, FactItem>;
  };
  goals: {
    available: boolean;
    totalGoals: number;
    items: Array<{
      id: string;
      title: string;
      targetAmount: number;
      currentAmount: number;
      progressPercentage: number;
      remainingAmount: number;
      deadline: string;
      isOnTrack: boolean;
      requiredMonthlyContribution: number;
      scenarioSummary: string;
    }>;
    facts: Record<string, FactItem>;
  };
  cashFlow: {
    available: boolean;
    startingBalance: number;
    forecastMonthEndBalance: number;
    shortfall: number;
    confidenceLevel: 'High' | 'Medium' | 'Low';
    recommendedWeeklyReduction: number;
    recommendedBuffer: number;
    facts: Record<string, FactItem>;
  };
  health: {
    available: boolean;
    score: number | null;
    band: string;
    percentile: number | null;
    confidence: 'High' | 'Medium' | 'Low';
    savingConsistency: number | null;
    spendingControl: number | null;
    cashFlowStability: number | null;
    goalProgress: number | null;
    facts: Record<string, FactItem>;
  };
  cashOut: {
    available: boolean;
    totalAmount: number;
    count: number;
    shareOfSpending: number;
    feeCost: number;
    feeRate: number;
    facts: Record<string, FactItem>;
  };
  recentTransactions: Array<{
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    category: string;
    date: string;
    description?: string;
  }>;
}

/**
 * Returns current date in Asia/Dhaka timezone (YYYY-MM-DD)
 */
export function getDhakaToday(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return getLocalDateString();
  }
}

/**
 * Strips control characters and truncates description to max 40 chars
 */
function sanitizeDescription(desc?: string): string | undefined {
  if (!desc) return undefined;
  // Strip non-printable / control characters and limit length
  const cleaned = desc.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 40);
}

/**
 * Builds deterministic, authoritative CoachContext for an authenticated user from MongoDB
 */
export async function buildCoachContext(
  userId: string,
  options?: { targetMonth?: string; userDoc?: any }
): Promise<CoachContext> {
  const today = getDhakaToday();
  const calendarMonth = today.slice(0, 7);

  let rawTransactions: ITransaction[] = [];
  let rawGoals: ISavingsGoal[] = [];
  let user: IUser | null = options?.userDoc || null;

  if (isDbConnected()) {
    try {
      // Find all transactions for this authenticated user (matching _id or customId)
      rawTransactions = await TransactionModel.find({
        $or: [{ userId }, { userId: String(userId) }],
      })
        .sort({ date: -1, createdAt: -1 })
        .lean();

      // Find all savings goals for this user
      rawGoals = await SavingsGoalModel.find({
        $or: [{ userId }, { userId: String(userId) }],
      })
        .sort({ createdAt: -1 })
        .lean();

      // If user doc not provided, fetch from DB
      if (!user) {
        user = await UserModel.findOne({
          $or: [
            ...(userId.length === 24 && /^[0-9a-fA-F]{24}$/.test(userId) ? [{ _id: userId }] : []),
            { customId: userId },
          ],
        }).lean();
      }
    } catch (err: any) {
      console.warn(`[buildCoachContext] DB query error for user ${userId}:`, err?.message);
    }
  }

  // Convert raw DB models to typed objects suitable for shared financial calculation functions
  const transactions: Transaction[] = rawTransactions.map((t) => ({
    id: t.customId || (t as any)._id?.toString() || '',
    type: t.type,
    amount: Number(t.amount) || 0,
    category: t.category as any,
    description: t.description || '',
    date: t.date || today,
    merchant: t.merchant || 'General Merchant',
    account: (t.account as any) || 'bKash',
    paymentMethod: t.paymentMethod || 'bKash QR Direct',
    classification: t.classification || (t.type === 'income' ? 'essential' : 'discretionary'),
    fee: t.fee,
    isRecurring: t.isRecurring,
    isAnomaly: (t as any).isAnomaly,
    anomalyReason: (t as any).anomalyReason,
  }));

  const goals: SavingsGoal[] = rawGoals.map((g) => ({
    id: g.customId || (g as any)._id?.toString() || '',
    title: g.title || g.name || 'Savings Goal',
    name: g.name || g.title || 'Savings Goal',
    targetAmount: Number(g.targetAmount) || 0,
    currentAmount: Number(g.currentAmount) || 0,
    deadline: g.deadline || today,
    monthlyPace: g.monthlyPace || 3000,
    accountVault: (g as any).accountVault || 'City Bank High-Yield Savings Vault',
    status: (g.status as any) || 'On Track',
    category: g.category || 'General Savings',
    color: g.color || '#10B981',
    icon: g.icon || '🎯',
  }));

  // Determine active month window:
  // Prefer requested targetMonth -> then current calendar month if it has data -> then latest transaction month
  let activeMonth = options?.targetMonth;
  if (!activeMonth) {
    const hasCurrentMonthTxs = transactions.some(
      (t) => t.date && t.date.startsWith(calendarMonth) && t.type !== 'transfer'
    );
    if (hasCurrentMonthTxs) {
      activeMonth = calendarMonth;
    } else {
      activeMonth = getLatestTransactionMonth(transactions);
    }
  }

  const prevMonth1 = getPreviousMonth(activeMonth);
  const prevMonth2 = getPreviousMonth(prevMonth1);
  const prevMonth3 = getPreviousMonth(prevMonth2);
  const previousMonths = [prevMonth1, prevMonth2, prevMonth3];

  // Exclude transfer transactions so nothing is double-counted in income/expense
  const eligibleTransactions = transactions.filter((t) => t.type === 'income' || t.type === 'expense');

  // Compute monthly overview using shared deterministic function
  const monthlyOverview = calculateMonthlyOverview(eligibleTransactions, activeMonth);

  // Authenticated user's Current Balance:
  // Must use the project's existing balance definition:
  // Sum of linkedAccounts balances; if accounts array empty, calculate cumulative all-time income - expenses
  let currentBalance = 0;
  if (user?.linkedAccounts && user.linkedAccounts.length > 0) {
    currentBalance = user.linkedAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  } else if (eligibleTransactions.length > 0) {
    const allTimeBal = eligibleTransactions.reduce((acc, t) => {
      if (t.type === 'income') return acc + t.amount;
      if (t.type === 'expense') return acc - t.amount;
      return acc;
    }, 0);
    currentBalance = Math.max(0, allTimeBal);
  } else {
    currentBalance = 0;
  }

  const monthlyIncome = monthlyOverview.totalIncome;
  const monthlySpending = monthlyOverview.totalExpenses;
  const netSavings = monthlyOverview.netSavings;
  const savingsRate = monthlyOverview.savingsRate;
  const expenseRatio = monthlyIncome > 0 ? Number(((monthlySpending / monthlyIncome) * 100).toFixed(1)) : 0;

  // 1. Snapshot Fact Group
  const snapshotFacts: Record<string, FactItem> = {
    'snapshot.monthlyIncome': {
      key: 'snapshot.monthlyIncome',
      value: monthlyIncome,
      available: monthlyIncome > 0,
      labelEn: 'Monthly Income',
      labelBn: 'মাসিক আয়',
    },
    'snapshot.monthlySpending': {
      key: 'snapshot.monthlySpending',
      value: monthlySpending,
      available: monthlySpending > 0,
      labelEn: 'Monthly Spending',
      labelBn: 'মাসিক ব্যয়',
    },
    'snapshot.netSavings': {
      key: 'snapshot.netSavings',
      value: netSavings,
      available: true,
      labelEn: 'Net Monthly Savings',
      labelBn: 'নিট মাসিক সঞ্চয়',
    },
    'snapshot.savingsRate': {
      key: 'snapshot.savingsRate',
      value: savingsRate,
      available: monthlyIncome > 0,
      labelEn: 'Savings Rate (%)',
      labelBn: 'সঞ্চয়ের হার (%)',
    },
    'snapshot.expenseRatio': {
      key: 'snapshot.expenseRatio',
      value: expenseRatio,
      available: monthlyIncome > 0,
      labelEn: 'Expense Ratio (%)',
      labelBn: 'ব্যয়ের অনুপাত (%)',
    },
    'snapshot.currentBalance': {
      key: 'snapshot.currentBalance',
      value: currentBalance,
      available: true,
      labelEn: 'Available Liquid Balance',
      labelBn: 'উপলব্ধ ব্যালেন্স',
    },
  };

  // 2. Spending Fact Group
  const topCategories = monthlyOverview.categories
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topCategoryItem = topCategories[0] || null;

  const categoryTotals: Record<string, number> = {};
  const categoryPercentages: Record<string, number> = {};
  for (const cat of monthlyOverview.categories) {
    categoryTotals[cat.category] = cat.amount;
    categoryPercentages[cat.category] = cat.percentage;
  }

  // Detect spending anomalies using shared function
  const anomaliesList = detectSpendingAnomalies(eligibleTransactions, activeMonth);
  const anomalies = anomaliesList.map((a) => ({
    category: a.category,
    amount: a.amount,
    reason: a.anomalyReason || 'Unusual expenditure',
  }));

  const spendingFacts: Record<string, FactItem> = {
    'spending.totalSpending': {
      key: 'spending.totalSpending',
      value: monthlySpending,
      available: monthlySpending > 0,
      labelEn: 'Total Monthly Spending',
      labelBn: 'মোট মাসিক ব্যয়',
    },
    'spending.topCategory': {
      key: 'spending.topCategory',
      value: topCategoryItem ? topCategoryItem.category : 'None',
      available: topCategoryItem !== null,
      labelEn: 'Top Spending Category',
      labelBn: 'শীর্ষ খরচের খাত',
    },
    'spending.topCategoryAmount': {
      key: 'spending.topCategoryAmount',
      value: topCategoryItem ? topCategoryItem.amount : 0,
      available: topCategoryItem !== null,
      labelEn: 'Top Category Amount',
      labelBn: 'শীর্ষ খাতের খরচের পরিমাণ',
    },
    'spending.topCategoryPercentage': {
      key: 'spending.topCategoryPercentage',
      value: topCategoryItem ? topCategoryItem.percentage : 0,
      available: topCategoryItem !== null,
      labelEn: 'Top Category Spending Share (%)',
      labelBn: 'শীর্ষ খাতের ব্যয়ের অংশ (%)',
    },
    'spending.anomaliesCount': {
      key: 'spending.anomaliesCount',
      value: anomalies.length,
      available: true,
      labelEn: 'Spending Anomalies Count',
      labelBn: 'অস্বাভাবিক খরচের সংখ্যা',
    },
  };

  // 3. Goals Fact Group
  const goalItems = goals.map((g, idx) => {
    const progress = calculateGoalProgressPercentage(g);
    const remaining = calculateRemainingGoalAmount(g);
    const requiredMonthly = calculateRequiredMonthlySavings(g, today);
    const scenarios = calculateScenarioPlans(g);
    const recommendedScenario = scenarios.find((s) => s.isRecommended) || scenarios[0];
    const scenarioSummary = recommendedScenario
      ? `${recommendedScenario.name}: ৳${recommendedScenario.monthlyAmount.toLocaleString()}/mo (${recommendedScenario.durationMonths} months, ${recommendedScenario.badge})`
      : `Target: ৳${g.targetAmount.toLocaleString()}`;

    return {
      id: g.id,
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progressPercentage: progress,
      remainingAmount: remaining,
      deadline: g.deadline,
      isOnTrack: g.status === 'On Track' || progress >= 100,
      requiredMonthlyContribution: requiredMonthly,
      scenarioSummary,
    };
  });

  const goalsFacts: Record<string, FactItem> = {
    'goals.totalGoals': {
      key: 'goals.totalGoals',
      value: goals.length,
      available: true,
      labelEn: 'Total Active Goals',
      labelBn: 'মোট সক্রিয় সঞ্চয় লক্ষ্য',
    },
  };

  goalItems.forEach((gi, idx) => {
    const prefix = `goals.goal${idx + 1}`;
    goalsFacts[`${prefix}.title`] = {
      key: `${prefix}.title`,
      value: gi.title,
      available: true,
      labelEn: `Goal ${idx + 1} Title`,
      labelBn: `লক্ষ্য ${idx + 1} শিরোনাম`,
    };
    goalsFacts[`${prefix}.targetAmount`] = {
      key: `${prefix}.targetAmount`,
      value: gi.targetAmount,
      available: true,
      labelEn: `Goal ${idx + 1} Target`,
      labelBn: `লক্ষ্য ${idx + 1} টার্গেট`,
    };
    goalsFacts[`${prefix}.currentAmount`] = {
      key: `${prefix}.currentAmount`,
      value: gi.currentAmount,
      available: true,
      labelEn: `Goal ${idx + 1} Saved`,
      labelBn: `লক্ষ্য ${idx + 1} বর্তমান জমা`,
    };
    goalsFacts[`${prefix}.progressPercentage`] = {
      key: `${prefix}.progressPercentage`,
      value: gi.progressPercentage,
      available: true,
      labelEn: `Goal ${idx + 1} Progress (%)`,
      labelBn: `লক্ষ্য ${idx + 1} অগ্রগতি (%)`,
    };
    goalsFacts[`${prefix}.remainingAmount`] = {
      key: `${prefix}.remainingAmount`,
      value: gi.remainingAmount,
      available: true,
      labelEn: `Goal ${idx + 1} Remaining`,
      labelBn: `লক্ষ্য ${idx + 1} অবশিষ্ট ঘাটতি`,
    };
    goalsFacts[`${prefix}.requiredMonthlyContribution`] = {
      key: `${prefix}.requiredMonthlyContribution`,
      value: gi.requiredMonthlyContribution,
      available: gi.requiredMonthlyContribution > 0,
      labelEn: `Goal ${idx + 1} Required Monthly Savings`,
      labelBn: `লক্ষ্য ${idx + 1} প্রয়োজনীয় মাসিক সঞ্চয়`,
    };
  });

  // 4. Cash Flow Fact Group
  // Run deterministic forecast engine
  const recurringObligations = (user?.recurringObligations || []) as any;
  const forecast = getDetailedForecast(currentBalance, false, eligibleTransactions, recurringObligations);
  const forecastMonthEndBalance = forecast.projectedMonthEnd;
  const recommendedBuffer = forecast.recommendedBuffer;
  const shortfall = Math.max(0, recommendedBuffer - forecastMonthEndBalance);
  // Deterministic recommended weekly reduction from forecast:
  const recommendedWeeklyReduction = shortfall > 0 ? Math.round(shortfall / 4) : 0;

  const cashFlowFacts: Record<string, FactItem> = {
    'cashFlow.startingBalance': {
      key: 'cashFlow.startingBalance',
      value: currentBalance,
      available: true,
      labelEn: 'Starting Liquid Balance',
      labelBn: 'প্রারম্ভিক ব্যালেন্স',
    },
    'cashFlow.monthEndBalance': {
      key: 'cashFlow.monthEndBalance',
      value: forecastMonthEndBalance,
      available: true,
      labelEn: 'Forecast Month-End Balance',
      labelBn: 'সম্ভাব্য মাস শেষ ব্যালেন্স',
    },
    'cashFlow.recommendedBuffer': {
      key: 'cashFlow.recommendedBuffer',
      value: recommendedBuffer,
      available: true,
      labelEn: 'Recommended Safety Buffer',
      labelBn: 'প্রস্তাবিত নিরাপত্তা বাফার',
    },
    'cashFlow.shortfall': {
      key: 'cashFlow.shortfall',
      value: shortfall,
      available: true,
      labelEn: 'Projected Cash Flow Shortfall',
      labelBn: 'সম্ভাব্য ক্যাশ-ফ্লো ঘাটতি',
    },
    'cashFlow.recommendedWeeklyReduction': {
      key: 'cashFlow.recommendedWeeklyReduction',
      value: recommendedWeeklyReduction,
      available: recommendedWeeklyReduction > 0,
      labelEn: 'Recommended Weekly Spending Trim',
      labelBn: 'প্রস্তাবিত সাপ্তাহিক খরচ হ্রাস',
    },
  };

  // 5. Financial Health Fact Group
  const healthMetrics = calculateFinancialHealthScore(
    eligibleTransactions,
    goals,
    monthlyIncome || user?.monthlyIncome || 0,
    activeMonth
  );

  const healthFacts: Record<string, FactItem> = {
    'health.score': {
      key: 'health.score',
      value: healthMetrics.score,
      available: healthMetrics.score !== null,
      labelEn: 'Financial Health Score (0-100)',
      labelBn: 'আর্থিক স্বাস্থ্য স্কোর (০-১০০)',
    },
    'health.band': {
      key: 'health.band',
      value: healthMetrics.status,
      available: true,
      labelEn: 'Health Status Band',
      labelBn: 'স্বাস্থ্য অবস্থা বিভাগ',
    },
    'health.percentile': {
      key: 'health.percentile',
      value: healthMetrics.percentile,
      available: healthMetrics.percentile !== null,
      labelEn: 'Dhaka Peer Percentile',
      labelBn: 'সমকক্ষ ব্যবহারকারীদের চেয়ে শতকরা এগিয়ে',
    },
    'health.savingConsistency': {
      key: 'health.savingConsistency',
      value: healthMetrics.factors.savingConsistency,
      available: healthMetrics.factors.savingConsistency !== null,
      labelEn: 'Saving Consistency Factor',
      labelBn: 'ধারাবাহিক সঞ্চয় গুণক',
    },
    'health.spendingControl': {
      key: 'health.spendingControl',
      value: healthMetrics.factors.spendingControl,
      available: healthMetrics.factors.spendingControl !== null,
      labelEn: 'Spending Control Factor',
      labelBn: 'ব্যয় নিয়ন্ত্রণ গুণক',
    },
    'health.cashFlowStability': {
      key: 'health.cashFlowStability',
      value: healthMetrics.factors.cashFlowStability,
      available: healthMetrics.factors.cashFlowStability !== null,
      labelEn: 'Cash Flow Stability Factor',
      labelBn: 'ক্যাশ-ফ্লো স্থায়িত্ব গুণক',
    },
    'health.goalProgress': {
      key: 'health.goalProgress',
      value: healthMetrics.factors.goalProgress,
      available: healthMetrics.factors.goalProgress !== null,
      labelEn: 'Goal Progress Factor',
      labelBn: 'লক্ষ্য অর্জনের গুণক',
    },
  };

  // 6. Cash-Out Fact Group
  const cashOutTxs = eligibleTransactions.filter(
    (t) =>
      t.category === 'Cash-out & Bank Fees' ||
      (t.fee && t.fee > 0) ||
      (t.description && /cash[- ]?out|mfs fee/i.test(t.description))
  );
  const cashOutTotal = cashOutTxs.reduce((sum, t) => sum + t.amount, 0);
  const cashOutFeeCost = cashOutTxs.reduce((sum, t) => sum + (t.fee || Math.round(t.amount * MFS_FEE_RATE)), 0);
  const cashOutShare = monthlySpending > 0 ? Number(((cashOutTotal / monthlySpending) * 100).toFixed(1)) : 0;

  const cashOutFacts: Record<string, FactItem> = {
    'cashOut.totalAmount': {
      key: 'cashOut.totalAmount',
      value: cashOutTotal,
      available: cashOutTotal > 0,
      labelEn: 'Total Cash-Out Transactions Amount',
      labelBn: 'ক্যাশ-আউট লেনদেনের মোট পরিমাণ',
    },
    'cashOut.count': {
      key: 'cashOut.count',
      value: cashOutTxs.length,
      available: cashOutTxs.length > 0,
      labelEn: 'Cash-Out Transactions Count',
      labelBn: 'ক্যাশ-আউট লেনদেনের সংখ্যা',
    },
    'cashOut.feeCost': {
      key: 'cashOut.feeCost',
      value: cashOutFeeCost,
      available: cashOutFeeCost > 0,
      labelEn: 'Avoidable MFS Tariff Leak (1.85%)',
      labelBn: 'অপ্রয়োজনীয় এমএফএস ক্যাশ-আউট ফি (১.৮৫%)',
    },
    'cashOut.shareOfSpending': {
      key: 'cashOut.shareOfSpending',
      value: cashOutShare,
      available: cashOutShare > 0,
      labelEn: 'Cash-Out Share of Total Spending (%)',
      labelBn: 'মোট ব্যয়ের মধ্যে ক্যাশ-আউটের শতকরা অংশ',
    },
  };

  // 7. Recent Transactions (last 10, PII stripped, descriptions sanitized to max 40 chars)
  const recentTransactions = eligibleTransactions.slice(0, 10).map((t) => ({
    type: t.type,
    amount: t.amount,
    category: t.category,
    date: t.date,
    description: sanitizeDescription(t.description),
  }));

  return {
    metadata: {
      today,
      dataWindow: {
        currentMonth: activeMonth,
        previousMonths,
        hasData: eligibleTransactions.length > 0,
        totalTransactions: eligibleTransactions.length,
      },
    },
    snapshot: {
      available: monthlyIncome > 0 || monthlySpending > 0 || currentBalance > 0,
      monthlyIncome,
      monthlySpending,
      netSavings,
      savingsRate,
      expenseRatio,
      currentBalance,
      facts: snapshotFacts,
    },
    spending: {
      available: monthlySpending > 0,
      totalSpending: monthlySpending,
      topCategory: topCategoryItem
        ? {
            category: topCategoryItem.category,
            amount: topCategoryItem.amount,
            percentage: topCategoryItem.percentage,
            momChangePercentage: topCategoryItem.momChangePercentage,
          }
        : null,
      topCategories: topCategories.map((c) => ({
        category: c.category,
        amount: c.amount,
        percentage: c.percentage,
        momChangePercentage: c.momChangePercentage,
      })),
      categoryTotals,
      categoryPercentages,
      anomalies,
      anomaliesCount: anomalies.length,
      facts: spendingFacts,
    },
    goals: {
      available: goals.length > 0,
      totalGoals: goals.length,
      items: goalItems,
      facts: goalsFacts,
    },
    cashFlow: {
      available: true,
      startingBalance: currentBalance,
      forecastMonthEndBalance,
      shortfall,
      confidenceLevel: eligibleTransactions.length > 10 ? 'High' : 'Medium',
      recommendedWeeklyReduction,
      recommendedBuffer,
      facts: cashFlowFacts,
    },
    health: {
      available: healthMetrics.score !== null,
      score: healthMetrics.score,
      band: healthMetrics.status,
      percentile: healthMetrics.percentile,
      confidence: eligibleTransactions.length > 10 ? 'High' : 'Medium',
      savingConsistency: healthMetrics.factors.savingConsistency,
      spendingControl: healthMetrics.factors.spendingControl,
      cashFlowStability: healthMetrics.factors.cashFlowStability,
      goalProgress: healthMetrics.factors.goalProgress,
      facts: healthFacts,
    },
    cashOut: {
      available: cashOutTxs.length > 0,
      totalAmount: cashOutTotal,
      count: cashOutTxs.length,
      shareOfSpending: cashOutShare,
      feeCost: cashOutFeeCost,
      feeRate: MFS_FEE_RATE,
      facts: cashOutFacts,
    },
    recentTransactions,
  };
}
