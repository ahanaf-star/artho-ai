// Domain Types for Artho AI
export type TransactionType = 'expense' | 'income' | 'transfer';

export type BuiltinExpenseCategory =
  | 'Food & Groceries'
  | 'Shopping & Gadgets'
  | 'Utility & Fixed Costs'
  | 'Transportation'
  | 'Cash-out & Bank Fees'
  | 'Entertainment & Others';

export type BuiltinIncomeCategory =
  | 'Salary & Inflow'
  | 'Savings & Investment';

export type BuiltinCategoryName = BuiltinExpenseCategory | BuiltinIncomeCategory;

export type CategoryName = BuiltinCategoryName | (string & {});

export interface CustomCategory {
  id: string;
  customId?: string;
  userId: string;
  name: string;
  type: 'expense' | 'income';
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionClassification = 'essential' | 'discretionary' | 'anomalies';

export interface Transaction {
  id: string;
  userId?: string;
  date: string; // ISO format: YYYY-MM-DD
  type: TransactionType;
  category: CategoryName;
  amount: number;
  description: string;
  merchant: string;
  account: 'bKash' | 'Nagad' | 'City Bank' | 'Dhaka Bank';
  paymentMethod: string; // e.g. "bKash QR Direct", "Visa Card (***4092)", "Debit Card POS"
  classification: TransactionClassification;
  isAnomaly?: boolean;
  anomalyReason?: string;
  fee?: number;
  location?: string;
  isRecurring?: boolean;
}

export interface RecurringObligation {
  id: string;
  userId?: string;
  name: string;
  amount: number;
  dueDay: number; // Day of month: 1 - 31
  category?: CategoryName | string;
  recurrenceRule: 'monthly' | 'weekly' | 'custom' | string;
  isEnabled: boolean;
  lastPaidDate?: string;
  isPaid?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  preferredLanguage: 'en' | 'bn';
  currency: string;
  timeZone?: string;
  timeFormat?: '12h' | '24h';
  lastFinancialUpdate?: string;
  createdAt: string;
  updatedAt?: string;
  tagline?: string;
  memberStatus?: string;
  city?: string;
  monthlyIncome?: number;
  monthlyIncomeCurrency?: string;
  monthlyInflowBaseline?: number;
  baselineCurrency?: string;
  riskTolerance?: 'Low' | 'Moderate' | 'Aggressive';
  primaryGoalId?: string;
  privacyStatus?: string;
  linkedAccounts: Array<{
    name: 'bKash' | 'Nagad' | 'City Bank' | 'Dhaka Bank' | string;
    balance: number;
    accountNumber: string;
    type: 'MFS' | 'Bank Account' | 'Credit Card' | string;
  }>;
  walletAccounts?: WalletAccount[];
  recurringObligations?: RecurringObligation[];
  isEmailVerified?: boolean;
}

export interface WalletAccount {
  id: string;
  userId?: string;
  countryCode?: string; // ISO 3166-1 alpha-2 e.g. 'BD', 'US', 'GB'
  country?: string; // e.g. 'Bangladesh', 'United States'
  accountType: 'Bank Account' | 'Mobile Money / Digital Wallet' | 'Cash' | 'Other Financial Account' | 'Mobile Financial Service (MFS)' | string;
  provider: string;
  displayName?: string;
  accountNumber?: string;
  currency?: string;
  balance?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserProfile = User; // Alias for backward-compatibility

export interface SavingsGoal {
  id: string;
  userId?: string;
  name?: string;
  title: string;
  category: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  monthlyPace: number;
  accountVault: string;
  status: 'On Track' | 'At Risk' | 'Completed';
  color?: string;
  notes?: string;
  milestones?: Array<{
    amount: number;
    hit: boolean;
    label: string;
  }>;
}

export interface SpendingCategory {
  category: CategoryName;
  amount: number;
  percentage: number;
  count: number;
  momChangePercentage: number;
  status: 'surging' | 'under_control' | 'stable' | 'efficient' | 'high_friction';
  topMerchants: string[];
}

export interface FinancialSummary {
  monthKey: string; // 'YYYY-MM'
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number; // percentage (0-100)
  dailyAverageSpend: number;
  averageMonthlySpending: number;
  averageMonthlySavings: number;
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
  categories: SpendingCategory[];
  validation: {
    isIncomeExpenseBalanced: boolean;
    isCategoriesSumMatchingTotal: boolean;
    calculatedNetSavings: number;
  };
}

export interface FinancialHealthFactorBreakdown {
  savingConsistency: number | null; // 0-100 or null if insufficient data
  spendingControl: number | null;    // 0-100 or null if insufficient data
  cashFlowStability: number | null;  // 0-100 or null if insufficient data
  goalProgress: number | null;       // 0-100 or null if insufficient data
}

export interface FinancialHealth {
  score: number | null; // 0-100 or null if insufficient data
  status: 'Optimal' | 'Very Good' | 'Good' | 'Fair' | 'Needs Attention' | 'Insufficient Data';
  percentile: number | null;
  factors: FinancialHealthFactorBreakdown;
  explanation: string;
  confidence?: 'high' | 'medium' | 'low';
}

export type FinancialHealthMetrics = FinancialHealth; // Alias for backward compatibility

export interface HealthScoreComponent {
  key: string;
  name: string;
  label?: string;
  score: number | null;
  weight: number;
  available: boolean;
  rawValue: number | null;
  unit?: string;
  rawUnit?: string;
  status: string;
}

export interface FinancialHealthResult {
  score: number | null;
  status: 'ok' | 'insufficient_data';
  category: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Needs Attention' | null;
  confidence: 'high' | 'medium' | 'low';
  components: HealthScoreComponent[];
  dataWindow: {
    monthsOfData: number;
    transactionCount: number;
    asOfDate?: string;
  };
  strengths?: string[];
  attentionAreas?: string[];
  percentile?: number | null;
  factors?: FinancialHealthFactorBreakdown;
  explanation?: string;
}

export interface FinancialHealthInput {
  transactions: Transaction[];
  goals: SavingsGoal[];
  monthlyIncome?: number;
  monthlyIncomeCurrency?: string;
  monthlyInflowBaseline?: number;
  baselineCurrency?: string;
  startingBalance?: number;
  asOfDate?: string;
  config?: any;
}

export interface CashFlowPoint {
  day: number;
  dateLabel: string;
  projectedBalance: number;
  expectedIncome: number;
  expectedExpense: number;
  expectedOutflows?: number;
  isPressureZone?: boolean;
  notes?: string;
}

export interface CashFlowForecast {
  period: string; // e.g. "Oct 1 - Oct 31, 2024"
  startingBalance: number;
  projectedMonthEnd: number;
  upcomingBills: number;
  expectedInflows: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  pressureDays: number[];
  forecastCurve: CashFlowPoint[];
  aiAdvice: string;
  recommendedBuffer: number;
}

export interface FinancialInsight {
  id: string;
  type:
    | 'spending_increase'
    | 'spending_decrease'
    | 'unusual_transaction'
    | 'recurring_pattern'
    | 'savings_gap'
    | 'fee_leak';
  category?: CategoryName;
  changePercent?: number;
  impactAmount?: number;
  explanation: string;
  severity: 'low' | 'medium' | 'high';
  actionRecommendations: Array<{
    step: number;
    actionText: string;
    estimatedSavings?: number;
  }>;
  confidence: number;
  date: string;
}

export interface ScenarioPlan {
  planId: 'planA' | 'planB' | 'planC';
  name: string;
  monthlyAmount: number;
  durationMonths: number;
  targetCompletionDate: string;
  badge: string;
  adjustmentNote: string;
  isRecommended?: boolean;
}

export interface GoalCalculationResult {
  goalId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  deadline: string;
  remainingMonths: number;
  requiredMonthlySavings: number;
  currentAverageMonthlySaving: number;
  monthlySavingsGap: number;
  projectedCompletionDate: string;
  scenarioPlans: ScenarioPlan[];
}

export interface AIRecommendation {
  category: string;
  currentMonthly: number;
  potentialSavings: number;
  why: string;
  actionLabel: string;
  badge: string;
  icon: string;
}

export interface CoachMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isBangla?: boolean;
  isDeterministic?: boolean;
  source?: 'ai' | 'fallback';
  factsUsed?: string[];
  followUps?: string[];
  dataGaps?: string[];
  dataWindow?: {
    currentMonth: string;
    today: string;
    hasData: boolean;
  };
  structuredData?: {
    targetVelocity?: {
      current: number;
      needed: number;
      percentage: number;
      shortfall: number;
    };
    recommendations?: AIRecommendation[];
    simulation?: {
      target: number;
      currentMonths: number;
      optimizedMonths: number;
      currentEstDate: string;
      optimizedEstDate: string;
    };
    scenarioPlans?: ScenarioPlan[];
  };
}
