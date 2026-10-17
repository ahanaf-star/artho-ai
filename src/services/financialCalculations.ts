import {
  Transaction,
  SavingsGoal,
  FinancialHealthMetrics,
  FinancialHealthResult,
  FinancialHealthInput,
  FinancialHealthFactorBreakdown,
  HealthScoreComponent,
  CashFlowPoint,
  CategoryName,
  ScenarioPlan,
} from '../types/financial';

export interface CategorySummary {
  category: CategoryName;
  amount: number;
  percentage: number;
  count: number;
  momChangePercentage: number;
  status: 'surging' | 'under_control' | 'stable' | 'efficient' | 'high_friction';
  topMerchants: string[];
}

export interface MonthlyOverview {
  monthKey: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  dailyAverageSpend: number;
  largestCategory: {
    category: CategoryName | string;
    amount: number;
    percentage: number;
    topMerchants?: string[];
  };
  expenseSplit: {
    essential: number;
    essentialPercentage: number;
    discretionary: number;
    discretionaryPercentage: number;
  };
  categories: CategorySummary[];
}

import {
  formatCurrency,
  convertAmount,
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
  normalizeCurrencyCode,
  formatBDT as formatBDTUtil,
} from './currencyService';

export {
  formatCurrency,
  convertAmount,
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
  normalizeCurrencyCode,
};

// Format currency into Bangladeshi Taka format (e.g. ৳24,850)
export function formatBDT(amount: number): string {
  return formatBDTUtil(amount);
}

// Local date helpers to avoid UTC timezone off-by-one shifts
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatDisplayDate(dateStr: string, isBangla: boolean = false): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
  const day = d.getDate();
  const month = isBangla ? monthsBn[d.getMonth()] : monthsEn[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getPreviousMonth(monthStr: string): string {
  const [yearStr, mStr] = monthStr.split('-');
  const currYear = parseInt(yearStr, 10);
  const currMonth = parseInt(mStr, 10);
  const prevMonthNum = currMonth === 1 ? 12 : currMonth - 1;
  const prevYearNum = currMonth === 1 ? currYear - 1 : currYear;
  return `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}`;
}

export function getLatestTransactionMonth(transactions: Transaction[]): string {
  if (!transactions || transactions.length === 0) {
    return getLocalDateString().slice(0, 7);
  }
  const months = transactions
    .map((t) => (t.date ? t.date.slice(0, 7) : ''))
    .filter((m) => /^\d{4}-\d{2}$/.test(m));
  if (months.length === 0) {
    return getLocalDateString().slice(0, 7);
  }
  months.sort().reverse();
  return months[0];
}

export function getAvailableMonths(transactions: Transaction[]): string[] {
  if (!transactions || transactions.length === 0) {
    return [getLocalDateString().slice(0, 7)];
  }
  const months = Array.from(
    new Set(
      transactions
        .map((t) => (t.date ? t.date.slice(0, 7) : ''))
        .filter((m) => /^\d{4}-\d{2}$/.test(m))
    )
  );
  months.sort().reverse();
  return months.length > 0 ? months : [getLocalDateString().slice(0, 7)];
}

export function formatMonthName(monthStr: string, isBangla: boolean = false): string {
  if (!monthStr) return '';
  const [yearStr, mStr] = monthStr.split('-');
  const mIdx = (parseInt(mStr, 10) || 1) - 1;
  const monthsEn = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthsBn = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];
  const mName = isBangla ? monthsBn[mIdx] : monthsEn[mIdx];
  return `${mName} ${yearStr}`;
}

// Filter transactions by month (e.g. '2024-10')
export function filterTransactionsByMonth(
  transactions: Transaction[],
  monthStr?: string
): Transaction[] {
  const target = monthStr || getLatestTransactionMonth(transactions);
  return transactions.filter((t) => t.date && t.date.startsWith(target));
}

// Compute dynamic monthly overview
export function calculateMonthlyOverview(
  transactions: Transaction[],
  selectedMonth?: string
): MonthlyOverview {
  const activeMonth = selectedMonth || getLatestTransactionMonth(transactions);
  const currentMonthTxs = filterTransactionsByMonth(transactions, activeMonth);
  const prevMonthStr = getPreviousMonth(activeMonth);
  const prevMonthTxs = filterTransactionsByMonth(transactions, prevMonthStr);

  let totalIncome = 0;
  let totalExpenses = 0;
  let essentialExpenses = 0;
  let discretionaryExpenses = 0;

  const catMap: Record<
    string,
    { amount: number; count: number; merchants: Set<string> }
  > = {};
  const prevCatMap: Record<string, number> = {};

  // Accumulate previous month category totals
  for (const t of prevMonthTxs) {
    if (t.type === 'expense') {
      prevCatMap[t.category] = (prevCatMap[t.category] || 0) + t.amount;
    }
  }

  for (const t of currentMonthTxs) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else if (t.type === 'expense') {
      totalExpenses += t.amount;
      if (t.classification === 'essential') {
        essentialExpenses += t.amount;
      } else {
        discretionaryExpenses += t.amount;
      }

      if (!catMap[t.category]) {
        catMap[t.category] = { amount: 0, count: 0, merchants: new Set() };
      }
      catMap[t.category].amount += t.amount;
      catMap[t.category].count += 1;
      if (t.merchant) catMap[t.category].merchants.add(t.merchant);
    }
  }

  const netSavings = Math.max(0, totalIncome - totalExpenses);
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const dailyAverageSpend = totalExpenses > 0 ? Math.round(totalExpenses / 30) : 0;

  // Build categories list
  const categoryOrder: CategoryName[] = [
    'Food & Groceries',
    'Shopping & Gadgets',
    'Utility & Fixed Costs',
    'Transportation',
    'Cash-out & Bank Fees',
    'Entertainment & Others',
  ];

  const categories: CategorySummary[] = categoryOrder.map((catName) => {
    const entry = catMap[catName] || { amount: 0, count: 0, merchants: new Set() };
    const prevAmount = prevCatMap[catName] || (entry.amount > 0 ? entry.amount * 0.9 : 0);
    const pct = totalExpenses > 0 ? (entry.amount / totalExpenses) * 100 : 0;
    const momChange =
      prevAmount > 0
        ? Math.round(((entry.amount - prevAmount) / prevAmount) * 100)
        : 0;

    let status: CategorySummary['status'] = 'stable';
    if (entry.amount === 0) {
      status = 'stable';
    } else if (catName === 'Cash-out & Bank Fees' && entry.amount > 200) {
      status = 'high_friction';
    } else if (momChange > 20) {
      status = 'surging';
    } else if (momChange < -10) {
      status = 'under_control';
    } else {
      status = 'stable';
    }

    return {
      category: catName,
      amount: entry.amount,
      percentage: Number(pct.toFixed(1)),
      count: entry.count,
      momChangePercentage: momChange,
      status,
      topMerchants: Array.from(entry.merchants).slice(0, 3),
    };
  });

  // Sort to find largest
  const sorted = [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const largestCategory =
    sorted.length > 0
      ? sorted[0]
      : {
          category: '' as CategoryName,
          amount: 0,
          percentage: 0,
          count: 0,
          momChangePercentage: 0,
          status: 'stable' as const,
          topMerchants: [] as string[],
        };

  const essentialPct =
    totalExpenses > 0 ? Number(((essentialExpenses / totalExpenses) * 100).toFixed(1)) : 0;
  const discretionaryPct =
    totalExpenses > 0 ? Number(((discretionaryExpenses / totalExpenses) * 100).toFixed(1)) : 0;

  return {
    monthKey: activeMonth,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate: Number(savingsRate.toFixed(1)),
    dailyAverageSpend,
    largestCategory: {
      category: largestCategory.category,
      amount: largestCategory.amount,
      percentage: largestCategory.percentage,
      topMerchants: largestCategory.topMerchants,
    },
    expenseSplit: {
      essential: essentialExpenses,
      essentialPercentage: essentialPct,
      discretionary: discretionaryExpenses,
      discretionaryPercentage: discretionaryPct,
    },
    categories,
  };
}

export const DEFAULT_FINANCIAL_HEALTH_CONFIG = {
  weights: {
    savingsRate: 0.25,
    expenseControl: 0.25,
    emergencyFund: 0.20,
    savingsGoals: 0.20,
    cashFlowHealth: 0.10,
  },
  anchors: {
    savingsRate: [
      { x: 0.0, y: 0 },
      { x: 0.05, y: 35 },
      { x: 0.10, y: 50 },
      { x: 0.15, y: 65 },
      { x: 0.20, y: 80 },
      { x: 0.30, y: 95 },
      { x: 0.40, y: 100 },
    ],
    expenseControl: [
      { x: 0.40, y: 100 },
      { x: 0.50, y: 95 },
      { x: 0.60, y: 85 },
      { x: 0.70, y: 75 },
      { x: 0.80, y: 60 },
      { x: 0.90, y: 40 },
      { x: 1.00, y: 20 },
      { x: 1.20, y: 0 },
    ],
    emergencyFund: [
      { x: 0, y: 0 },
      { x: 1, y: 40 },
      { x: 2, y: 60 },
      { x: 3, y: 75 },
      { x: 6, y: 95 },
      { x: 12, y: 100 },
    ],
    savingsGoals: [
      { x: 0, y: 0 },
      { x: 25, y: 45 },
      { x: 50, y: 65 },
      { x: 75, y: 85 },
      { x: 100, y: 100 },
    ],
    cashFlowHealth: [
      { x: 0, y: 0 },
      { x: 0.5, y: 45 },
      { x: 1.0, y: 75 },
      { x: 2.0, y: 95 },
      { x: 3.0, y: 100 },
    ],
  },
};

export function interpolatePiecewiseLinear(
  x: number,
  anchors: Array<{ x: number; y: number }>
): number {
  if (!anchors || anchors.length === 0) return 0;
  if (x <= anchors[0].x) return anchors[0].y;
  if (x >= anchors[anchors.length - 1].x) return anchors[anchors.length - 1].y;

  for (let i = 0; i < anchors.length - 1; i++) {
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    if (x >= p1.x && x <= p2.x) {
      if (p2.x === p1.x) return p1.y;
      const t = (x - p1.x) / (p2.x - p1.x);
      return Math.round(p1.y + t * (p2.y - p1.y));
    }
  }
  return anchors[anchors.length - 1].y;
}

// Calculate the ArthoBachao AI Financial Health Score with explainability
export function calculateFinancialHealthScore(
  input: FinancialHealthInput
): FinancialHealthResult;
export function calculateFinancialHealthScore(
  transactions: Transaction[],
  goals: SavingsGoal[],
  monthlyIncome?: number,
  targetMonth?: string
): FinancialHealthMetrics;
export function calculateFinancialHealthScore(
  arg1: Transaction[] | FinancialHealthInput,
  arg2?: SavingsGoal[],
  arg3?: number,
  arg4?: string
): FinancialHealthResult | FinancialHealthMetrics {
  const isInputObject = typeof arg1 === 'object' && !Array.isArray(arg1) && 'transactions' in arg1;

  if (isInputObject) {
    const input = arg1 as FinancialHealthInput;
    const transactions = input.transactions || [];
    const goals = input.goals || [];
    const monthlyIncome = input.monthlyIncome || 0;
    const startingBalance = input.startingBalance;
    const asOfDate = input.asOfDate;
    const config = input.config || DEFAULT_FINANCIAL_HEALTH_CONFIG;

    const activeMonth = asOfDate ? asOfDate.slice(0, 7) : getLatestTransactionMonth(transactions);
    const availableMonths = getAvailableMonths(transactions);
    const monthsOfData = availableMonths.filter((m) => m <= activeMonth).length || (transactions.length > 0 ? 1 : 0);
    const currentMonthTxs = filterTransactionsByMonth(transactions, activeMonth);

    // Sanitize transactions: ignore negative or invalid amounts
    const validMonthTxs = (currentMonthTxs || []).filter(
      (t) => t && typeof t.amount === 'number' && !isNaN(t.amount) && t.amount > 0
    );

    let currentExpenses = 0;
    let currentIncome = 0;
    for (const t of validMonthTxs) {
      if (t.type === 'expense') currentExpenses += t.amount;
      else if (t.type === 'income') currentIncome += t.amount;
    }
    const effectiveIncome =
      typeof monthlyIncome === 'number' && !isNaN(monthlyIncome) && monthlyIncome > 0
        ? monthlyIncome
        : currentIncome;

    const components: HealthScoreComponent[] = [];

    // 1. savings_rate (weight 0.25)
    if (effectiveIncome <= 0) {
      components.push({
        key: 'savings_rate',
        name: 'Savings Rate',
        label: 'Savings Rate',
        score: null,
        weight: config.weights.savingsRate,
        available: false,
        rawValue: null,
        rawUnit: '%',
        unit: '%',
        status: 'zero_income',
      });
    } else {
      const netSavings = Math.max(0, effectiveIncome - currentExpenses);
      const rate = netSavings / effectiveIncome;
      const rawValue = Math.round(rate * 100);
      const score = interpolatePiecewiseLinear(rate, config.anchors.savingsRate);
      components.push({
        key: 'savings_rate',
        name: 'Savings Rate',
        label: 'Savings Rate',
        score,
        weight: config.weights.savingsRate,
        available: true,
        rawValue,
        rawUnit: '%',
        unit: '%',
        status: 'ok',
      });
    }

    // 2. expense_control (weight 0.25) - requires both income and expense data
    const expenseTxs = validMonthTxs.filter((t) => t.type === 'expense');
    if (effectiveIncome <= 0) {
      components.push({
        key: 'expense_control',
        name: 'Expense Control',
        label: 'Expense Control',
        score: null,
        weight: config.weights.expenseControl,
        available: false,
        rawValue: null,
        rawUnit: '%',
        unit: '%',
        status: 'zero_income',
      });
    } else if (expenseTxs.length === 0 && currentExpenses === 0) {
      components.push({
        key: 'expense_control',
        name: 'Expense Control',
        label: 'Expense Control',
        score: null,
        weight: config.weights.expenseControl,
        available: false,
        rawValue: null,
        rawUnit: '%',
        unit: '%',
        status: 'no_expense_data',
      });
    } else {
      const ratio = currentExpenses / effectiveIncome;
      const rawValue = Math.round(ratio * 100);
      const score = interpolatePiecewiseLinear(ratio, config.anchors.expenseControl);
      components.push({
        key: 'expense_control',
        name: 'Expense Control',
        label: 'Expense Control',
        score,
        weight: config.weights.expenseControl,
        available: true,
        rawValue,
        rawUnit: '%',
        unit: '%',
        status: 'ok',
      });
    }

    // 3. emergency_fund (weight 0.20)
    const emergencyGoal = goals.find((g) => {
      const cat = (g.category || '').toLowerCase();
      const title = (g.title || g.name || '').toLowerCase();
      return cat.includes('emergency') || title.includes('emergency') || cat.includes('জরুরি') || title.includes('জরুরি');
    });

    if (!emergencyGoal) {
      components.push({
        key: 'emergency_fund',
        name: 'Emergency Fund',
        label: 'Emergency Fund',
        score: null,
        weight: config.weights.emergencyFund,
        available: false,
        rawValue: null,
        rawUnit: 'months',
        unit: 'months',
        status: 'missing_goal',
      });
    } else {
      const monthlyBurn = currentExpenses > 0 ? currentExpenses : (effectiveIncome > 0 ? effectiveIncome * 0.6 : 20000);
      const coverageMonths = monthlyBurn > 0 ? Number((emergencyGoal.currentAmount / monthlyBurn).toFixed(1)) : 0;
      const score = interpolatePiecewiseLinear(coverageMonths, config.anchors.emergencyFund);
      components.push({
        key: 'emergency_fund',
        name: 'Emergency Fund',
        label: 'Emergency Fund',
        score,
        weight: config.weights.emergencyFund,
        available: true,
        rawValue: coverageMonths,
        rawUnit: 'months',
        unit: 'months',
        status: 'ok',
      });
    }

    // 4. savings_goals (weight 0.20)
    const validGoals = (goals || []).filter(
      (g) => g && typeof g.targetAmount === 'number' && g.targetAmount > 0
    );

    if (validGoals.length === 0) {
      components.push({
        key: 'savings_goals',
        name: 'Savings Goals',
        label: 'Savings Goals',
        score: null,
        weight: config.weights.savingsGoals,
        available: false,
        rawValue: null,
        rawUnit: '%',
        unit: '%',
        status: (goals || []).length === 0 ? 'no_goals' : 'invalid_goals',
      });
    } else {
      const avgProgress = Math.round(
        validGoals.reduce((acc, g) => {
          const current =
            typeof g.currentAmount === 'number' && !isNaN(g.currentAmount)
              ? Math.max(0, g.currentAmount)
              : 0;
          return acc + Math.min(100, (current / g.targetAmount) * 100);
        }, 0) / validGoals.length
      );
      const score = interpolatePiecewiseLinear(avgProgress, config.anchors.savingsGoals);
      components.push({
        key: 'savings_goals',
        name: 'Savings Goals',
        label: 'Savings Goals',
        score,
        weight: config.weights.savingsGoals,
        available: true,
        rawValue: avgProgress,
        rawUnit: '%',
        unit: '%',
        status: 'ok',
      });
    }

    // 5. cash_flow_health (weight 0.10)
    if (currentExpenses === 0 && effectiveIncome === 0 && (!startingBalance || startingBalance <= 0)) {
      components.push({
        key: 'cash_flow_health',
        name: 'Cash Flow Health',
        label: 'Cash Flow Health',
        score: null,
        weight: config.weights.cashFlowHealth,
        available: false,
        rawValue: null,
        rawUnit: 'ratio',
        unit: 'ratio',
        status: 'insufficient_data',
      });
    } else {
      const liquid = startingBalance !== undefined ? startingBalance : Math.max(0, effectiveIncome - currentExpenses);
      let cashBuffer = 0;
      if (currentExpenses > 0) {
        cashBuffer = Number((liquid / currentExpenses).toFixed(1));
      } else if (effectiveIncome > 0) {
        cashBuffer = Number((liquid / (effectiveIncome * 0.7)).toFixed(1));
      } else if (startingBalance !== undefined && startingBalance > 0) {
        cashBuffer = Number((startingBalance / 10000).toFixed(1));
      }
      const cashFlowScore = interpolatePiecewiseLinear(cashBuffer, config.anchors.cashFlowHealth);
      components.push({
        key: 'cash_flow_health',
        name: 'Cash Flow Health',
        label: 'Cash Flow Health',
        score: cashFlowScore,
        weight: config.weights.cashFlowHealth,
        available: true,
        rawValue: cashBuffer,
        rawUnit: 'ratio',
        unit: 'ratio',
        status: 'ok',
      });
    }

    // Check available weight sum
    const availableWeight = components.reduce((acc, c) => acc + (c.available ? c.weight : 0), 0);

    const factors: FinancialHealthFactorBreakdown = {
      savingConsistency: components.find((c) => c.key === 'savings_rate')?.score ?? null,
      spendingControl: components.find((c) => c.key === 'expense_control')?.score ?? null,
      cashFlowStability: components.find((c) => c.key === 'cash_flow_health')?.score ?? null,
      goalProgress: components.find((c) => c.key === 'savings_goals')?.score ?? null,
    };

    if (availableWeight < 0.50) {
      return {
        score: null,
        status: 'insufficient_data',
        category: null,
        confidence: 'low',
        components,
        dataWindow: {
          monthsOfData,
          transactionCount: transactions.length,
          asOfDate,
        },
        strengths: [],
        attentionAreas: [],
        factors,
        percentile: null,
        explanation: 'Insufficient transaction data to compute overall health score.',
      };
    }

    const weightedScore = Math.round(
      components.reduce((acc, c) => acc + (c.available && c.score !== null ? c.score * c.weight : 0), 0) / availableWeight
    );

    let category: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Needs Attention' = 'Good';
    if (weightedScore >= 80) category = 'Excellent';
    else if (weightedScore >= 70) category = 'Good';
    else if (weightedScore >= 55) category = 'Fair';
    else category = 'Needs Attention';

    const confidence: 'high' | 'medium' | 'low' =
      monthsOfData >= 3 ? 'high' : monthsOfData === 2 ? 'medium' : 'low';

    const strengths: string[] = [];
    const attentionAreas: string[] = [];
    for (const comp of components) {
      if (comp.available && comp.score !== null) {
        if (comp.score >= 70) {
          strengths.push(`${comp.name} is performing well (${comp.score}/100)`);
        } else {
          attentionAreas.push(`${comp.name} needs improvement (${comp.score}/100)`);
        }
      }
    }

    return {
      score: weightedScore,
      status: 'ok',
      category,
      confidence,
      components,
      dataWindow: {
        monthsOfData,
        transactionCount: transactions.length,
        asOfDate,
      },
      strengths,
      attentionAreas,
      percentile: Math.min(99, Math.max(25, Math.round(weightedScore * 0.95))),
      factors,
      explanation: `Overall Financial Health Score is ${weightedScore}/100 (${category}). Evaluated with ${confidence} confidence.`,
    };
  }

  // Positional fallback for (transactions, goals, monthlyIncome, targetMonth)
  const transactions = (arg1 as Transaction[]) || [];
  const goals = arg2 || [];
  const monthlyIncome = arg3 !== undefined ? arg3 : 0;
  const targetMonth = arg4;

  const result = calculateFinancialHealthScore({
    transactions,
    goals,
    monthlyIncome,
    asOfDate: targetMonth ? `${targetMonth}-01` : undefined,
  });

  const scoreVal = result.score;
  const statusVal =
    result.score === null
      ? 'Insufficient Data'
      : (result.category || 'Good');

  return {
    score: scoreVal,
    status: statusVal as any,
    percentile: result.percentile ?? null,
    factors: {
      savingConsistency: result.components?.find((c) => c.key === 'savings_rate')?.score ?? null,
      spendingControl: result.components?.find((c) => c.key === 'expense_control')?.score ?? null,
      cashFlowStability: result.components?.find((c) => c.key === 'cash_flow_health')?.score ?? null,
      goalProgress: result.components?.find((c) => c.key === 'savings_goals')?.score ?? null,
    },
    explanation:
      result.explanation ||
      (result.status === 'insufficient_data'
        ? 'Insufficient transaction data to compute health score.'
        : `Overall Financial Health Score is ${scoreVal}/100.`),
  };
}

// Calculate AI Scenario plans for a goal (Conservative, Balanced, Accelerated)
export function calculateScenarioPlans(goal: SavingsGoal): ScenarioPlan[] {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  // Plan A: Conservative (Gentle)
  const conservativeMonthly = 3500;
  const conservativeMonths = Number((remaining / conservativeMonthly).toFixed(1));

  // Plan B: Balanced (Optimal / Recommended)
  const balancedMonthly = 5000;
  const balancedMonths = Number((remaining / balancedMonthly).toFixed(1));

  // Plan C: Accelerated (Sprint)
  const acceleratedMonthly = 7000;
  const acceleratedMonths = Number((remaining / acceleratedMonthly).toFixed(1));

  return [
    {
      planId: 'planA',
      name: 'Conservative Plan',
      monthlyAmount: conservativeMonthly,
      durationMonths: conservativeMonths,
      targetCompletionDate: 'Jan 2025',
      badge: 'Gentle',
      adjustmentNote: 'Zero lifestyle adjustment required',
      isRecommended: false,
    },
    {
      planId: 'planB',
      name: 'Balanced Plan',
      monthlyAmount: balancedMonthly,
      durationMonths: balancedMonths,
      targetCompletionDate: 'Dec 2024',
      badge: 'Optimal',
      adjustmentNote: 'Trim ৳900 food delivery + ৳600 weekend leisure',
      isRecommended: true,
    },
    {
      planId: 'planC',
      name: 'Accelerated Plan',
      monthlyAmount: acceleratedMonthly,
      durationMonths: acceleratedMonths,
      targetCompletionDate: 'Nov 2024',
      badge: 'Sprint',
      adjustmentNote: 'Strict pause on shopping & dining out',
      isRecommended: false,
    },
  ];
}

// Remaining savings goal amount
export function calculateRemainingGoalAmount(goal: SavingsGoal): number {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

// Required monthly savings
export function calculateRequiredMonthlySavings(
  goal: SavingsGoal,
  referenceDateStr?: string
): number {
  const remaining = calculateRemainingGoalAmount(goal);
  if (remaining <= 0) return 0;
  const now = referenceDateStr ? parseLocalDate(referenceDateStr) : new Date();
  const deadline = parseLocalDate(goal.deadline);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const diffMonths = Math.max(0.5, diffDays / 30.4);
  return Math.round(remaining / diffMonths);
}

// Goal progress percentage
export function calculateGoalProgressPercentage(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0;
  return Number(Math.min(100, (goal.currentAmount / goal.targetAmount) * 100).toFixed(1));
}

// Projected goal completion date
export function calculateProjectedGoalCompletionDate(
  goal: SavingsGoal,
  monthlyPaceOverride?: number,
  referenceDateStr?: string
): string {
  const remaining = calculateRemainingGoalAmount(goal);
  if (remaining <= 0) return 'Completed';
  const pace = monthlyPaceOverride || goal.monthlyPace || 3000;
  const monthsNeeded = Math.ceil(remaining / pace);
  const now = referenceDateStr ? parseLocalDate(referenceDateStr) : new Date();
  now.setMonth(now.getMonth() + monthsNeeded);
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

export {
  calculateTotalIncome,
  calculateTotalSpending,
  calculateTotalSavings,
  calculateSavingsRate,
  calculateCategorySpending,
  calculateAverageMonthlySpending,
  calculateAverageMonthlySavings,
  getHighestSpendingCategory,
  generateFinancialSummary,
  validateFinancialData,
} from './financialService';

export {
  getHighestSpendingCategories,
  getCategoriesIncreasing,
  getCategoriesDecreasing,
  detectSpendingAnomalies,
  detectRecurringPatterns,
  generateSpendingInsights,
} from './spendingService';

export {
  calculateCurrentAverageMonthlySaving,
  calculateMonthlySavingsGap,
  calculateCompleteGoalAnalysis,
} from './savingsService';

export {
  generateCashFlowForecast,
  getDetailedForecast,
} from './forecastService';

