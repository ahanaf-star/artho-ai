import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, SavingsGoal, UserProfile } from '../../types/financial';
import {
  calculateMonthlyOverview,
  calculateFinancialHealthScore,
  getAvailableMonths,
  getLatestTransactionMonth,
  formatMonthName,
} from '../../services/financialCalculations';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  getCurrencyConfig,
} from '../../services/currencyService';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  goals: SavingsGoal[];
  user: UserProfile;
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  transactions,
  goals,
  user,
}) => {
  if (!isOpen) return null;

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getLatestTransactionMonth(transactions)
  );

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0] || getLatestTransactionMonth(transactions));
    }
  }, [availableMonths, selectedMonth]);

  const overview = calculateMonthlyOverview(transactions, selectedMonth);
  const health = calculateFinancialHealthScore(
    transactions,
    goals,
    user.monthlyIncome,
    selectedMonth
  );

  const userCurrency = normalizeCurrencyCode(user?.currency);
  const currConfig = getCurrencyConfig(userCurrency);
  const formatMoney = (amountInBDT: number) => {
    const converted = convertAmount(amountInBDT, 'BDT', userCurrency);
    return formatCurrency(converted, userCurrency);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">
              AB
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                ArthoBachao AI Monthly Financial Statement
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-outline">
                  Billing Period: {formatMonthName(selectedMonth)}
                </span>
                {availableMonths.length > 1 && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-xs py-0.5 px-2 rounded-md border border-outline-variant/40 bg-surface-container-low text-on-surface font-medium focus:outline-none"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthName(m)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Printable Content Block */}
        <div className="flex flex-col gap-4 text-on-surface">
          {/* Member Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-low flex justify-between items-center text-sm">
            <div>
              <span className="font-bold text-on-surface">{user.name}</span> • {user.city}
              <p className="text-xs text-on-surface-variant">Linked Accounts: bKash, City Bank, Nagad</p>
              <p className="text-[11px] text-secondary font-semibold mt-0.5">
                Reporting Currency: {currConfig.name} ({currConfig.code} • {currConfig.displaySymbol})
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-outline">ArthoBachao AI Health Score</span>
              <p className="font-bold text-secondary text-lg">{health.score} / 100 ({health.status})</p>
            </div>
          </div>

          {/* Key Figures */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
              <span className="text-xs text-outline font-semibold">Total Inflow</span>
              <p className="font-bold text-lg text-on-surface mt-1">{formatMoney(overview.totalIncome)}</p>
            </div>
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
              <span className="text-xs text-outline font-semibold">Total Outflow</span>
              <p className="font-bold text-lg text-error mt-1">{formatMoney(overview.totalExpenses)}</p>
            </div>
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
              <span className="text-xs text-outline font-semibold">Net Savings</span>
              <p className="font-bold text-lg text-secondary mt-1">{formatMoney(overview.netSavings)}</p>
            </div>
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
              <span className="text-xs text-outline font-semibold">Savings Velocity</span>
              <p className="font-bold text-lg text-secondary mt-1">{overview.savingsRate}%</p>
            </div>
          </div>

          {/* Categorical Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-2">
              Categorical Expenditure Summary
            </h4>
            <div className="border border-outline-variant/20 rounded-xl overflow-hidden text-xs">
              <div className="p-2.5 bg-surface-container-low flex justify-between font-bold text-outline">
                <span>Category</span>
                <span>Amount</span>
                <span>% of Outflows</span>
              </div>
              {overview.categories.map((c) => (
                <div key={c.category} className="p-2.5 flex justify-between border-t border-outline-variant/15">
                  <span className="font-medium text-on-surface">{c.category}</span>
                  <span className="font-bold">{formatMoney(c.amount)}</span>
                  <span className="text-on-surface-variant">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Auditor Audit Notes */}
          <div className="p-3.5 rounded-xl bg-surface-container-high/40 text-xs flex flex-col gap-1.5 border border-outline-variant/20">
            <span className="font-bold text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              ArthoBachao AI Algorithmic Audit Notes
            </span>
            <div className="text-on-surface-variant leading-relaxed flex flex-col gap-1">
              <p>
                • {overview.largestCategory.amount > 0 ? (
                  <>
                    Largest outflow category: <span className="font-semibold text-on-surface">{overview.largestCategory.category}</span> at {formatMoney(overview.largestCategory.amount)} ({overview.largestCategory.percentage}% of monthly spending).
                  </>
                ) : (
                  'No expenditure recorded yet for this billing cycle.'
                )}
              </p>
              <p>
                • Discretionary outflow represents {overview.expenseSplit.discretionaryPercentage}% of expenditures ({formatMoney(overview.expenseSplit.discretionary)}). {overview.expenseSplit.discretionaryPercentage > 30 ? 'Target discretionary allocation under 30% to maximize savings velocity.' : 'Discretionary ratio meets disciplined financial limits.'}
              </p>
              {goals.length > 0 && (
                <p>
                  • Primary goal ({goals[0].title}) is currently {Math.min(100, Math.round((goals[0].currentAmount / Math.max(1, goals[0].targetAmount)) * 100))}% funded ({formatMoney(goals[0].currentAmount)} of {formatMoney(goals[0].targetAmount)}).
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/15">
          <span className="text-xs text-outline">Bank-grade encrypted report</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-title-md text-sm hover:bg-surface-container-high"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-title-md text-sm flex items-center gap-1.5 hover:opacity-95 shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
