import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionClassification, UserProfile, CustomCategory, CategoryName } from '../types/financial';
import {
  calculateMonthlyOverview,
  getLatestTransactionMonth,
  getPreviousMonth,
  normalizeTransactionCategory,
} from '../services/financialCalculations';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  getCurrencyConfig,
} from '../services/currencyService';
import { detectSpendingAnomalies } from '../services/spendingService';
import { getCategoryIcon } from '../services/categoryService';
import { CategoryDetailsModal } from './modals/CategoryDetailsModal';
import { NavScreen } from './Sidebar';

interface SpendingAnalysisProps {
  transactions: Transaction[];
  onNavigate: (screen: NavScreen) => void;
  onOpenAddTransaction: () => void;
  isBangla: boolean;
  user?: UserProfile | null;
  onCoachQuery?: (query: string) => void;
  onSelectTransactionForEdit?: (transaction: Transaction) => void;
  customCategories?: CustomCategory[];
  onCreateCategory?: (name: string) => Promise<CustomCategory | null>;
  onDeleteCategory?: (categoryId: string) => Promise<boolean>;
}

export const SpendingAnalysis: React.FC<SpendingAnalysisProps> = ({
  transactions,
  onNavigate,
  onOpenAddTransaction,
  isBangla,
  user,
  onCoachQuery,
  onSelectTransactionForEdit,
  customCategories = [],
  onCreateCategory,
  onDeleteCategory,
}) => {
  const userCurrency = normalizeCurrencyCode(user?.currency);
  const currConfig = getCurrencyConfig(userCurrency);
  const formatMoney = (amountInBDT: number, opts?: { decimals?: number; roundWhole?: boolean }) => {
    const converted = convertAmount(amountInBDT, 'BDT', userCurrency);
    return formatCurrency(converted, userCurrency, opts);
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getLatestTransactionMonth(transactions)
  );
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | TransactionClassification>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [reclassifyModalOpen, setReclassifyModalOpen] = useState(false);

  // Category Details Modal State
  const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Custom Category Management State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [deleteConfirmCatId, setDeleteConfirmCatId] = useState<string | null>(null);

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
    return calculateMonthlyOverview(
      transactions,
      selectedMonth,
      customCategories.map((c) => c.name)
    );
  }, [transactions, selectedMonth, customCategories]);

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
    return 'Primary recurring expenditure';
  }, [hasLargestCategory, categoryAnomalies, overview.largestCategory]);

  // Filter transactions for table
  const filteredTransactions = useMemo(() => {
    return transactions
      .map((t) => ({
        ...t,
        category: normalizeTransactionCategory(t) as CategoryName,
      }))
      .filter((t) => {
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

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    setCategorySuccess(null);
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError('Category name cannot be empty');
      return;
    }
    if (trimmed.length > 50) {
      setCategoryError('Category name must be 50 characters or fewer');
      return;
    }
    const standardList = [
      'food & groceries',
      'shopping & gadgets',
      'utility & fixed costs',
      'transportation',
      'cash-out & bank fees',
      'entertainment & others',
      'salary & inflow',
      'savings & investment',
    ];
    if (standardList.includes(trimmed.toLowerCase())) {
      setCategoryError('Cannot use a standard category name');
      return;
    }
    if (customCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryError('A category with this name already exists');
      return;
    }
    if (onCreateCategory) {
      setIsSubmittingCategory(true);
      try {
        await onCreateCategory(trimmed);
        setNewCategoryName('');
        setIsAddCategoryOpen(false);
        setCategorySuccess(`Category "${trimmed}" created successfully!`);
        setTimeout(() => setCategorySuccess(null), 3500);
      } catch (err: any) {
        setCategoryError(err?.message || 'Failed to create category');
      } finally {
        setIsSubmittingCategory(false);
      }
    }
  };

  const handleDeleteCategoryClick = async (catId: string, catName?: string) => {
    setCategoryError(null);
    setCategorySuccess(null);
    if (!onDeleteCategory || !catId) return;

    if (catName) {
      const txCount = transactions.filter(
        (t) => t.category.toLowerCase() === catName.toLowerCase()
      ).length;
      if (txCount > 0) {
        setCategoryError(`Cannot delete: ${txCount} transaction(s) use this category`);
        setDeleteConfirmCatId(null);
        return;
      }
    }

    setDeletingCatId(catId);
    try {
      await onDeleteCategory(catId);
      setDeleteConfirmCatId(null);
      setCategorySuccess('Category deleted successfully');
      setTimeout(() => setCategorySuccess(null), 3500);
    } catch (err: any) {
      setCategoryError(err?.message || 'Failed to delete category');
    } finally {
      setDeletingCatId(null);
    }
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
            Understand Where Your Money Goes
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
              Monthly Spending
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
                {formatMoney(overview.totalExpenses)}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{userCurrency}</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline mt-1">
              {prevMonthExpenses > 0
                ? `vs ${formatMoney(prevMonthExpenses)} last month`
                : 'No prior month record'}
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
                {formatMoney(overview.dailyAverageSpend)}
              </span>
              <span className="font-title-md text-title-md text-on-surface-variant">/day</span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary font-medium mt-1">
              {overview.totalExpenses > 0
                ? `Target ceiling: ${formatMoney(1050)}/day`
                : 'No expenses recorded'}
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
              Largest Category
            </span>
            {hasLargestCategory && (
              <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary-container font-label-sm text-label-sm font-semibold shrink-0">
                {overview.largestCategory.percentage}% of total
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
                    {formatMoney(overview.largestCategory.amount)}
                  </span>
                  {isLargestOutlier && (
                    <span className="font-body-sm text-xs px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-medium">
                      Outlier flagged
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="py-2">
                <span className="text-on-surface-variant font-body-md text-sm font-medium italic block">
                  No spending data available
                </span>
                <p className="font-body-sm text-xs text-outline mt-1">
                  No expenses recorded in selected month
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
                Add transactions to populate analysis
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
                {formatMoney(overview.expenseSplit.essential)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Discretionary ({overview.expenseSplit.discretionaryPercentage}%)
              </span>
              <span className="font-title-md text-title-md text-tertiary-container font-semibold">
                {formatMoney(overview.expenseSplit.discretionary)}
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

      {/* Manage Categories Section */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">category</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Manage Categories
                </h3>
                {customCategories.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
                    {customCategories.length} Custom
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Create and manage custom expense categories for personalized spending tracking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAddCategoryOpen((prev) => !prev);
              setCategoryError(null);
            }}
            className="px-3.5 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isAddCategoryOpen ? 'close' : 'add'}
            </span>
            <span>
              {isAddCategoryOpen ? 'Cancel' : 'Add Category'}
            </span>
          </button>
        </div>

        {/* Feedback alerts */}
        {categoryError && (
          <div className="p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm flex items-center gap-2 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
            <span>{categoryError}</span>
          </div>
        )}

        {categorySuccess && (
          <div className="p-3 rounded-xl bg-secondary-container/20 border border-secondary/30 text-secondary text-sm flex items-center gap-2 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">check_circle</span>
            <span>{categorySuccess}</span>
          </div>
        )}

        {/* Inline Add Category Form */}
        {isAddCategoryOpen && (
          <form
            onSubmit={handleCreateCategorySubmit}
            className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-outline">
                new_label
              </span>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  setCategoryError(null);
                }}
                placeholder="e.g. Healthcare, Home Renovation, Education (max 50 chars)"
                maxLength={50}
                autoFocus
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmittingCategory || !newCategoryName.trim()}
                className="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                {isSubmittingCategory ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                )}
                <span>Create</span>
              </button>
              <button
                type="button"
                disabled={isSubmittingCategory}
                onClick={() => {
                  setIsAddCategoryOpen(false);
                  setNewCategoryName('');
                  setCategoryError(null);
                }}
                className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Custom Category List / Empty State */}
        <div className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden">
          {customCategories.length === 0 ? (
            <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-1.5 bg-surface-container-low/30">
              <span className="material-symbols-outlined text-outline text-[28px]">category</span>
              <p className="font-semibold text-sm text-on-surface">
                No custom categories yet
              </p>
              <p className="text-xs text-outline max-w-sm">
                Create one to organize your spending and tailor your financial reports.
              </p>
              {!isAddCategoryOpen && (
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Category</span>
                </button>
              )}
            </div>
          ) : (
            customCategories.map((cat) => {
              const txCount = transactions.filter(
                (t) => t.category.toLowerCase() === cat.name.toLowerCase()
              ).length;
              const catIdentifier = cat.id || cat.customId || cat.name;
              const isConfirming = deleteConfirmCatId === catIdentifier;
              const isDeleting = deletingCatId === catIdentifier;

              const catIcon = getCategoryIcon(cat.name);

              return (
                <div
                  key={catIdentifier}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-container-low/40 transition-colors bg-surface-container-lowest"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedCategoryForModal(cat.name);
                      setIsCategoryModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCategoryForModal(cat.name);
                        setIsCategoryModalOpen(true);
                      }
                    }}
                    className="flex items-center gap-3 cursor-pointer group/item select-none text-left"
                    title={`View details for ${cat.name}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center shrink-0 group-hover/item:bg-secondary-container group-hover/item:text-on-secondary-container transition-colors">
                      <span className="material-symbols-outlined text-[20px] text-secondary group-hover/item:text-on-secondary-container">
                        {catIcon}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-title-md text-sm text-on-surface font-bold group-hover/item:text-secondary transition-colors">
                          {cat.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                          Custom
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-on-surface-variant">
                          Expense
                        </span>
                      </div>
                      <span className="text-[11px] text-outline">
                        {txCount > 0
                          ? `Used in ${txCount} transaction(s) • Click to inspect`
                          : 'Not used in any transactions'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryForModal(cat.name);
                        setIsCategoryModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-outline hover:text-secondary hover:bg-secondary/10 transition-colors flex items-center gap-1 text-xs"
                      title="View category details"
                    >
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      <span className="hidden sm:inline font-medium">
                        Details
                      </span>
                    </button>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                        <span className="text-[11px] text-error font-medium">
                          Confirm delete?
                        </span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteCategoryClick(cat.id || cat.customId || '', cat.name)}
                          className="px-2.5 py-1 rounded-lg bg-error text-on-error text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          {isDeleting && (
                            <span className="material-symbols-outlined text-[12px] animate-spin">
                              progress_activity
                            </span>
                          )}
                          <span>Yes</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setDeleteConfirmCatId(null)}
                          className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryError(null);
                          if (txCount > 0) {
                            setCategoryError(`Cannot delete: ${txCount} transaction(s) use this category`);
                            return;
                          }
                          setDeleteConfirmCatId(catIdentifier);
                        }}
                        className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                        title={
                          txCount > 0
                            ? `Cannot delete: ${txCount} transaction(s) use this category`
                            : 'Delete category'
                        }
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
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
            const iconName = getCategoryIcon(cat.category);
            return (
              <div
                key={cat.category}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedCategoryForModal(cat.category);
                  setIsCategoryModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCategoryForModal(cat.category);
                    setIsCategoryModalOpen(true);
                  }
                }}
                className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between hover:shadow-md hover:border-secondary/50 transition-all cursor-pointer relative border border-outline-variant/20 active:scale-[0.995] group select-none focus:outline-none focus:ring-2 focus:ring-secondary/40"
                title={`View details for ${cat.category}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        isFood || isCashOut
                          ? 'bg-error-container/40 text-error'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {iconName}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-title-lg text-title-lg text-on-surface font-bold group-hover:text-secondary transition-colors">
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
                      {formatMoney(cat.amount)}
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

                <div className="pt-space-sm bg-surface-container-low/40 -mx-space-lg -mb-space-lg p-space-md rounded-b-xl flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm border-t border-outline-variant/15 group-hover:bg-surface-container-low transition-colors">
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
                  <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-secondary group-hover:translate-x-1 transition-all">
                    chevron_right
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Recent Transaction Log with AI Classification */}
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
                      {formatMoney(tx.amount)}
                      {tx.fee ? ` + ${formatMoney(tx.fee)} fee` : ''}
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
                    title="Edit or delete transaction"
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
              Artho AI's tagger automatically categorizes entries using smart merchant signatures.
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

      {/* Dynamic Category Details Modal */}
      {isCategoryModalOpen && selectedCategoryForModal && (
        <CategoryDetailsModal
          isOpen={isCategoryModalOpen}
          onClose={() => {
            setIsCategoryModalOpen(false);
            setSelectedCategoryForModal(null);
          }}
          categoryName={selectedCategoryForModal}
          transactions={transactions}
          user={user}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onSelectTransactionForEdit={onSelectTransactionForEdit}
          onOpenAddTransaction={onOpenAddTransaction}
          isBangla={isBangla}
        />
      )}
    </div>
  );
};
