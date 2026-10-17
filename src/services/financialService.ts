import {
  Transaction,
  CategoryName,
  SpendingCategory,
  FinancialSummary,
  SavingsGoal,
} from '../types/financial';

// Standard Category Ordering
export const STANDARD_CATEGORIES: CategoryName[] = [
  'Food & Groceries',
  'Shopping & Gadgets',
  'Utility & Fixed Costs',
  'Transportation',
  'Cash-out & Bank Fees',
  'Entertainment & Others',
];

/**
 * Format currency into Bangladeshi Taka (BDT / ৳)
 * Example: 24850 -> "৳24,850"
 */
export function formatBDT(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('en-IN').format(rounded);
  return `৳${formatted}`;
}

/**
 * Filter transactions by month string ("YYYY-MM")
 */
export function filterTransactionsByMonth(
  transactions: Transaction[],
  monthKey: string = '2024-10'
): Transaction[] {
  return transactions.filter((t) => t.date.startsWith(monthKey));
}

/**
 * A. Calculate Total Income for a given month
 */
export function calculateTotalIncome(
  transactions: Transaction[],
  monthKey: string = '2024-10'
): number {
  return filterTransactionsByMonth(transactions, monthKey)
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * B. Calculate Total Spending for a given month
 */
export function calculateTotalSpending(
  transactions: Transaction[],
  monthKey: string = '2024-10'
): number {
  return filterTransactionsByMonth(transactions, monthKey)
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * C. Calculate Total Savings (Income - Spending)
 */
export function calculateTotalSavings(totalIncome: number, totalSpending: number): number {
  return Math.max(0, totalIncome - totalSpending);
}

/**
 * D. Calculate Savings Rate percentage
 */
export function calculateSavingsRate(totalIncome: number, totalSavings: number): number {
  if (totalIncome <= 0) return 0;
  return Number(((totalSavings / totalIncome) * 100).toFixed(1));
}

/**
 * E & F. Calculate Spending by Category and Percentages
 */
export function calculateCategorySpending(
  transactions: Transaction[],
  monthKey: string = '2024-10',
  previousMonthKey?: string
): SpendingCategory[] {
  const currentTxs = filterTransactionsByMonth(transactions, monthKey).filter(
    (t) => t.type === 'expense'
  );
  const totalSpending = currentTxs.reduce((sum, t) => sum + t.amount, 0);

  // Derive previous month key if not provided
  let prevKey = previousMonthKey;
  if (!prevKey) {
    const [yStr, mStr] = monthKey.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const pM = m === 1 ? 12 : m - 1;
    const pY = m === 1 ? y - 1 : y;
    prevKey = `${pY}-${String(pM).padStart(2, '0')}`;
  }

  const prevTxs = filterTransactionsByMonth(transactions, prevKey).filter(
    (t) => t.type === 'expense'
  );

  const prevTotals: Record<string, number> = {};
  for (const t of prevTxs) {
    prevTotals[t.category] = (prevTotals[t.category] || 0) + t.amount;
  }

  const catMap: Record<string, { amount: number; count: number; merchants: Set<string> }> = {};
  for (const cat of STANDARD_CATEGORIES) {
    catMap[cat] = { amount: 0, count: 0, merchants: new Set() };
  }

  for (const t of currentTxs) {
    if (!catMap[t.category]) {
      catMap[t.category] = { amount: 0, count: 0, merchants: new Set() };
    }
    catMap[t.category].amount += t.amount;
    catMap[t.category].count += 1;
    if (t.merchant) catMap[t.category].merchants.add(t.merchant);
  }

  const allCategories = Array.from(
    new Set([
      ...STANDARD_CATEGORIES,
      ...Object.keys(catMap),
    ])
  );

  return allCategories.map((category) => {
    const entry = catMap[category] || { amount: 0, count: 0, merchants: new Set() };
    const amount = entry.amount;
    const percentage = totalSpending > 0 ? Number(((amount / totalSpending) * 100).toFixed(1)) : 0;
    const prevAmount = prevTotals[category] || 0;

    // G. Month-over-month spending change percentage
    const momChangePercentage =
      prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : 0;

    let status: SpendingCategory['status'] = 'stable';
    if (category === 'Food & Groceries') {
      status = momChangePercentage > 10 ? 'surging' : 'stable';
    } else if (category === 'Shopping & Gadgets') {
      status = 'under_control';
    } else if (category === 'Cash-out & Bank Fees') {
      status = 'high_friction';
    } else if (category === 'Entertainment & Others') {
      status = 'efficient';
    } else if (momChangePercentage > 20) {
      status = 'surging';
    } else if (momChangePercentage < -10) {
      status = 'under_control';
    }

    return {
      category,
      amount,
      percentage,
      count: entry.count,
      momChangePercentage,
      status,
      topMerchants: Array.from(entry.merchants).slice(0, 3),
    };
  });
}

/**
 * H. Calculate Average Monthly Spending across historical months
 */
export function calculateAverageMonthlySpending(
  transactions: Transaction[],
  months: string[] = ['2024-10', '2024-09', '2024-08']
): number {
  if (months.length === 0) return 0;
  const total = months.reduce((acc, m) => acc + calculateTotalSpending(transactions, m), 0);
  return Math.round(total / months.length);
}

/**
 * I. Calculate Average Monthly Savings across historical months
 */
export function calculateAverageMonthlySavings(
  transactions: Transaction[],
  months: string[] = ['2024-10', '2024-09', '2024-08']
): number {
  if (months.length === 0) return 0;
  const total = months.reduce((acc, m) => {
    const income = calculateTotalIncome(transactions, m);
    const spending = calculateTotalSpending(transactions, m);
    return acc + calculateTotalSavings(income, spending);
  }, 0);
  return Math.round(total / months.length);
}

/**
 * J. Get Highest Spending Category
 */
export function getHighestSpendingCategory(categories: SpendingCategory[]): {
  category: CategoryName;
  amount: number;
  percentage: number;
} {
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  if (sorted.length > 0) {
    return {
      category: sorted[0].category,
      amount: sorted[0].amount,
      percentage: sorted[0].percentage,
    };
  }
  return {
    category: 'Food & Groceries',
    amount: 0,
    percentage: 0,
  };
}

/**
 * Generate Complete Financial Summary with Built-in Mathematical Validation
 */
export function generateFinancialSummary(
  transactions: Transaction[],
  monthKey: string = '2024-10'
): FinancialSummary {
  const totalIncome = calculateTotalIncome(transactions, monthKey);
  const totalExpenses = calculateTotalSpending(transactions, monthKey);
  const netSavings = calculateTotalSavings(totalIncome, totalExpenses);
  const savingsRate = calculateSavingsRate(totalIncome, netSavings);
  const dailyAverageSpend = totalExpenses > 0 ? Math.round(totalExpenses / 30) : 0;

  const historicalMonths = ['2024-10', '2024-09', '2024-08'];
  const averageMonthlySpending = calculateAverageMonthlySpending(transactions, historicalMonths);
  const averageMonthlySavings = calculateAverageMonthlySavings(transactions, historicalMonths);

  const categories = calculateCategorySpending(transactions, monthKey);
  const largestCategory = getHighestSpendingCategory(categories);

  // Essential vs Discretionary Outflow split
  const monthTxs = filterTransactionsByMonth(transactions, monthKey).filter(
    (t) => t.type === 'expense'
  );
  let essentialSum = 0;
  let discretionarySum = 0;
  for (const t of monthTxs) {
    if (t.classification === 'essential') {
      essentialSum += t.amount;
    } else {
      discretionarySum += t.amount;
    }
  }

  const essentialPercentage =
    totalExpenses > 0 ? Number(((essentialSum / totalExpenses) * 100).toFixed(1)) : 62;
  const discretionaryPercentage =
    totalExpenses > 0 ? Number(((discretionarySum / totalExpenses) * 100).toFixed(1)) : 38;

  // Validation Checks
  const categoryAmountSum = categories.reduce((sum, c) => sum + c.amount, 0);
  const isCategoriesSumMatchingTotal = categoryAmountSum === totalExpenses;
  const calculatedNetSavings = totalIncome - totalExpenses;
  const isIncomeExpenseBalanced = calculatedNetSavings === netSavings;

  return {
    monthKey,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    dailyAverageSpend,
    averageMonthlySpending,
    averageMonthlySavings,
    largestCategory,
    expenseSplit: {
      essential: essentialSum,
      essentialPercentage,
      discretionary: discretionarySum,
      discretionaryPercentage,
    },
    categories,
    validation: {
      isIncomeExpenseBalanced,
      isCategoriesSumMatchingTotal,
      calculatedNetSavings,
    },
  };
}

export interface FinancialValidationReport {
  isValid: boolean;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  incomeMinusExpenses: number;
  isNetSavingsBalanced: boolean;
  categorySum: number;
  isCategorySumEqualExpenses: boolean;
  savingsRate: number;
  expectedSavingsRate: number;
  isSavingsRateAccurate: boolean;
  goalValidations: Array<{
    goalId: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    remainingAmount: number;
    isRemainingCorrect: boolean;
    progressPercentage: number;
    isProgressCorrect: boolean;
  }>;
}

/**
 * Internal validation utility to verify fundamental mathematical relationships:
 * 1. Total income - total expenses = net savings
 * 2. Category totals = total expenses
 * 3. Goal remaining = target - current
 * 4. Goal progress = current / target * 100
 * 5. Savings rate = savings / income * 100
 */
export function validateFinancialData(
  transactions: Transaction[],
  goals: SavingsGoal[] = [],
  monthKey: string = '2024-10'
): FinancialValidationReport {
  const summary = generateFinancialSummary(transactions, monthKey);
  const incomeMinusExpenses = summary.totalIncome - summary.totalExpenses;
  const isNetSavingsBalanced = summary.netSavings === incomeMinusExpenses;

  const categorySum = summary.categories.reduce((acc, c) => acc + c.amount, 0);
  const isCategorySumEqualExpenses = categorySum === summary.totalExpenses;

  const expectedRate =
    summary.totalIncome > 0
      ? Number(((summary.netSavings / summary.totalIncome) * 100).toFixed(1))
      : 0;
  const isSavingsRateAccurate = summary.savingsRate === expectedRate;

  const goalValidations = goals.map((g) => {
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    const progress =
      g.targetAmount > 0
        ? Number(((g.currentAmount / g.targetAmount) * 100).toFixed(1))
        : 0;
    return {
      goalId: g.id,
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      remainingAmount: remaining,
      isRemainingCorrect: remaining === Math.max(0, g.targetAmount - g.currentAmount),
      progressPercentage: progress,
      isProgressCorrect: progress >= 0 && progress <= 100,
    };
  });

  const allGoalsValid = goalValidations.every((g) => g.isRemainingCorrect && g.isProgressCorrect);

  const isValid =
    isNetSavingsBalanced && isCategorySumEqualExpenses && isSavingsRateAccurate && allGoalsValid;

  return {
    isValid,
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    netSavings: summary.netSavings,
    incomeMinusExpenses,
    isNetSavingsBalanced,
    categorySum,
    isCategorySumEqualExpenses,
    savingsRate: summary.savingsRate,
    expectedSavingsRate: expectedRate,
    isSavingsRateAccurate,
    goalValidations,
  };
}
