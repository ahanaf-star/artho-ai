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
  const dailyBurn = nonRecurringExpenses.length > 0 ? Math.round(totalNonRecurring / 30) : 0;

  // Hypothetical simulation: 15% discretionary trim (max ৳300/day) applied only to projected curve
  const simulationSaving = simulateExpenseCut ? Math.min(300, Math.round(dailyBurn * 0.15)) : 0;
  const effectiveDailyBurn = Math.max(0, dailyBurn - simulationSaving);

  // Active recurring obligations
  const activeObligations = recurringObligations.filter((o) => o.isEnabled);
  const upcomingBills = activeObligations.reduce((sum, o) => sum + o.amount, 0);
  const recommendedBuffer =
    upcomingBills > 0 ? Math.round(upcomingBills + dailyBurn * 7) : Math.round(startingBalance * 0.15);

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

  const activeObligations = recurringObligations.filter((o) => o.isEnabled);
  const upcomingBills = activeObligations.reduce((sum, o) => sum + o.amount, 0);

  const recurringInflows = transactions.filter((t) => t.type === 'income' && t.isRecurring);
  const expectedInflows = recurringInflows.reduce((sum, t) => sum + t.amount, 0);

  const nonRecurringExpenses = transactions.filter(
    (t) => t.type === 'expense' && !t.isRecurring
  );
  const totalNonRecurring = nonRecurringExpenses.reduce((sum, t) => sum + t.amount, 0);
  const dailyBurn = nonRecurringExpenses.length > 0 ? Math.round(totalNonRecurring / 30) : 0;

  const recommendedBuffer =
    upcomingBills > 0 ? Math.round(upcomingBills + dailyBurn * 7) : Math.round(startingBalance * 0.15);

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

  let aiAdvice = '';
  if (upcomingBills === 0 && startingBalance === 0 && transactions.length === 0) {
    aiAdvice =
      'No transactions or recurring obligations configured yet. Add your verified accounts and regular bills to generate an authentic cash-flow forecast.';
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
  };
}
