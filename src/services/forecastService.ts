import { CashFlowPoint, Transaction, RecurringObligation } from '../types/financial';

export interface ForecastDayItem {
  date: string;
  dayNumber: number;
  expectedIncome: number;
  expectedExpense: number;
  projectedBalance: number;
  isPressureZone: boolean;
  notes?: string;
}

export interface DetailedForecastResult {
  engineLabel: 'AI-assisted forecast';
  period: string;
  disclaimer: string;
  startingBalance: number;
  projectedMonthEnd: number;
  upcomingBills: number;
  expectedInflows: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  pressureDays: number[];
  recommendedBuffer: number;
  dailyForecast: ForecastDayItem[];
  forecastCurve: CashFlowPoint[];
  aiAdvice: string;
  isDataSufficient: boolean;
  forecastConfidence: 'High' | 'Medium' | 'Low' | 'Insufficient Data';
  dailyBurn: number;
  assumptions: string[];
}

/**
 * 30-day Cash Flow Forecast Engine
 * Calculates expected daily inflows, daily burn, scheduled obligations, and detects pressure periods.
 * Strictly uses authentic inputs: zero mock obligations, zero hardcoded rent/bills.
 */
export function generateCashFlowForecast(
  startingBalance: number = 0,
  simulateExpenseCut: boolean = false,
  transactions: Transaction[] = [],
  recurringObligations: RecurringObligation[] = [],
  horizonDays: number = 30
): CashFlowPoint[] {
  const points: CashFlowPoint[] = [];
  let balance = startingBalance;

  // Calculate authentic daily burn rate from past 30-day non-recurring expenses
  const nonRecurringExpenses = transactions.filter(
    (t) => t.type === 'expense' && !t.isRecurring
  );
  const totalNonRecurring = nonRecurringExpenses.reduce((sum, t) => sum + t.amount, 0);

  // Data Sufficiency for Statistical Daily Burn:
  // Requires at least 3 distinct non-recurring expense records to establish an authentic daily burn rate.
  // When records are sparse (< 3 transactions), do NOT invent continuous daily expenses into the future.
  const isDailyBurnSufficient = nonRecurringExpenses.length >= 3;
  const dailyBurn = isDailyBurnSufficient ? Math.round(totalNonRecurring / 30) : 0;

  // Hypothetical simulation: 15% discretionary trim (max ৳300/day) applied only to projected curve
  const simulationSaving = simulateExpenseCut ? Math.min(300, Math.round(dailyBurn * 0.15)) : 0;
  const effectiveDailyBurn = Math.max(0, dailyBurn - simulationSaving);

  // Active recurring obligations (unpaid)
  const activeObligations = recurringObligations.filter((o) => o.isEnabled && !o.isPaid);
  const upcomingBills = activeObligations.reduce((sum, o) => sum + o.amount, 0);

  // Authoritative Liquidity Safety Buffer Rule:
  // 1. Scheduled Obligations: Sum of all verified recurring obligations in horizon.
  // 2. Operating Cushion: 7 days of verified baseline daily burn (if sufficient data exists).
  // 3. If upcomingBills === 0 and dailyBurn === 0: recommendedBuffer is 0 (never an arbitrary 15% of startingBalance).
  const recommendedBuffer =
    upcomingBills > 0
      ? Math.round(upcomingBills + dailyBurn * 7)
      : (dailyBurn > 0 ? Math.round(dailyBurn * 7) : 0);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  for (let day = 1; day <= horizonDays; day++) {
    // Check if any verified obligations are due on this day
    const dayObligations = activeObligations.filter((o) => o.dueDay === day);
    const dayOutflow = dayObligations.reduce((sum, o) => sum + o.amount, 0);
    const expense = effectiveDailyBurn + dayOutflow;

    // Check if any recurring income arrives on this day
    const dayIncomeTxs = transactions.filter(
      (t) => t.type === 'income' && t.isRecurring && parseInt(t.date?.split('-')[2] || '0', 10) === day
    );
    const dayIncome = dayIncomeTxs.reduce((sum, t) => sum + t.amount, 0);

    balance = balance + dayIncome - expense;

    const isPressure = dayOutflow > 0 && balance < recommendedBuffer;
    const notes =
      dayObligations.length > 0
        ? dayObligations.map((o) => `${o.name} (৳${o.amount.toLocaleString()})`).join(', ')
        : undefined;

    points.push({
      day,
      dateLabel: `Day ${day} (${month}/${day})`,
      projectedBalance: Math.round(balance),
      expectedIncome: dayIncome,
      expectedExpense: expense,
      expectedOutflows: expense,
      isPressureZone: isPressure,
      notes,
    });
  }

  return points;
}

/**
 * Complete Detailed Forecast Object with Pressure Zone Analysis & Authenticity
 */
export function getDetailedForecast(
  startingBalance: number = 0,
  simulateExpenseCut: boolean = false,
  transactions: Transaction[] = [],
  recurringObligations: RecurringObligation[] = []
): DetailedForecastResult {
  const curve = generateCashFlowForecast(
    startingBalance,
    simulateExpenseCut,
    transactions,
    recurringObligations,
    30
  );
  const monthEndBalance = curve.length > 0 ? curve[curve.length - 1].projectedBalance : startingBalance;

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'short' });
  const year = now.getFullYear();

  const activeObligations = recurringObligations.filter((o) => o.isEnabled && !o.isPaid);
  const upcomingBills = activeObligations.reduce((sum, o) => sum + o.amount, 0);

  const recurringInflows = transactions.filter((t) => t.type === 'income' && t.isRecurring);
  const expectedInflows = recurringInflows.reduce((sum, t) => sum + t.amount, 0);

  const nonRecurringExpenses = transactions.filter(
    (t) => t.type === 'expense' && !t.isRecurring
  );
  const totalNonRecurring = nonRecurringExpenses.reduce((sum, t) => sum + t.amount, 0);
  const isDataSufficient = nonRecurringExpenses.length >= 3;
  const dailyBurn = isDataSufficient ? Math.round(totalNonRecurring / 30) : 0;

  // Authoritative Liquidity Safety Buffer Rule:
  // Derived strictly from documented scheduled obligations + 7-day operating burn.
  const recommendedBuffer =
    upcomingBills > 0
      ? Math.round(upcomingBills + dailyBurn * 7)
      : (dailyBurn > 0 ? Math.round(dailyBurn * 7) : 0);

  const pressureDays = curve.filter((p) => p.isPressureZone).map((p) => p.day);

  const dailyForecast: ForecastDayItem[] = curve.map((p) => ({
    date: `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`,
    dayNumber: p.day,
    expectedIncome: p.expectedIncome,
    expectedExpense: p.expectedExpense,
    projectedBalance: p.projectedBalance,
    isPressureZone: !!p.isPressureZone,
    notes: p.notes,
  }));

  const assumptions: string[] = [];
  if (isDataSufficient) {
    assumptions.push(`Daily burn rate of ৳${dailyBurn}/day extrapolated from ${nonRecurringExpenses.length} non-recurring expenses`);
  } else if (nonRecurringExpenses.length > 0) {
    assumptions.push(`Zero daily burn projected due to sparse expense history (${nonRecurringExpenses.length} transaction(s); min 3 required)`);
  } else {
    assumptions.push('Zero daily burn (no recorded expense history)');
  }

  if (upcomingBills > 0) {
    assumptions.push(`Scheduled recurring obligations of ৳${upcomingBills.toLocaleString()} deducted on respective due dates`);
  } else {
    assumptions.push('No scheduled recurring obligations configured');
  }

  let forecastConfidence: 'High' | 'Medium' | 'Low' | 'Insufficient Data' = 'High';
  if (transactions.length === 0 && upcomingBills === 0) {
    forecastConfidence = 'Insufficient Data';
  } else if (!isDataSufficient) {
    forecastConfidence = 'Low';
  } else if (transactions.length <= 10) {
    forecastConfidence = 'Medium';
  }

  let aiAdvice = '';
  if (upcomingBills === 0 && startingBalance === 0 && transactions.length === 0) {
    aiAdvice =
      'No transactions or recurring obligations configured yet. Add your verified accounts and regular bills to generate an authentic cash-flow forecast.';
  } else if (!isDataSufficient && upcomingBills === 0) {
    aiAdvice = `Insufficient transaction history to establish a reliable daily burn rate. Projected balance reflects current funds without inventing unrecorded living expenses.`;
  } else if (upcomingBills > 0 && pressureDays.length > 0) {
    aiAdvice = `Maintain at least ৳${recommendedBuffer.toLocaleString()} in liquid reserves before Day ${pressureDays[0]} to cover scheduled obligations smoothly.`;
  } else if (simulateExpenseCut) {
    aiAdvice =
      'Hypothetical expense trim active: Projected month-end reserve expands without affecting your live ledger transactions.';
  } else {
    aiAdvice = `Your projected month-end balance is approximately ৳${monthEndBalance.toLocaleString()}. Current burn rate remains within available liquidity.`;
  }

  return {
    engineLabel: 'AI-assisted forecast',
    period: `${monthName} 1 - ${monthName} 30, ${year}`,
    disclaimer:
      'This is an AI-assisted forecast calculated strictly from verified starting balances, historical burn rates, and scheduled commitments.',
    startingBalance,
    projectedMonthEnd: monthEndBalance,
    upcomingBills,
    expectedInflows,
    riskLevel: monthEndBalance < 0 ? 'High' : monthEndBalance < recommendedBuffer ? 'Moderate' : 'Low',
    pressureDays,
    recommendedBuffer,
    dailyForecast,
    forecastCurve: curve,
    aiAdvice,
    isDataSufficient,
    forecastConfidence,
    dailyBurn,
    assumptions,
  };
}

/**
 * Authoritative Safe Spending Limit Calculation
 * Determines safe personal spending without jeopardizing scheduled bills, savings goals, or safety reserves.
 */
export interface SafeSpendingLimitInput {
  availableBalance: number;
  isBalanceEstimated: boolean;
  upcomingBills?: number;
  monthlyGoalCommitments?: number;
  safetyBuffer?: number;
  remainingDaysInMonth?: number;
  expenseTransactionCount?: number;
}

export interface SafeSpendingLimitResult {
  availableBalance: number;
  isBalanceEstimated: boolean;
  upcomingBills: number;
  monthlyGoalCommitments: number;
  safetyBuffer: number;
  committedFunds: number;
  uncommittedDiscretionaryPool: number;
  remainingDaysInMonth: number;
  remainingWeeks: number;
  safeSpendingLimitWeekly: number;
  safeSpendingLimitDaily: number;
  isDataSufficient: boolean;
  dataDisclosures: string[];
}

export function calculateSafeSpendingLimit(input: SafeSpendingLimitInput): SafeSpendingLimitResult {
  const availableBalance = Math.max(0, input.availableBalance || 0);
  const isBalanceEstimated = !!input.isBalanceEstimated;
  const upcomingBills = Math.max(0, input.upcomingBills || 0);
  const monthlyGoalCommitments = Math.max(0, input.monthlyGoalCommitments || 0);
  const safetyBuffer = Math.max(0, input.safetyBuffer || 0);
  const remainingDaysInMonth = Math.max(1, input.remainingDaysInMonth ?? 14);
  const remainingWeeks = Math.max(0.5, Number((remainingDaysInMonth / 7).toFixed(2)));
  const expenseCount = input.expenseTransactionCount ?? 0;
  const isDataSufficient = !isBalanceEstimated && expenseCount >= 3;

  const committedFunds = upcomingBills + monthlyGoalCommitments + safetyBuffer;
  const uncommittedDiscretionaryPool = Math.max(0, availableBalance - committedFunds);

  const safeSpendingLimitWeekly = Math.round(uncommittedDiscretionaryPool / remainingWeeks);
  const safeSpendingLimitDaily = Math.round(uncommittedDiscretionaryPool / remainingDaysInMonth);

  const dataDisclosures: string[] = [];
  if (isBalanceEstimated) {
    dataDisclosures.push('No linked bank or wallet accounts detected; balance is an estimate derived from recorded transactions.');
  }
  if (expenseCount < 3) {
    dataDisclosures.push('Expense history is sparse (< 3 transactions); essential living costs (housing, groceries, utilities) appear unrecorded.');
  }
  if (committedFunds > 0) {
    dataDisclosures.push(`Committed funds of ৳${committedFunds.toLocaleString()} reserved for upcoming bills, active savings goals, and safety cushion.`);
  }

  return {
    availableBalance,
    isBalanceEstimated,
    upcomingBills,
    monthlyGoalCommitments,
    safetyBuffer,
    committedFunds,
    uncommittedDiscretionaryPool,
    remainingDaysInMonth,
    remainingWeeks,
    safeSpendingLimitWeekly,
    safeSpendingLimitDaily,
    isDataSufficient,
    dataDisclosures,
  };
}
