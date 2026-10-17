import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionClassification } from '../types/financial';
import {
  calculateMonthlyOverview,
  formatBDT,
  getLatestTransactionMonth,
  getPreviousMonth,
} from '../services/financialCalculations';
import { detectSpendingAnomalies } from '../services/spendingService';
import { NavScreen } from './Sidebar';

interface SpendingAnalysisProps {
  transactions: Transaction[];
  onNavigate: (screen: NavScreen) => void;
  onOpenAddTransaction: () => void;
  isBangla: boolean;
  onCoachQuery?: (query: string) => void;
  onSelectTransactionForEdit?: (transaction: Transaction) => void;
}

export const SpendingAnalysis: React.FC<SpendingAnalysisProps> = ({
  transactions,
  onNavigate,
  onOpenAddTransaction: _onOpenAddTransaction,
  isBangla,
  onCoachQuery,
  onSelectTransactionForEdit,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getLatestTransactionMonth(transactions)
  );
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | TransactionClassification>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [alertActive, setAlertActive] = useState(false);
  const [occasionExcluded, setOccasionExcluded] = useState(false);
  const [reclassifyModalOpen, setReclassifyModalOpen] = useState(false);

  // Available months dynamically derived from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.substring(0, 7));
      }
    });
    const now = new Date();
    const curr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(curr);
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Keep selectedMonth synchronized when transactions change
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const getMonthLabel = (m: string) => {
    try {
      const [y, mon] = m.split('-').map(Number);
      const d = new Date(y, mon - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return m;
    }
  };

  // Dynamic calculations based on selected month
  const overview = useMemo(() => {
    return calculateMonthlyOverview(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  // Dynamic previous month comparison for Monthly Spending Card
  const prevMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);
  const prevMonthExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.date && t.date.startsWith(prevMonth) && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, prevMonth]);

  const momSpendingDiff = useMemo(() => {
    if (prevMonthExpenses <= 0) return null;
    return Math.round(((overview.totalExpenses - prevMonthExpenses) / prevMonthExpenses) * 100);
  }, [overview.totalExpenses, prevMonthExpenses]);

  // Outlier detection dynamically derived from actual transaction records for selected month
  const monthAnomalies = useMemo(() => {
    return detectSpendingAnomalies(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  const hasLargestCategory =
    overview.totalExpenses > 0 &&
    !!overview.largestCategory?.category &&
    overview.largestCategory.amount > 0;

  const categoryAnomalies = useMemo(() => {
    if (!hasLargestCategory) return [];
    return monthAnomalies.filter((a) => a.category === overview.largestCategory.category);
  }, [monthAnomalies, hasLargestCategory, overview.largestCategory]);

  const isLargestOutlier = categoryAnomalies.length > 0;

  const keyDriverText = useMemo(() => {
    if (!hasLargestCategory) return '';
    if (categoryAnomalies.length > 0 && categoryAnomalies[0].anomalyReason) {
      return categoryAnomalies[0].anomalyReason;
    }
    const topM = overview.largestCategory.topMerchants;
    if (topM && topM.length > 0) {
      return `Key merchant: ${topM[0]}`;
    }
    return isBangla ? 'শীর্ষ নিয়মিত ব্যয়' : 'Primary recurring expenditure';
  }, [hasLargestCategory, categoryAnomalies, overview.largestCategory, isBangla]);

  // Filter transactions for table
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchMonth = t.date.startsWith(selectedMonth);
      if (!matchMonth) return false;
      if (filterType === 'all') return true;
      if (filterType === 'anomalies') return t.isAnomaly || t.classification === 'anomalies';
      return t.classification === filterType;
    });
  }, [transactions, selectedMonth, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const monthLabels: Record<string, string> = {
    '2024-10': 'This Month (October 2024)',
    '2024-09': 'Last Month (September 2024)',
    '2024-08': 'Baseline (August 2024)',
  };

  const handleDiscussWithCoach = () => {
    if (onCoachQuery) {
      onCoachQuery('Why did my Food spending increase 14% this month and how can I cut ৳1,400?');
    }
    onNavigate('ai-coach');
  };

  return (
    <div className="flex flex-col w-full gap-space-xl pb-space-xl">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs mb-1">
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-tertiary-container font-label-sm text-label-sm uppercase tracking-wider font-bold">
              AI Intelligence Stream
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            <span className="font-label-sm text-label-sm text-secondary font-medium">
              Synced with bKash &amp; Cards
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
            {isBangla ? 'ব্যয়ের বিস্তারিত বিশ্লেষণ' : 'Understand Where Your Money Goes'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-0.5">
            Deep categorical breakdown, merchant habits, and explainable AI anomaly detection.
          </p>
        </div>

        {/* Date Filter Dropdown with Native Interactivity */}
        <div className="relative inline-block text-left">
          <button
            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
            className="inline-flex items-center gap-space-sm px-space-md py-2.5 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-low transition-colors border border-outline-variant/30"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-tertiary-container">
              calendar_month
            </span>
            <span className="font-title-md text-title-md">{getMonthLabel(selectedMonth)}</span>
            <span className="material-symbols-outlined text-[18px] text-outline">expand_more</span>
          </button>

          {isDateMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface-container-lowest shadow-xl border border-outline-variant/30 z-30 py-1.5 max-h-64 overflow-y-auto">
              {availableMonths.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonth(m);
                    setIsDateMenuOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-space-md py-2 font-body-md text-body-md hover:bg-surface-container-low transition-colors ${
                    selectedMonth === m
                      ? 'text-secondary font-bold bg-surface-container-low/50'
                      : 'text-on-surface'
                  }`}
                >
                  {getMonthLabel(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Metrics Overview Bento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Card 1: Total Spending */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm relative overflow-hidden border border-outline-variant/20">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-primary/5 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
              {isBangla ? 'মাসিক মোট ব্যয়' : 'Monthly Spending'}
            </span>
            {momSpendingDiff !== null && (
              <span
                className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                  momSpendingDiff > 0
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-secondary-container text-on-secondary-container'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {momSpendingDiff > 0 ? 'arrow_upward' : 'arrow_downward'}
                </span>
                {Math.abs(momSpendingDiff)}%
              </span>
            )}
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-1">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold">
                {formatBDT(overview.totalExpenses)}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">BDT</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline mt-1">
              {prevMonthExpenses > 0
                ? `vs ${formatBDT(prevMonthExpenses)} last month`
                : (isBangla ? 'পূর্ববর্তী মাসের রেকর্ড নেই' : 'No prior month record')}
            </p>
          </div>
          <div className="mt-space-md h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container rounded-full transition-all duration-500"
              style={{
                width:
                  overview.totalIncome > 0
                    ? `${Math.min(100, Math.round((overview.totalExpenses / overview.totalIncome) * 100))}%`
                    : overview.totalExpenses > 0
                    ? '100%'
                    : '0%',
              }}
            ></div>
          </div>
        </div>

        {/* Card 2: Daily Velocity */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm relative overflow-hidden border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
              Daily Average Spend
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">speed</span>
            </span>
          </div>
          <div className="mt-space-md">
            <div className="flex items-baseline gap-1">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold">
                {formatBDT(overview.dailyAverageSpend)}
              </span>
              <span className="font-title-md text-title-md text-on-surface-variant">/day</span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary font-medium mt-1">
              {overview.totalExpenses > 0
                ? (isBangla ? 'চলতি মাসের দৈনিক গড়' : 'Target ceiling: ৳1,050/day')
                : (isBangla ? 'কোন ব্যয় রেকর্ড নেই' : 'No expenses recorded')}
            </p>
          </div>
          {/* Mini Sparkline inline */}
          <div className="mt-space-md flex items-end gap-1 h-6">
            <div className="flex-1 bg-surface-container-highest rounded-t-sm h-3"></div>
            <div className="flex-1 bg-surface-container-highest rounded-t-sm h-4"></div>
            <div className="flex-1 bg-surface-container-highest rounded-t-sm h-3.5"></div>
            <div className="flex-1 bg-secondary-fixed-dim rounded-t-sm h-5"></div>
            <div className="flex-1 bg-surface-container-highest rounded-t-sm h-3"></div>
            <div className="flex-1 bg-secondary rounded-t-sm h-6"></div>
            <div className="flex-1 bg-surface-container-highest rounded-t-sm h-4.5"></div>
          </div>
        </div>

        {/* Card 3: Largest Category */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20">
          <div className="flex items-center justify-between gap-2">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
              {isBangla ? 'সর্বোচ্চ ব্যয় খাত' : 'Largest Category'}
            </span>
            {hasLargestCategory && (
              <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary-container font-label-sm text-label-sm font-semibold shrink-0">
                {overview.largestCategory.percentage}% {isBangla ? 'মোট ব্যয়ের' : 'of total'}
              </span>
            )}
          </div>
          <div className="mt-space-md">
            {hasLargestCategory ? (
              <>
                <span
                  title={overview.largestCategory.category}
                  className="font-headline-lg text-base sm:text-lg xl:text-headline-lg text-on-surface font-bold break-words leading-snug line-clamp-2"
                >
                  {overview.largestCategory.category}
                </span>
                <div className="flex items-center gap-space-xs mt-1.5 flex-wrap">
                  <span className="font-title-md text-title-md text-on-surface font-semibold">
                    {formatBDT(overview.largestCategory.amount)}
                  </span>
                  {isLargestOutlier && (
                    <span className="font-body-sm text-xs px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-medium">
                      {isBangla ? 'অস্বাভাবিক ব্যয় চিহ্নিত' : 'Outlier flagged'}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="py-2">
                <span className="text-on-surface-variant font-body-md text-sm font-medium italic block">
                  {isBangla ? 'কোন ব্যয়ের তথ্য নেই' : 'No spending data available'}
                </span>
                <p className="font-body-sm text-xs text-outline mt-1">
                  {isBangla ? 'নির্বাচিত মাসে কোনো ব্যয় পাওয়া যায়নি' : 'No expenses recorded in selected month'}
                </p>
              </div>
            )}
          </div>
          <div className="mt-space-md flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
            {hasLargestCategory ? (
              <>
                <span className="material-symbols-outlined text-[16px] text-tertiary-container shrink-0">
                  store
                </span>
                <span className="truncate text-xs text-on-surface-variant" title={keyDriverText}>
                  {keyDriverText}
                </span>
              </>
            ) : (
              <span className="text-xs text-outline italic">
                {isBangla ? 'লেনদেন যুক্ত করলে বিশ্লেষণ দৃশ্যমান হবে' : 'Add transactions to populate analysis'}
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Discretionary vs Essential Ratio */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
              Expense Split
            </span>
            <span className="material-symbols-outlined text-[18px] text-secondary">balance</span>
          </div>
          <div className="mt-space-sm flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Essential ({overview.expenseSplit.essentialPercentage}%)
              </span>
              <span className="font-title-md text-title-md text-on-surface font-semibold">
                {formatBDT(overview.expenseSplit.essential)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Discretionary ({overview.expenseSplit.discretionaryPercentage}%)
              </span>
              <span className="font-title-md text-title-md text-tertiary-container font-semibold">
                {formatBDT(overview.expenseSplit.discretionary)}
              </span>
            </div>
            {/* Dual segmented progress bar */}
            <div className="h-2 w-full bg-surface-container rounded-full flex overflow-hidden mt-1">
              <div
                className="bg-secondary h-full transition-all duration-500"
                style={{ width: `${overview.expenseSplit.essentialPercentage}%` }}
              ></div>
              <div
                className="bg-tertiary-container h-full transition-all duration-500"
                style={{ width: `${overview.expenseSplit.discretionaryPercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-sm text-label-sm text-outline">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span> Needs
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-tertiary-container inline-block"></span> Wants (High)
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Detailed Categorical Footprint */}
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Categorical Footprint
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Real-time expenditure patterns analyzed by AI transaction taggers
            </p>
          </div>
          <button
            onClick={() => setReclassifyModalOpen(true)}
            className="px-space-md py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-title-md text-title-md transition-colors flex items-center gap-1.5 border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Reclassify</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {overview.categories.map((cat) => {
            const isFood = cat.category === 'Food & Groceries';
            const isCashOut = cat.category === 'Cash-out & Bank Fees';
            return (
              <div
                key={cat.category}
                className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative border border-outline-variant/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isFood || isCashOut
                          ? 'bg-error-container/40 text-error'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {isFood
                          ? 'restaurant'
                          : isCashOut
                          ? 'price_change'
                          : cat.category === 'Shopping & Gadgets'
                          ? 'shopping_bag'
                          : cat.category === 'Utility & Fixed Costs'
                          ? 'bolt'
                          : cat.category === 'Transportation'
                          ? 'directions_subway'
                          : 'movie'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                        {cat.category}
                      </h3>
                      <span className="font-label-sm text-label-sm text-outline">
                        {cat.percentage}% of monthly budget
                      </span>
                    </div>
                  </div>
                  {cat.momChangePercentage !== 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-0.5 ${
                        cat.momChangePercentage > 0
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {cat.momChangePercentage > 0 ? 'trending_up' : 'trending_down'}
                      </span>
                      {cat.momChangePercentage > 0 ? `+${cat.momChangePercentage}%` : `${cat.momChangePercentage}%`}
                    </span>
                  )}
                </div>

                <div className="my-space-md">
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                      {formatBDT(cat.amount)}
                    </span>
                    <span
                      className={`font-body-sm text-body-sm font-medium ${
                        isFood
                          ? 'text-error'
                          : isCashOut
                          ? 'text-error font-semibold'
                          : 'text-secondary'
                      }`}
                    >
                      {isFood
                        ? 'Surging vs base'
                        : isCashOut
                        ? 'High fee friction'
                        : cat.category === 'Shopping & Gadgets'
                        ? 'Under control'
                        : cat.category === 'Entertainment & Others'
                        ? 'Efficient'
                        : 'Predictable'}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-low h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isFood || isCashOut
                          ? 'bg-error'
                          : cat.category === 'Shopping & Gadgets'
                          ? 'bg-primary-container'
                          : 'bg-secondary'
                      }`}
                      style={{ width: `${Math.min(100, cat.percentage * 2.8)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-space-sm bg-surface-container-low/40 -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm border-t border-outline-variant/15">
                  <span className="truncate">
                    Top:{' '}
                    <strong>
                      {cat.topMerchants.length > 0
                        ? cat.topMerchants.join(', ')
                        : isFood
                        ? 'Shwapno, Pathao Food'
                        : isCashOut
                        ? 'bKash Agent, Non-bank ATM'
                        : 'Standard merchants'}
                    </strong>
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-outline">
                    chevron_right
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Deep AI Spending Insight Card */}
      <div className="rounded-xl bg-surface-container-lowest shadow-md overflow-hidden flex flex-col border border-outline-variant/20">
        {/* AI Header Strip */}
        <div className="bg-surface-container-high px-space-lg py-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm border-b border-outline-variant/20">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-xl bg-tertiary-container flex items-center justify-center text-on-tertiary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-tertiary-container font-bold">
                ArthoBachao AI Diagnostic Engine
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface leading-snug font-bold">
                AI Spending Insight: Food &amp; Dining Surge
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold shadow-sm border border-outline-variant/30">
              Impact: -৳1,400 to Monthly Goal
            </span>
            <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
              98% Confidence
            </span>
          </div>
        </div>

        {/* Explanatory Body */}
        <div className="p-space-lg grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center">
          {/* Visual Context */}
          <div className="lg:col-span-4 flex flex-col gap-space-md">
            <div className="relative rounded-xl overflow-hidden h-48 w-full shadow-sm">
              <img
                className="object-cover w-full h-full"
                alt="Dhaka Dining out lifestyle"
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-container/85 via-transparent to-transparent flex items-end p-space-md">
                <span className="text-on-primary font-body-sm text-body-sm">
                  Dining Out peak: Fri-Sun 8:30 PM - 11:30 PM
                </span>
              </div>
            </div>
            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
              <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">
                Spending Deviation
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-title-md text-title-md text-on-surface font-bold">
                  {occasionExcluded ? '৳6,800 Recalibrated' : '৳8,200 Current'}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Baseline: ৳6,800
                </span>
              </div>
              <div className="h-2 w-full bg-surface-container rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    occasionExcluded ? 'bg-secondary' : 'bg-error'
                  }`}
                  style={{ width: occasionExcluded ? '100%' : '120%' }}
                ></div>
              </div>
            </div>
          </div>

          {/* Explanatory Reasoning & Recommendations */}
          <div className="lg:col-span-8 flex flex-col gap-space-md">
            <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div className="flex items-center gap-space-xs mb-1">
                <span className="material-symbols-outlined text-[18px] text-tertiary-container">
                  psychology
                </span>
                <h4 className="font-title-md text-title-md text-on-surface uppercase tracking-wide font-bold">
                  Why This Matters
                </h4>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Food spending reached <strong className="text-on-surface font-bold">৳8,200</strong>,
                which is <strong className="text-error font-bold">৳1,400 higher</strong> than your 3-month
                rolling baseline. Most of this increase occurred between Friday and Sunday evenings via
                quick-commerce and delivery platforms, compounding incremental surcharge delivery fees.
              </p>
            </div>

            {/* Actionable Steps */}
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs mb-1">
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  task_alt
                </span>
                <h4 className="font-title-md text-title-md text-on-surface uppercase tracking-wide font-bold">
                  What You Can Do (Estimated Savings: ৳1,400)
                </h4>
              </div>
              <ul className="flex flex-col gap-space-xs">
                <li className="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-start gap-space-sm border border-outline-variant/20">
                  <span className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface">
                    <strong>Cap weekend delivery orders</strong> to twice a week instead of 4 times
                    (potential monthly saving: <span className="text-secondary font-semibold">৳900</span>).
                  </p>
                </li>
                <li className="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-start gap-space-sm border border-outline-variant/20">
                  <span className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface">
                    <strong>Batch grocery purchases</strong> from local superstores (e.g. Shwapno) weekly to avoid small recurring delivery markups.
                  </p>
                </li>
                <li className="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-start gap-space-sm border border-outline-variant/20">
                  <span className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface">
                    Activate ArthoBachao AI's <strong>'Dining Out Budget Alert'</strong> capped at ৳1,500/week to receive pro-active nudges before checkout.
                  </p>
                </li>
              </ul>
            </div>

            {/* Action Strip Buttons */}
            <div className="flex flex-wrap items-center gap-space-sm pt-space-xs border-t border-outline-variant/15">
              <button
                onClick={() => setAlertActive(!alertActive)}
                className={`px-space-md py-2.5 rounded-xl font-title-md text-title-md shadow-sm transition-all flex items-center gap-2 ${
                  alertActive
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-primary-container text-on-primary hover:opacity-90'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-secondary-container">
                  {alertActive ? 'check_circle' : 'notifications_active'}
                </span>
                <span>
                  {alertActive ? 'Budget Alert Activated (৳1,500/wk)' : 'Activate Budget Alert (৳1,500/wk)'}
                </span>
              </button>
              <button
                onClick={() => setOccasionExcluded(!occasionExcluded)}
                className={`px-space-md py-2.5 rounded-xl font-title-md text-title-md transition-colors border border-outline-variant/30 ${
                  occasionExcluded
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                {occasionExcluded ? '✓ Excluded (Baseline Recalibrated)' : 'Exclude One-time Occasion'}
              </button>
              <button
                onClick={handleDiscussWithCoach}
                className="px-space-md py-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low text-tertiary-container font-title-md text-title-md shadow-sm transition-colors flex items-center gap-1.5 ml-auto border border-outline-variant/30"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                <span>Discuss with Coach</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Recent Transaction Log with AI Classification */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              Analyzed Transactions
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Live classified ledger with explainable automated budget tags
            </p>
          </div>

          {/* Segmented Category Filters */}
          <div className="inline-flex p-1 rounded-xl bg-surface-container shadow-inner border border-outline-variant/20">
            {(
              [
                { id: 'all', label: 'All', hasDot: false },
                { id: 'discretionary', label: 'Discretionary', hasDot: false },
                { id: 'essential', label: 'Essential', hasDot: false },
                { id: 'anomalies', label: 'Anomalies', hasDot: true },
              ] as const
            ).map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterType(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-space-md py-1.5 rounded-lg font-label-md text-label-md transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-surface-container-lowest shadow-sm text-on-surface font-bold'
                      : 'text-on-surface-variant hover:text-on-surface font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.hasDot && <span className="w-2 h-2 rounded-full bg-error"></span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Transaction List Table Container */}
        <div className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden border border-outline-variant/20">
          <div className="divide-y divide-surface-container-low">
            {paginatedTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-space-md flex items-center justify-between hover:bg-surface-container-low/50 transition-colors ${
                  tx.isAnomaly ? 'bg-error-container/10' : ''
                }`}
              >
                <div className="flex items-center gap-space-md min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.isAnomaly
                        ? 'bg-error-container text-error'
                        : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      {tx.category === 'Food & Groceries'
                        ? 'delivery_dining'
                        : tx.category === 'Transportation'
                        ? 'train'
                        : tx.category === 'Shopping & Gadgets'
                        ? 'devices'
                        : tx.category === 'Cash-out & Bank Fees'
                        ? 'atm'
                        : tx.type === 'income'
                        ? 'payments'
                        : 'receipt'}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-title-md text-title-md text-on-surface truncate font-semibold">
                        {tx.merchant}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                          tx.isAnomaly
                            ? 'bg-error text-on-error'
                            : tx.classification === 'essential'
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface-container-highest text-tertiary-container'
                        }`}
                      >
                        {tx.isAnomaly
                          ? 'Avoidable Fee'
                          : tx.classification === 'essential'
                          ? 'Essential'
                          : 'Discretionary'}
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">
                      {tx.date} • "{tx.description}" • {tx.location || tx.account}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-space-lg text-right shrink-0">
                  <div className="flex flex-col">
                    <span
                      className={`font-title-lg text-title-lg tabular-nums font-bold ${
                        tx.type === 'income'
                          ? 'text-secondary'
                          : tx.isAnomaly
                          ? 'text-error'
                          : 'text-on-surface'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatBDT(tx.amount)}
                      {tx.fee ? ` + ৳${tx.fee} fee` : ''}
                    </span>
                    <span
                      className={`font-label-sm text-label-sm ${
                        tx.isAnomaly ? 'text-error font-medium' : 'text-outline'
                      }`}
                    >
                      {tx.isAnomaly ? '1.85% MFS Charge' : tx.paymentMethod}
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectTransactionForEdit?.(tx)}
                    className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                    title={isBangla ? 'সম্পাদনা বা ডিলিট করুন' : 'Edit or delete transaction'}
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                </div>
              </div>
            ))}

            {paginatedTransactions.length === 0 && (
              <div className="p-8 text-center text-on-surface-variant">
                No transactions match the selected filter.
              </div>
            )}
          </div>

          {/* Footer Table Strip */}
          <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-outline-variant/15">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredTransactions.length)} of{' '}
              {filteredTransactions.length} categorized transactions
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-title-md text-title-md shadow-sm hover:bg-surface-container disabled:opacity-40 transition-colors border border-outline-variant/30"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-title-md text-title-md shadow-sm hover:bg-surface-container disabled:opacity-40 transition-colors border border-outline-variant/30"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reclassify Modal */}
      {reclassifyModalOpen && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Reclassify Transactions
              </h3>
              <button
                onClick={() => setReclassifyModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              ArthoBachao AI's tagger automatically categorizes entries using Dhaka merchant signatures.
              You can adjust categorization rules for recurring expenses.
            </p>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-surface-container-low flex justify-between items-center">
                <span>Pathao Food</span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-surface-container-highest text-on-surface">
                  Discretionary
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low flex justify-between items-center">
                <span>Shwapno Groceries</span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary-container text-on-secondary-container">
                  Essential
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low flex justify-between items-center">
                <span>bKash Agent Cashout</span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-error-container text-on-error-container">
                  Avoidable Fee
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setReclassifyModalOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-primary-container text-on-primary font-title-md text-title-md hover:opacity-95"
            >
              Save Rule Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
