import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionClassification, UserProfile } from '../../types/financial';
import {
  computeCategoryDetails,
  getCategoryTheme,
} from '../../services/categoryService';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  getCurrencyConfig,
} from '../../services/currencyService';
import {
  getAvailableMonths,
  formatMonthName,
} from '../../services/financialCalculations';

export interface CategoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string | null;
  transactions: Transaction[];
  user?: UserProfile | null;
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
  onSelectTransactionForEdit?: (tx: Transaction) => void;
  onOpenAddTransaction?: (prefilledCategory?: string) => void;
  isBangla?: boolean;
}

export const CategoryDetailsModal: React.FC<CategoryDetailsModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  transactions,
  user,
  selectedMonth: initialMonth,
  onSelectMonth,
  onSelectTransactionForEdit,
  onOpenAddTransaction,
  isBangla = false,
}) => {
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Active viewing period state
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  const [activeMonth, setActiveMonth] = useState<string>(initialMonth);
  const [periodMode, setPeriodMode] = useState<'month' | 'all'>('month');

  // Search & Filter within transactions
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<'all' | TransactionClassification>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Keep activeMonth synchronized with initialMonth prop
  useEffect(() => {
    if (initialMonth && initialMonth !== activeMonth) {
      setActiveMonth(initialMonth);
    }
  }, [initialMonth]);

  // Multi-currency formatter
  const userCurrency = normalizeCurrencyCode(user?.currency);
  const currConfig = getCurrencyConfig(userCurrency);
  const isForeignCurrency = userCurrency !== 'BDT';

  const formatMoney = (amountInBDT: number, opts?: { decimals?: number; roundWhole?: boolean }) => {
    const converted = convertAmount(amountInBDT, 'BDT', userCurrency);
    return formatCurrency(converted, userCurrency, opts);
  };

  // Reusable dynamic calculation
  const details = useMemo(() => {
    if (!categoryName) return null;
    const rawIncome = user?.monthlyIncome || 38500;
    const incomeCurrency = user?.monthlyIncomeCurrency || 'BDT';
    const effectiveIncome =
      user?.monthlyIncome && incomeCurrency !== 'BDT'
        ? convertAmount(rawIncome, incomeCurrency, 'BDT')
        : rawIncome;

    return computeCategoryDetails(
      transactions,
      categoryName,
      activeMonth,
      effectiveIncome
    );
  }, [transactions, categoryName, activeMonth, user?.monthlyIncome, user?.monthlyIncomeCurrency]);

  if (!isOpen || !categoryName || !details) return null;

  const theme = getCategoryTheme(categoryName);

  // Choose which transaction list to display based on periodMode
  const baseTransactions =
    periodMode === 'all' ? details.allCategoryTransactions : details.transactionsInMonth;

  // Filter & search transactions
  const filteredTransactions = baseTransactions
    .filter((tx) => {
      // Classification filter
      if (classificationFilter !== 'all' && tx.classification !== classificationFilter) {
        return false;
      }
      // Search query filter (merchant, description, location, account, notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const m = (tx.merchant || '').toLowerCase();
        const d = (tx.description || '').toLowerCase();
        const loc = (tx.location || '').toLowerCase();
        const acc = (tx.account || '').toLowerCase();
        const note = (tx.anomalyReason || '').toLowerCase();
        return (
          m.includes(q) ||
          d.includes(q) ||
          loc.includes(q) ||
          acc.includes(q) ||
          note.includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return (b.date || '').localeCompare(a.date || '');
      if (sortBy === 'date-asc') return (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

  const displayTotalSpent =
    periodMode === 'all' ? details.totalSpentAllTime : details.totalSpentInMonth;
  const displayCount =
    periodMode === 'all' ? details.transactionCountAllTime : details.transactionCountInMonth;

  const handleMonthChange = (newMonth: string) => {
    setActiveMonth(newMonth);
    setPeriodMode('month');
    if (onSelectMonth) {
      onSelectMonth(newMonth);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-primary/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-details-title"
    >
      <div className="bg-surface-container-lowest rounded-2xl max-w-4xl w-full my-auto shadow-2xl border border-outline-variant/30 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Header Strip */}
        <div className="p-4 sm:p-space-lg border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/30">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${theme.bg} ${theme.border} ${theme.text} shadow-xs`}
            >
              <span className="material-symbols-outlined text-[28px]">{details.icon}</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="category-details-title"
                  className="font-headline-md text-xl sm:text-2xl text-on-surface font-bold tracking-tight"
                >
                  {details.categoryName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary/15 text-secondary border border-secondary/25">
                  Expense Category
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    details.status === 'surging'
                      ? 'bg-error-container text-on-error-container'
                      : details.status === 'under_control'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : details.status === 'high_friction'
                      ? 'bg-error-container/80 text-error'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {details.statusLabel}
                </span>
              </div>
              <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-0.5">
                {`Comprehensive financial breakdown and transaction ledger for ${details.categoryName}`}
              </p>
            </div>
          </div>

          {/* Top Controls: Period selector & Close */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Period Mode Toggle */}
            <div className="flex items-center rounded-xl bg-surface-container-low p-1 border border-outline-variant/30 text-xs">
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  periodMode === 'month'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {formatMonthName(activeMonth, false) || activeMonth}
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  periodMode === 'all'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All-Time
              </button>
            </div>

            {/* Month Dropdown */}
            {periodMode === 'month' && availableMonths.length > 1 && (
              <select
                value={activeMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-surface-container-low text-on-surface font-title-md text-xs border border-outline-variant/30 cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary"
                aria-label="Select billing month"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m, isBangla) || m}
                  </option>
                ))}
              </select>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              aria-label="Close category details"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-space-lg overflow-y-auto flex flex-col gap-5 custom-scrollbar">
          {/* Summary KPI 4-Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-space-md">
            {/* KPI 1: Total Spent */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col justify-between relative overflow-hidden">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                {periodMode === 'all'
                  ? 'Total Spent (All-Time)'
                  : 'Total Spent This Month'}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface">
                  {formatMoney(displayTotalSpent)}
                </span>
              </div>
              {isForeignCurrency && (
                <span className="text-[11px] text-outline mt-0.5">
                  ≈ ৳{displayTotalSpent.toLocaleString()} BDT
                </span>
              )}
              <div className="mt-2 pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>
                  {periodMode === 'month'
                    ? `${details.percentageOfMonthlyExpenses}% of month outflows`
                    : `${displayCount} total record(s)`}
                </span>
              </div>
            </div>

            {/* KPI 2: Transaction Count & Average */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col justify-between">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Activity & Average
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface">
                  {displayCount}
                </span>
                <span className="text-xs text-on-surface-variant font-medium">
                  {displayCount === 1 ? 'transaction' : 'transactions'}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-outline-variant/15 flex flex-col gap-0.5 text-[11px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Average / tx:</span>
                  <span className="font-semibold text-on-surface">
                    {formatMoney(details.averageTransactionInMonth)}
                  </span>
                </div>
                {details.largestTransactionInMonth && (
                  <div className="flex justify-between truncate">
                    <span>Largest:</span>
                    <span className="font-semibold text-on-surface truncate max-w-[130px]">
                      {formatMoney(details.largestTransactionInMonth.amount)} (
                      {details.largestTransactionInMonth.merchant || 'Expense'})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* KPI 3: Month-over-Month Comparison */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col justify-between">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                MoM Spending Shift
              </span>
              <div className="mt-2 flex items-center gap-2">
                {details.prevMonthTotal > 0 ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      details.momChangePercentage > 0
                        ? 'bg-error-container text-on-error-container'
                        : details.momChangePercentage < 0
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {details.momChangePercentage > 0
                        ? 'trending_up'
                        : details.momChangePercentage < 0
                        ? 'trending_down'
                        : 'trending_flat'}
                    </span>
                    <span>
                      {details.momChangePercentage > 0
                        ? `+${details.momChangePercentage}%`
                        : `${details.momChangePercentage}%`}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-outline italic">No previous month baseline</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-outline-variant/15 flex flex-col gap-0.5 text-[11px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Last Month:</span>
                  <span className="font-medium text-on-surface">
                    {formatMoney(details.prevMonthTotal)}
                  </span>
                </div>
                {details.prevMonthTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Delta:</span>
                    <span
                      className={`font-semibold ${
                        details.momDiffAmount > 0 ? 'text-error' : 'text-secondary'
                      }`}
                    >
                      {details.momDiffAmount > 0 ? '+' : ''}
                      {formatMoney(details.momDiffAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* KPI 4: Monthly Budget & Pacing */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col justify-between">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline font-semibold">
                Budget Pacing
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-headline-lg text-lg font-bold text-on-surface">
                  {formatMoney(details.totalSpentInMonth)} / {formatMoney(details.budgetCap)}
                </span>
                <span
                  className={`text-xs font-bold ${
                    details.budgetUsagePercentage > 100
                      ? 'text-error'
                      : details.budgetUsagePercentage > 80
                      ? 'text-amber-500'
                      : 'text-secondary'
                  }`}
                >
                  {details.budgetUsagePercentage}%
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    details.budgetUsagePercentage > 100
                      ? 'bg-error'
                      : details.budgetUsagePercentage > 80
                      ? 'bg-amber-500'
                      : 'bg-secondary'
                  }`}
                  style={{ width: `${Math.min(100, details.budgetUsagePercentage)}%` }}
                />
              </div>
              <div className="mt-2 pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>
                  {details.remainingBudget > 0
                    ? `${formatMoney(details.remainingBudget)} remaining`
                    : 'Budget exceeded'}
                </span>
              </div>
            </div>
          </div>

          {/* Top Destination / Counterparties Strip */}
          {details.topMerchantsInMonth.length > 0 && (
            <div className="p-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  storefront
                </span>
                <span>Top Counterparties:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {details.topMerchantsInMonth.map((m) => (
                  <span
                    key={m.merchant}
                    className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1 border border-outline-variant/30"
                  >
                    <span>{m.merchant}</span>
                    <span className="text-[10px] text-secondary font-bold">
                      ({formatMoney(m.amount)})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Transaction Ledger Controls */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-title-lg text-base sm:text-lg font-bold text-on-surface flex items-center gap-1.5">
                  <span>Recorded Transactions</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant">
                    {filteredTransactions.length}
                  </span>
                </h3>
              </div>

              {/* Quick Actions & Add Button */}
              <div className="flex items-center gap-2 flex-wrap">
                {onOpenAddTransaction && (
                  <button
                    type="button"
                    onClick={() => onOpenAddTransaction(details.categoryName)}
                    className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-title-md text-xs font-semibold hover:opacity-95 active:scale-95 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>
                      {`+ Add ${details.categoryName} Expense`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-surface-container-low/60 p-2.5 rounded-xl border border-outline-variant/25">
              {/* Search input */}
              <div className="sm:col-span-5 relative flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-outline text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by description or merchant..."
                  className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-surface-container-lowest text-on-surface placeholder:text-outline border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>

              {/* Classification filter */}
              <div className="sm:col-span-4 flex items-center gap-1">
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value as any)}
                  className="w-full h-8 px-2 text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                  aria-label="Filter by classification"
                >
                  <option value="all">All Classifications</option>
                  <option value="essential">Essential (Needs)</option>
                  <option value="discretionary">Discretionary (Wants)</option>
                  <option value="anomalies">Anomalies & Fees</option>
                </select>
              </div>

              {/* Sort by */}
              <div className="sm:col-span-3 flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full h-8 px-2 text-xs rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                  aria-label="Sort transactions"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
              </div>
            </div>

            {/* Transaction Rows Container */}
            <div className="flex flex-col gap-2 divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden bg-surface-container-lowest">
              {filteredTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                return (
                  <div
                    key={tx.id}
                    className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-surface-container-low/40 transition-colors"
                  >
                    {/* Left: icon & details */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                          tx.isAnomaly
                            ? 'bg-error-container text-error'
                            : tx.classification === 'essential'
                            ? 'bg-secondary-container/60 text-secondary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {tx.isAnomaly
                            ? 'warning'
                            : tx.classification === 'essential'
                            ? 'task_alt'
                            : 'shopping_bag'}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-title-md text-sm font-semibold text-on-surface truncate">
                            {tx.merchant || tx.description || 'Expense Entry'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              tx.isAnomaly
                                ? 'bg-error text-on-error'
                                : tx.classification === 'essential'
                                ? 'bg-secondary-container text-on-secondary-container'
                                : 'bg-surface-container-high text-on-surface-variant'
                            }`}
                          >
                            {tx.isAnomaly
                              ? 'Fee Anomaly'
                              : tx.classification === 'essential'
                              ? 'Essential'
                              : 'Discretionary'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-0.5 flex-wrap">
                          <span className="font-medium text-outline">{tx.date}</span>
                          {tx.description && tx.description !== tx.merchant && (
                            <>
                              <span>•</span>
                              <span className="italic truncate max-w-[200px]">
                                "{tx.description}"
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-secondary">
                              account_balance_wallet
                            </span>
                            <span>{tx.account || 'Account'}</span>
                          </span>
                          {tx.location && (
                            <>
                              <span>•</span>
                              <span className="text-outline">{tx.location}</span>
                            </>
                          )}
                        </div>
                        {tx.anomalyReason && (
                          <span className="text-[10px] text-error mt-0.5 font-medium">
                            * {tx.anomalyReason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Edit Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/10">
                      <div className="flex flex-col items-start sm:items-end">
                        <span
                          className={`font-title-lg text-sm sm:text-base font-bold tabular-nums ${
                            tx.isAnomaly
                              ? 'text-error'
                              : isExpense
                              ? 'text-on-surface'
                              : 'text-secondary'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatMoney(tx.amount)}
                        </span>
                        {isForeignCurrency && (
                          <span className="text-[10px] text-outline">
                            ৳{tx.amount.toLocaleString()} BDT
                          </span>
                        )}
                        {tx.fee ? (
                          <span className="text-[10px] text-error font-medium">
                            +{formatMoney(tx.fee)} fee
                          </span>
                        ) : null}
                      </div>

                      {/* Edit Button */}
                      {onSelectTransactionForEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTransactionForEdit(tx);
                          }}
                          className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          title="Edit transaction"
                          aria-label={`Edit ${tx.merchant || tx.description}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {filteredTransactions.length === 0 && (
                <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${theme.bg} ${theme.border} ${theme.text}`}
                  >
                    <span className="material-symbols-outlined text-[32px]">{details.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-title-lg text-base font-bold text-on-surface">
                      {`No transactions found for ${details.categoryName}`}
                    </h4>
                    <p className="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
                      {searchQuery
                        ? 'Try clearing your search query or changing filters.'
                        : periodMode === 'month'
                        ? `No expenses were recorded under this category for ${formatMonthName(
                            activeMonth,
                            false
                          )}.`
                        : 'No expenses have been recorded for this category yet.'}
                    </p>
                  </div>
                  {onOpenAddTransaction && (
                    <button
                      type="button"
                      onClick={() => onOpenAddTransaction(details.categoryName)}
                      className="mt-1 px-4 py-2 rounded-xl bg-primary text-on-primary font-title-md text-xs font-bold hover:opacity-95 active:scale-95 transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      <span>
                        {`+ Add First ${details.categoryName} Expense`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-3 sm:p-space-md border-t border-outline-variant/20 flex items-center justify-between bg-surface-container-low/40">
          <span className="text-xs text-outline hidden sm:inline">
            Bank-grade encrypted • ArthoBachao AI Ledger
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-surface-container text-on-surface font-title-md text-sm hover:bg-surface-container-high transition-colors cursor-pointer w-full sm:w-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
