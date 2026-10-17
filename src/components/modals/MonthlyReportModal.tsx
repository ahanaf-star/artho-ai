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
    selectedMonth,
    user.monthlyIncomeCurrency
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
    <div
      id="monthly-report-modal"
      className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:static print:inset-auto print:bg-transparent print:p-0 print:block print:w-full print:h-auto print:overflow-visible print:z-auto print:backdrop-blur-none"
    >
      <div
        id="monthly-report-printable"
        className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 print:static print:max-w-none print:w-full print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none print:bg-white print:text-[#0b1c30] print:gap-3.5 print:animate-none"
      >
        {/* Statement Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 print:border-b-2 print:border-[#0b1c30] print:pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs print:bg-black print:text-white print:w-9 print:h-9 print:rounded-md">
              AB
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold print:text-xl print:text-[#0b1c30]">
                ArthoBachao AI Monthly Financial Statement
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-outline print:text-xs print:text-[#334155] print:font-semibold">
                  Billing Period: {formatMonthName(selectedMonth)}
                </span>
                {availableMonths.length > 1 && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-xs py-0.5 px-2 rounded-md border border-outline-variant/40 bg-surface-container-low text-on-surface font-medium focus:outline-none print:hidden"
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
          {/* Print-only statement metadata */}
          <div className="hidden print:flex flex-col items-end text-right">
            <span className="text-[11px] font-semibold text-[#1e293b]">
              Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <span className="text-[10px] text-[#64748b] font-mono">
              Ref: STMT-{selectedMonth.replace('-', '')}
            </span>
          </div>
          {/* Screen-only close button */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low print:hidden"
            aria-label="Close statement modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Printable Content Block */}
        <div className="flex flex-col gap-4 text-on-surface print:gap-3.5">
          {/* User Profile Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-low flex justify-between items-center text-sm print:bg-[#f8f9ff] print:border print:border-[#cbd5e1] print:rounded-lg print:p-3 print:break-inside-avoid">
            <div>
              <span className="font-bold text-on-surface print:text-[#0b1c30] print:text-base">{user.name}</span> • <span className="print:text-[#475569]">{user.city}</span>
              <p className="text-xs text-on-surface-variant print:text-[#475569] print:mt-0.5">Linked Accounts: bKash, City Bank, Nagad</p>
              <p className="text-[11px] text-secondary font-semibold mt-0.5 print:text-[#006c49] print:font-bold">
                Reporting Currency: {currConfig.name} ({currConfig.code} • {currConfig.displaySymbol})
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-outline print:text-[#475569] print:font-medium">ArthoBachao AI Health Score</span>
              <p className="font-bold text-secondary text-lg print:text-[#006c49] print:text-xl">{health.score} / 100 ({health.status})</p>
            </div>
          </div>

          {/* Key Figures */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center print:grid-cols-4 print:gap-2.5 print:break-inside-avoid">
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest print:border-[#cbd5e1] print:bg-white print:rounded-lg print:p-2.5">
              <span className="text-xs text-outline font-semibold print:text-[#475569]">Total Inflow</span>
              <p className="font-bold text-lg text-on-surface mt-1 print:text-[#0b1c30]">{formatMoney(overview.totalIncome)}</p>
            </div>
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest print:border-[#cbd5e1] print:bg-white print:rounded-lg print:p-2.5">
              <span className="text-xs text-outline font-semibold print:text-[#475569]">Total Outflow</span>
              <p className="font-bold text-lg text-error mt-1 print:text-[#b91c1c]">{formatMoney(overview.totalExpenses)}</p>
            </div>
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest print:border-[#cbd5e1] print:bg-white print:rounded-lg print:p-2.5">
              <span className="text-xs text-outline font-semibold print:text-[#475569]">Net Savings</span>
              <p className="font-bold text-lg text-secondary mt-1 print:text-[#006c49]">{formatMoney(overview.netSavings)}</p>
            </div>
            <div className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest print:border-[#cbd5e1] print:bg-white print:rounded-lg print:p-2.5">
              <span className="text-xs text-outline font-semibold print:text-[#475569]">Savings Velocity</span>
              <p className="font-bold text-lg text-secondary mt-1 print:text-[#006c49]">{overview.savingsRate}%</p>
            </div>
          </div>

          {/* Categorical Breakdown */}
          <div className="print:break-inside-avoid">
            <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-2 print:text-[#1e293b] print:text-[11px] print:mb-1.5">
              Categorical Expenditure Summary
            </h4>
            <div className="border border-outline-variant/20 rounded-xl overflow-hidden text-xs print:border-[#cbd5e1] print:rounded-lg">
              <div className="p-2.5 bg-surface-container-low flex justify-between font-bold text-outline print:bg-[#f1f5f9] print:text-[#0b1c30] print:border-b print:border-[#cbd5e1]">
                <span className="w-1/2 text-left">Category</span>
                <span className="w-1/4 text-right">Amount</span>
                <span className="w-1/4 text-right">% of Outflows</span>
              </div>
              {overview.categories.map((c) => (
                <div key={c.category} className="p-2.5 flex justify-between border-t border-outline-variant/15 print:border-[#e2e8f0] print:py-2 print:text-[#0b1c30]">
                  <span className="w-1/2 text-left font-medium text-on-surface print:text-[#0b1c30]">{c.category}</span>
                  <span className="w-1/4 text-right font-bold print:text-[#0b1c30]">{formatMoney(c.amount)}</span>
                  <span className="w-1/4 text-right text-on-surface-variant print:text-[#475569]">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Auditor Audit Notes */}
          <div className="p-3.5 rounded-xl bg-surface-container-high/40 text-xs flex flex-col gap-1.5 border border-outline-variant/20 print:bg-[#f8f9ff] print:border-[#cbd5e1] print:rounded-lg print:p-3 print:break-inside-avoid">
            <span className="font-bold text-secondary flex items-center gap-1 print:text-[#006c49]">
              <span className="material-symbols-outlined text-[16px] print:hidden">verified</span>
              ArthoBachao AI Algorithmic Audit Notes
            </span>
            <div className="text-on-surface-variant leading-relaxed flex flex-col gap-1 print:text-[#334155]">
              <p>
                • {overview.largestCategory.amount > 0 ? (
                  <>
                    Largest outflow category: <span className="font-semibold text-on-surface print:text-[#0b1c30]">{overview.largestCategory.category}</span> at {formatMoney(overview.largestCategory.amount)} ({overview.largestCategory.percentage}% of monthly spending).
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

          {/* Official Print-Only Footer */}
          <div className="hidden print:flex items-center justify-between pt-3 mt-1 border-t border-[#cbd5e1] text-[10px] text-[#64748b]">
            <span>ArthoBachao AI • Bank-grade encrypted statement • Authentic digital ledger verification</span>
            <span>Confidential Financial Document</span>
          </div>
        </div>

        {/* Modal Controls / Action Buttons (Screen Only) */}
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/15 print:hidden">
          <span className="text-xs text-outline">Bank-grade encrypted report</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-title-md text-sm hover:bg-surface-container-high transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-title-md text-sm flex items-center gap-1.5 hover:opacity-95 shadow-sm active:scale-95 transition-all"
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
