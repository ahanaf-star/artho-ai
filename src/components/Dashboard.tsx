import React, { useState } from 'react';
import { Transaction, SavingsGoal, UserProfile } from '../types/financial';
import {
  calculateMonthlyOverview,
  calculateFinancialHealthScore,
  formatBDT,
  getLatestTransactionMonth,
  formatMonthName,
} from '../services/financialCalculations';
import { NavScreen } from './Sidebar';
import { AICoachModal } from './modals/AICoachModal';

interface DashboardProps {
  transactions: Transaction[];
  goals: SavingsGoal[];
  user: UserProfile;
  onNavigate: (screen: NavScreen) => void;
  onOpenAddTransaction: () => void;
  onOpenTransfer: () => void;
  onOpenMonthlyReport: () => void;
  onOpenCreateGoal: () => void;
  isBangla: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  goals,
  user,
  onNavigate,
  onOpenAddTransaction,
  onOpenTransfer,
  onOpenMonthlyReport,
  onOpenCreateGoal,
  isBangla,
}) => {
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);

  // Dynamic calculations based on live synthetic state
  const activeMonth = getLatestTransactionMonth(transactions);
  const overview = calculateMonthlyOverview(transactions, activeMonth);
  const healthMetrics = calculateFinancialHealthScore(transactions, goals, user.monthlyIncome, activeMonth);

  // User accounts & Total balance sum
  const accounts = user?.linkedAccounts || [];
  const totalBalance =
    accounts.length > 0
      ? accounts.reduce((acc, a) => acc + (a.balance || 0), 0)
      : Math.max(
          0,
          transactions.reduce((acc, t) => {
            if (t.type === 'income') return acc + t.amount;
            if (t.type === 'expense') return acc - t.amount;
            return acc;
          }, 0)
        );

  // Calculate 7-day net cash flow from transactions
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recent7DayTxs = transactions.filter((t) => t.date && t.date >= sevenDaysAgo);
  const net7Days = recent7DayTxs.reduce((sum, t) => {
    if (t.type === 'income') return sum + t.amount;
    if (t.type === 'expense') return sum - t.amount;
    return sum;
  }, 0);

  // Primary goal (Hero)
  const heroGoal = goals[0];
  const heroProgress = heroGoal && heroGoal.targetAmount > 0
    ? Math.min(100, (heroGoal.currentAmount / heroGoal.targetAmount) * 100)
    : 0;

  // Secondary goal
  const subGoal = goals[1];
  const subProgress = subGoal && subGoal.targetAmount > 0
    ? Math.min(100, (subGoal.currentAmount / subGoal.targetAmount) * 100)
    : 0;

  const firstName = user?.name?.trim() ? user.name.trim().split(' ')[0] : '';

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Welcome Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
              {isBangla
                ? (firstName ? `শুভ সকাল, ${firstName}` : 'শুভ সকাল')
                : (firstName ? `Good morning, ${firstName}` : 'Good morning')}
            </h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 flex items-center gap-2">
            <span>
              {isBangla
                ? 'চলতি মাসে আপনার আর্থিক অবস্থার সামগ্রিক বিবরণ'
                : "Here's how your money is doing this month"}
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
            <span className="text-on-surface-variant/80">Updated today at 09:42 AM</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            onClick={onOpenAddTransaction}
            className="flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-title-md text-title-md shadow-sm hover:opacity-95 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px] text-secondary-container">
              add_circle
            </span>
            <span>{isBangla ? '+ লেনদেন যুক্ত করুন' : 'Add Transaction'}</span>
          </button>
          <button
            onClick={onOpenTransfer}
            className="flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-lowest text-on-surface font-title-md text-title-md shadow-sm hover:bg-surface-container-low active:scale-95 transition-all border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[20px] text-secondary">sync_alt</span>
            <span>{isBangla ? 'স্থানান্তর' : 'Transfer'}</span>
          </button>
          <button
            onClick={onOpenMonthlyReport}
            className="flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-lowest text-on-surface-variant font-title-md text-title-md shadow-sm hover:text-on-surface hover:bg-surface-container-low transition-all border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            <span>{isBangla ? 'মাসিক রিপোর্ট (PDF)' : 'Monthly Report (PDF)'}</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* KPI 1: Available Balance */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow border border-outline-variant/20">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Available Balance
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                  {formatBDT(totalBalance)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary-container/40 flex items-center justify-center text-on-secondary-container">
              <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/15 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              {recent7DayTxs.length === 0 ? (
                <span className="text-on-surface-variant font-label-sm text-[11px] italic">
                  {isBangla ? 'এই সপ্তাহে লেনদেন নেই' : 'No activity this week'}
                </span>
              ) : net7Days > 0 ? (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  +{formatBDT(net7Days)} {isBangla ? 'এই সপ্তাহে' : 'this week'}
                </span>
              ) : net7Days < 0 ? (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[14px]">trending_down</span>
                  -{formatBDT(Math.abs(net7Days))} {isBangla ? 'এই সপ্তাহে' : 'this week'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold">
                  ৳0 {isBangla ? 'এই সপ্তাহে' : 'this week'}
                </span>
              )}
            </div>
            {/* Linked MFS & Bank badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {accounts.length > 0 ? (
                accounts.map((acc) => (
                  <span
                    key={acc.name}
                    className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-[10px] font-semibold"
                  >
                    {acc.name} ({formatBDT(acc.balance || 0)})
                  </span>
                ))
              ) : (
                <span className="text-on-surface-variant font-label-sm text-[11px] italic">
                  {isBangla ? 'কোন অ্যাকাউন্ট সংযুক্ত নেই' : 'No accounts connected'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Total Income */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow border border-outline-variant/20">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Total Income ({formatMonthName(activeMonth, isBangla).toUpperCase().slice(0, 3)})
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                  {formatBDT(overview.totalIncome)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {overview.totalIncome > 0
                  ? (isBangla ? 'রেকর্ডকৃত আয়' : 'Recorded Income Inflow')
                  : (isBangla ? 'কোন আয় রেকর্ড নেই' : 'No income recorded')}
              </span>
              <div className="flex items-center gap-1 text-secondary mt-0.5 font-label-sm text-label-sm font-medium">
                {overview.totalIncome > 0 ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    <span>{isBangla ? 'সফলভাবে জমা হয়েছে' : 'Deposited to accounts'}</span>
                  </>
                ) : (
                  <span className="text-outline text-xs">
                    {isBangla ? 'আয়ের লেনদেন যুক্ত করুন' : 'Add income transaction'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Spending */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow border border-outline-variant/20">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Total Spending
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                  {formatBDT(overview.totalExpenses)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-error-container/60 flex items-center justify-center text-on-error-container">
              <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between">
            {overview.totalExpenses > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
                  {formatBDT(overview.dailyAverageSpend)}/day
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {isBangla ? 'দৈনিক গড় ব্যয়' : 'daily average'}
                </span>
              </div>
            ) : (
              <span className="font-body-sm text-body-sm text-outline italic">
                {isBangla ? 'চলতি মাসে কোন ব্যয় নেই' : 'No spending recorded this month'}
              </span>
            )}
          </div>
        </div>

        {/* KPI 4: Total Saved */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow border border-outline-variant/20">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Total Saved
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-headline-lg text-headline-lg text-secondary font-bold">
                  {formatBDT(overview.netSavings)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary-container/50 flex items-center justify-center text-on-secondary-container">
              <span className="material-symbols-outlined text-[22px]">savings</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {overview.savingsRate}% savings rate
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Target: 20%</span>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 1: Health Score (4 cols) & AI Spotlight (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Module 1: Financial Health Score (Span 4) */}
        <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-space-md flex flex-col justify-between shadow-sm relative overflow-hidden border border-outline-variant/20">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">vital_signs</span>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                  ArthoBachao AI Financial Health Score
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                {healthMetrics.status}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Real-time composite diagnosis (Transparent Prototype Score)
            </p>

            {/* Radial Gauge Container */}
            <div className="flex flex-col items-center justify-center my-4 relative">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    fill="transparent"
                    r="48"
                    stroke="#eff4ff"
                    strokeWidth="10"
                  />
                  <circle
                    className="transition-all duration-1000"
                    cx="60"
                    cy="60"
                    fill="transparent"
                    r="48"
                    stroke={healthMetrics.score !== null ? (healthMetrics.score >= 75 ? '#006c49' : healthMetrics.score >= 50 ? '#0284c7' : '#94a3b8') : '#cbd5e1'}
                    strokeDasharray={`${healthMetrics.score !== null ? (healthMetrics.score / 100) * 301.6 : 0} 301.6`}
                    strokeLinecap="round"
                    strokeWidth="10"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-headline-xl text-headline-xl text-on-surface leading-none font-bold">
                    {healthMetrics.score !== null ? healthMetrics.score : '--'}
                  </span>
                  <span className="font-label-sm text-label-sm text-outline mt-0.5 uppercase tracking-wider">
                    / 100
                  </span>
                </div>
              </div>
              {healthMetrics.score !== null && healthMetrics.percentile !== null ? (
                <p className="font-body-sm text-body-sm text-center text-on-surface-variant max-w-[220px] mt-2">
                  Consistently outperforming{' '}
                  <span className="font-semibold text-secondary">{healthMetrics.percentile}%</span> of peers in
                  Dhaka
                </p>
              ) : (
                <p className="font-body-sm text-body-sm text-center text-on-surface-variant max-w-[220px] mt-2">
                  Add transactions to calculate this metric.
                </p>
              )}
            </div>

            {/* 4 Sub-metrics Breakdown */}
            <div className="flex flex-col gap-2.5 mt-2">
              <div>
                <div className="flex justify-between font-label-sm text-label-sm mb-1 gap-2">
                  <span className="text-on-surface-variant truncate">Saving Consistency</span>
                  <span className="font-semibold text-on-surface shrink-0 text-xs sm:text-label-sm">
                    {healthMetrics.factors.savingConsistency !== null
                      ? `${healthMetrics.factors.savingConsistency}%`
                      : 'Insufficient Data'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        healthMetrics.factors.savingConsistency !== null
                          ? healthMetrics.factors.savingConsistency
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-label-sm text-label-sm mb-1 gap-2">
                  <span className="text-on-surface-variant truncate">Spending Control</span>
                  <span className="font-semibold text-on-surface shrink-0 text-xs sm:text-label-sm">
                    {healthMetrics.factors.spendingControl !== null
                      ? `${healthMetrics.factors.spendingControl}%`
                      : 'Insufficient Data'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                  <div
                    className="h-full bg-secondary-fixed-dim rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        healthMetrics.factors.spendingControl !== null
                          ? healthMetrics.factors.spendingControl
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-label-sm text-label-sm mb-1 gap-2">
                  <span className="text-on-surface-variant truncate">Cash Flow Stability</span>
                  <span className="font-semibold text-on-surface shrink-0 text-xs sm:text-label-sm">
                    {healthMetrics.factors.cashFlowStability !== null
                      ? `${healthMetrics.factors.cashFlowStability}%`
                      : 'Insufficient Data'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        healthMetrics.factors.cashFlowStability !== null
                          ? healthMetrics.factors.cashFlowStability
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-label-sm text-label-sm mb-1 gap-2">
                  <span className="text-on-surface-variant truncate">Goal Progress</span>
                  <span className="font-semibold text-on-surface shrink-0 text-xs sm:text-label-sm">
                    {healthMetrics.factors.goalProgress !== null
                      ? `${healthMetrics.factors.goalProgress}%`
                      : 'Insufficient Data'}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        healthMetrics.factors.goalProgress !== null
                          ? healthMetrics.factors.goalProgress
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('financial-health')}
            className="mt-4 pt-3 flex items-center justify-between text-secondary hover:text-on-secondary-fixed-variant transition-colors font-title-md text-title-md border-t border-outline-variant/15 text-left"
          >
            <span>View Health Breakdown</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>

        {/* Compact AI Coach Action (Span 8) */}
        <div className="lg:col-span-8 rounded-xl bg-surface-container-lowest p-space-md shadow-sm border border-outline-variant/20 flex flex-col justify-center items-center text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 text-on-secondary-container flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[26px] text-secondary">smart_toy</span>
          </div>
          <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
            {isBangla ? 'অর্থবাঁচাও এআই কোচ' : 'ArthoBachao AI Coach'}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mt-1 mb-4">
            {isBangla
              ? 'আপনার এআই কোচের কাছ থেকে ব্যক্তিগত আর্থিক দিকনির্দেশনা নিন।'
              : 'Get personalized financial guidance from your AI Coach.'}
          </p>
          <button
            type="button"
            onClick={() => setIsCoachModalOpen(true)}
            className="flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-title-md text-title-md shadow-sm hover:opacity-95 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary-container">chat</span>
            <span>{isBangla ? 'এআই কোচকে জিজ্ঞাসা করুন' : 'Ask AI Coach'}</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Row 2: Savings Goals Snapshot (6 cols) & Spending Breakdown (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Module 3: Savings Goals Snapshot (Span 6) */}
        <div className="lg:col-span-6 rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/20">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary-container/40 text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">flag</span>
                </div>
                <div>
                  <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                    Savings Goals Snapshot
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {goals.length} Active Targets in Progress
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenCreateGoal}
                className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors"
                title="Create new goal"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>

            {/* Primary Highlight Goal */}
            {heroGoal && (
              <div className="mt-4 p-space-md rounded-xl bg-surface-container-low/50 border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xl">
                      {heroGoal.icon || '🎯'}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface font-bold">
                        {heroGoal.title}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        Target: {formatBDT(heroGoal.targetAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-title-md text-title-md text-secondary font-bold">
                      {formatBDT(heroGoal.currentAmount)}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      {heroProgress.toFixed(1)}% completed
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 rounded-full bg-surface-container mt-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary-fixed-dim to-secondary rounded-full transition-all duration-700"
                    style={{ width: `${heroProgress}%` }}
                  ></div>
                </div>

                {/* Milestone Footnote */}
                <div className="flex items-center justify-between mt-3 font-body-sm text-body-sm">
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      alarm_on
                    </span>
                    <span>
                      Deadline: <strong>{heroGoal.deadline}</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-secondary-container/40 text-on-secondary-container font-label-sm text-label-sm font-semibold">
                    {formatBDT(Math.max(0, heroGoal.targetAmount - heroGoal.currentAmount))}{' '}
                    remaining
                  </span>
                </div>
              </div>
            )}

            {/* Secondary Goal */}
            {subGoal && (
              <div className="mt-3 p-space-md rounded-xl bg-surface-container-low/30 border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center text-lg">
                      {subGoal.icon || '🎯'}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface font-semibold">
                        {subGoal.title}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        Target: {formatBDT(subGoal.targetAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-title-md text-title-md text-on-surface font-semibold">
                      {formatBDT(subGoal.currentAmount)}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      {subProgress.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full transition-all duration-700"
                    style={{ width: `${subProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('savings-goals')}
            className="mt-4 pt-3 flex items-center justify-between text-secondary hover:text-on-secondary-fixed-variant transition-colors font-title-md text-title-md border-t border-outline-variant/15 text-left"
          >
            <span>Manage All Goals</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>

        {/* Module 4: Spending by Category Donut & Breakdown (Span 6) */}
        <div className="lg:col-span-6 rounded-xl bg-surface-container-lowest p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/20">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-error-container/60 text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">pie_chart</span>
                </div>
                <div>
                  <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                    Spending by Category
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Total: {formatBDT(overview.totalExpenses)} this billing cycle
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-surface-container-low font-label-sm text-label-sm text-on-surface">
                This Month
              </span>
            </div>

            {/* Alert Notification for Food Spending */}
            <div className="mt-3 p-2.5 rounded-lg bg-error-container/40 flex items-center gap-2 text-on-error-container">
              <span className="material-symbols-outlined text-[18px] text-error">warning</span>
              <span className="font-body-sm text-body-sm">
                <strong>Food &amp; Dining:</strong> increased by 14% vs last month.
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">
              {/* Donut SVG (5 cols) */}
              <div className="md:col-span-5 flex items-center justify-center relative">
                <div className="w-36 h-36 relative flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {(() => {
                      const circumference = 251.2;
                      const colors = [
                        '#ba1a1a',
                        '#006c49',
                        '#07006c',
                        '#4edea3',
                        '#d3e4fe',
                        '#c6c6cd',
                      ];
                      let currentOffset = 0;
                      return overview.categories.map((c, i) => {
                        const dash = Math.max(0.5, (c.percentage / 100) * circumference);
                        const offset = -currentOffset;
                        currentOffset += dash;
                        return (
                          <circle
                            key={c.category}
                            cx="50"
                            cy="50"
                            fill="transparent"
                            r="40"
                            stroke={colors[i % colors.length]}
                            strokeDasharray={`${dash.toFixed(1)} ${circumference}`}
                            strokeDashoffset={offset}
                            strokeWidth="12"
                            className="transition-all duration-500"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                      Total
                    </span>
                    <span className="font-title-md text-title-md text-on-surface font-bold leading-tight">
                      ৳{(overview.totalExpenses / 1000).toFixed(1)}k
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Legend Breakdown (7 cols) */}
              <div className="md:col-span-7 flex flex-col gap-2">
                {overview.categories.map((c, i) => {
                  const colors = [
                    '#ba1a1a',
                    '#006c49',
                    '#07006c',
                    '#4edea3',
                    '#d3e4fe',
                    '#c6c6cd',
                  ];
                  return (
                    <div
                      key={c.category}
                      className="flex items-center justify-between text-body-sm font-body-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: colors[i % colors.length] }}
                        ></span>
                        <span className="text-on-surface truncate max-w-[130px]">
                          {c.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">{formatBDT(c.amount)}</span>
                        <span className="text-outline text-[11px]">{c.percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between border-t border-outline-variant/15">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Compared to last month (৳27,050)
            </span>
            <button
              onClick={() => onNavigate('spending-analysis')}
              className="font-title-md text-title-md text-secondary hover:text-on-secondary-fixed-variant"
            >
              Detailed Category Report →
            </button>
          </div>
        </div>
      </div>

      {/* AI Coach Popup Modal */}
      <AICoachModal
        isOpen={isCoachModalOpen}
        onClose={() => setIsCoachModalOpen(false)}
        onOpenCoach={() => onNavigate('ai-coach')}
        isBangla={isBangla}
      />
    </div>
  );
};
