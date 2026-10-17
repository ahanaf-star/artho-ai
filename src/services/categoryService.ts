import { Transaction } from '../types/financial';
import { getPreviousMonth } from './financialCalculations';

export interface CategorySummaryDetails {
  categoryName: string;
  icon: string;
  selectedMonth: string;
  totalSpentInMonth: number;
  totalSpentAllTime: number;
  transactionCountInMonth: number;
  transactionCountAllTime: number;
  averageTransactionInMonth: number;
  largestTransactionInMonth: Transaction | null;
  prevMonthTotal: number;
  momChangePercentage: number;
  momDiffAmount: number;
  topMerchantsInMonth: Array<{ merchant: string; amount: number; count: number }>;
  percentageOfMonthlyExpenses: number;
  budgetCap: number;
  budgetUsagePercentage: number;
  remainingBudget: number;
  status: 'surging' | 'under_control' | 'stable' | 'high_friction' | 'efficient';
  statusLabel: string;
  transactionsInMonth: Transaction[];
  allCategoryTransactions: Transaction[];
}

/**
 * Returns a high-quality Material Symbol icon name dynamically for ANY category.
 * Supports standard categories, Bengali names, and dynamic user custom categories
 * (e.g., Health, Medicine, Education, Travel, Pets, Rent, Internet, etc.).
 */
export function getCategoryIcon(categoryName: string): string {
  if (!categoryName) return 'category';
  const name = categoryName.trim().toLowerCase();

  if (
    name.includes('food') ||
    name.includes('grocer') ||
    name.includes('dine') ||
    name.includes('dining') ||
    name.includes('restaurant') ||
    name.includes('bazaar') ||
    name.includes('bazar')
  ) {
    return 'restaurant';
  }

  if (
    name.includes('transport') ||
    name.includes('commute') ||
    name.includes('cng') ||
    name.includes('bus') ||
    name.includes('uber') ||
    name.includes('pathao') ||
    name.includes('metro') ||
    name.includes('fuel') ||
    name.includes('octane') ||
    name.includes('petrol') ||
    name.includes('diesel')
  ) {
    return 'directions_subway';
  }

  if (
    name.includes('shop') ||
    name.includes('gadget') ||
    name.includes('cloth') ||
    name.includes('dress') ||
    name.includes('apparel') ||
    name.includes('electronics') ||
    name.includes('device')
  ) {
    return 'shopping_bag';
  }

  if (
    name.includes('util') ||
    name.includes('electric') ||
    name.includes('power') ||
    name.includes('desco') ||
    name.includes('dpdc') ||
    name.includes('nesco') ||
    name.includes('gas') ||
    name.includes('titas') ||
    name.includes('water') ||
    name.includes('wasa') ||
    name.includes('internet') ||
    name.includes('wifi') ||
    name.includes('broadband') ||
    name.includes('bill')
  ) {
    return 'bolt';
  }

  if (
    name.includes('cash') ||
    name.includes('fee') ||
    name.includes('atm') ||
    name.includes('charge') ||
    name.includes('cash-out') ||
    name.includes('cashout') ||
    name.includes('bank fee')
  ) {
    return 'price_change';
  }

  if (
    name.includes('entertain') ||
    name.includes('movie') ||
    name.includes('cinema') ||
    name.includes('game') ||
    name.includes('netflix') ||
    name.includes('spotify') ||
    name.includes('play')
  ) {
    return 'movie';
  }

  if (
    name.includes('medicine') ||
    name.includes('pharma') ||
    name.includes('drug') ||
    name.includes('prescription')
  ) {
    return 'medical_services';
  }

  if (
    name.includes('health') ||
    name.includes('medic') ||
    name.includes('doctor') ||
    name.includes('hospital') ||
    name.includes('clinic') ||
    name.includes('square hospital') ||
    name.includes('evercare')
  ) {
    return 'health_and_safety';
  }

  if (
    name.includes('educat') ||
    name.includes('tuit') ||
    name.includes('school') ||
    name.includes('college') ||
    name.includes('uni') ||
    name.includes('varsity') ||
    name.includes('book') ||
    name.includes('course') ||
    name.includes('exam')
  ) {
    return 'school';
  }

  if (
    name.includes('travel') ||
    name.includes('tour') ||
    name.includes('hotel') ||
    name.includes('resort') ||
    name.includes('flight') ||
    name.includes('biman')
  ) {
    return 'flight';
  }

  if (
    name.includes('pet') ||
    name.includes('dog') ||
    name.includes('cat') ||
    name.includes('vet')
  ) {
    return 'pets';
  }

  if (
    name.includes('rent') ||
    name.includes('home') ||
    name.includes('house') ||
    name.includes('flat')
  ) {
    return 'home';
  }

  if (
    name.includes('salary') ||
    name.includes('inflow') ||
    name.includes('income') ||
    name.includes('remittance')
  ) {
    return 'payments';
  }

  if (
    name.includes('gym') ||
    name.includes('fitness') ||
    name.includes('workout') ||
    name.includes('exercise')
  ) {
    return 'fitness_center';
  }

  if (
    name.includes('saving') ||
    name.includes('invest') ||
    name.includes('vault') ||
    name.includes('dps') ||
    name.includes('fdr')
  ) {
    return 'savings';
  }

  return 'category';
}

/**
 * Returns dynamic theme styling colors for category tags and cards
 */
export function getCategoryTheme(categoryName: string): {
  bg: string;
  text: string;
  border: string;
  accent: string;
} {
  const icon = getCategoryIcon(categoryName);
  switch (icon) {
    case 'restaurant':
      return {
        bg: 'bg-orange-500/10 dark:bg-orange-500/20',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-500/30',
        accent: '#ea580c',
      };
    case 'directions_subway':
      return {
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-500/30',
        accent: '#2563eb',
      };
    case 'shopping_bag':
      return {
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
        text: 'text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-500/30',
        accent: '#4f46e5',
      };
    case 'bolt':
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30',
        accent: '#d97706',
      };
    case 'price_change':
      return {
        bg: 'bg-red-500/10 dark:bg-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500/30',
        accent: '#dc2626',
      };
    case 'movie':
      return {
        bg: 'bg-purple-500/10 dark:bg-purple-500/20',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-500/30',
        accent: '#9333ea',
      };
    case 'health_and_safety':
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        accent: '#059669',
      };
    case 'school':
      return {
        bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
        text: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-500/30',
        accent: '#0891b2',
      };
    case 'flight':
      return {
        bg: 'bg-sky-500/10 dark:bg-sky-500/20',
        text: 'text-sky-600 dark:text-sky-400',
        border: 'border-sky-500/30',
        accent: '#0284c7',
      };
    case 'medical_services':
      return {
        bg: 'bg-rose-500/10 dark:bg-rose-500/20',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-500/30',
        accent: '#e11d48',
      };
    case 'fitness_center':
      return {
        bg: 'bg-lime-500/10 dark:bg-lime-500/20',
        text: 'text-lime-600 dark:text-lime-400',
        border: 'border-lime-500/30',
        accent: '#65a30d',
      };
    case 'pets':
      return {
        bg: 'bg-teal-500/10 dark:bg-teal-500/20',
        text: 'text-teal-600 dark:text-teal-400',
        border: 'border-teal-500/30',
        accent: '#0d9488',
      };
    default:
      return {
        bg: 'bg-secondary-container/20',
        text: 'text-secondary',
        border: 'border-secondary/30',
        accent: '#006c49',
      };
  }
}

/**
 * Derives dynamic baseline budget cap for a category based on user income and category nature.
 */
export function estimateCategoryBudget(categoryName: string, monthlyIncome: number = 38500): number {
  const icon = getCategoryIcon(categoryName);
  const income = monthlyIncome > 0 ? monthlyIncome : 38500;

  switch (icon) {
    case 'restaurant': // Food & Groceries: ~25%
      return Math.round(income * 0.25);
    case 'directions_subway': // Transportation: ~12%
      return Math.round(income * 0.12);
    case 'shopping_bag': // Shopping: ~12%
      return Math.round(income * 0.12);
    case 'bolt': // Utilities: ~10%
      return Math.round(income * 0.10);
    case 'price_change': // Fees: ~2% max
      return Math.round(income * 0.02);
    case 'movie': // Entertainment: ~8%
      return Math.round(income * 0.08);
    case 'health_and_safety': // Health: ~10%
      return Math.round(income * 0.10);
    case 'school': // Education: ~15%
      return Math.round(income * 0.15);
    case 'flight': // Travel: ~10%
      return Math.round(income * 0.10);
    default:
      return Math.round(income * 0.08);
  }
}

/**
 * Reusable, robust data-driven computation for ANY category.
 * Calculates spending totals, previous month comparison, budget usage,
 * merchant aggregates, and returns isolated transaction records.
 */
export function computeCategoryDetails(
  allTransactions: Transaction[],
  categoryName: string,
  selectedMonth: string,
  monthlyIncome: number = 38500
): CategorySummaryDetails {
  const normCategory = categoryName.trim().toLowerCase();

  // 1. All transactions belonging to this category across all time
  const allCategoryTransactions = allTransactions
    .filter((t) => t.category && t.category.trim().toLowerCase() === normCategory)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // 2. Transactions in the selected month
  const transactionsInMonth = allCategoryTransactions.filter(
    (t) => t.date && t.date.startsWith(selectedMonth)
  );

  // 3. Transactions in previous month for MoM comparison
  const prevMonth = getPreviousMonth(selectedMonth);
  const prevMonthTransactions = allCategoryTransactions.filter(
    (t) => t.date && t.date.startsWith(prevMonth)
  );

  // 4. Totals & metrics
  const totalSpentInMonth = transactionsInMonth
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpentAllTime = allCategoryTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const prevMonthTotal = prevMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const countInMonth = transactionsInMonth.length;
  const countAllTime = allCategoryTransactions.length;

  const averageTransactionInMonth =
    countInMonth > 0 ? Math.round(totalSpentInMonth / countInMonth) : 0;

  // Find largest single expense in this category for the month
  const expensesInMonth = transactionsInMonth.filter((t) => t.type === 'expense');
  const largestTransactionInMonth =
    expensesInMonth.length > 0
      ? [...expensesInMonth].sort((a, b) => b.amount - a.amount)[0]
      : null;

  // 5. Total monthly expenditure across all categories for percentage calculation
  const totalMonthExpensesAllCategories = allTransactions
    .filter((t) => t.date && t.date.startsWith(selectedMonth) && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const percentageOfMonthlyExpenses =
    totalMonthExpensesAllCategories > 0
      ? Number(((totalSpentInMonth / totalMonthExpensesAllCategories) * 100).toFixed(1))
      : 0;

  // 6. MoM Comparison
  const momChangePercentage =
    prevMonthTotal > 0
      ? Math.round(((totalSpentInMonth - prevMonthTotal) / prevMonthTotal) * 100)
      : 0;
  const momDiffAmount = totalSpentInMonth - prevMonthTotal;

  // 7. Top merchants in this category
  const merchantMap: Record<string, { amount: number; count: number }> = {};
  for (const t of transactionsInMonth) {
    const m = t.merchant?.trim() || 'Unspecified Merchant';
    if (!merchantMap[m]) merchantMap[m] = { amount: 0, count: 0 };
    merchantMap[m].amount += t.amount;
    merchantMap[m].count += 1;
  }
  const topMerchantsInMonth = Object.entries(merchantMap)
    .map(([merchant, stat]) => ({ merchant, amount: stat.amount, count: stat.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // 8. Budget & pacing
  const budgetCap = estimateCategoryBudget(categoryName, monthlyIncome);
  const budgetUsagePercentage =
    budgetCap > 0 ? Math.round((totalSpentInMonth / budgetCap) * 100) : 0;
  const remainingBudget = Math.max(0, budgetCap - totalSpentInMonth);

  // 9. Status classification
  let status: CategorySummaryDetails['status'] = 'stable';
  let statusLabel = 'Predictable';

  if (totalSpentInMonth === 0) {
    status = 'stable';
    statusLabel = 'No activity';
  } else if (normCategory.includes('cash-out') || normCategory.includes('bank fee')) {
    status = 'high_friction';
    statusLabel = 'High fee friction';
  } else if (momChangePercentage > 15 || budgetUsagePercentage > 90) {
    status = 'surging';
    statusLabel = 'Surging vs base';
  } else if (momChangePercentage < -10 || (budgetCap > 0 && budgetUsagePercentage < 60)) {
    status = 'under_control';
    statusLabel = 'Under control';
  } else if (averageTransactionInMonth < 300) {
    status = 'efficient';
    statusLabel = 'Efficient';
  }

  return {
    categoryName,
    icon: getCategoryIcon(categoryName),
    selectedMonth,
    totalSpentInMonth,
    totalSpentAllTime,
    transactionCountInMonth: countInMonth,
    transactionCountAllTime: countAllTime,
    averageTransactionInMonth,
    largestTransactionInMonth,
    prevMonthTotal,
    momChangePercentage,
    momDiffAmount,
    topMerchantsInMonth,
    percentageOfMonthlyExpenses,
    budgetCap,
    budgetUsagePercentage,
    remainingBudget,
    status,
    statusLabel,
    transactionsInMonth,
    allCategoryTransactions,
  };
}
