import React from 'react';
import { FinancialHealthMetrics, SavingsGoal, Transaction, UserProfile } from '../types/financial';
import { NavScreen } from './Sidebar';

interface FinancialHealthViewProps {
  metrics: FinancialHealthMetrics;
  onNavigate: (screen: NavScreen) => void;
  isBangla: boolean;
  goals?: SavingsGoal[];
  transactions?: Transaction[];
  user?: UserProfile;
}

export const FinancialHealthView: React.FC<FinancialHealthViewProps> = ({
  metrics,
  onNavigate,
  isBangla,
  goals = [],
  transactions = [],
  user: _user,
}) => {
  const isInsufficient = metrics.score === null || metrics.status === 'Insufficient Data';
  const scoreDisplay = isInsufficient ? '--' : metrics.score;
  const statusDisplay = isInsufficient
    ? 'Insufficient Data'
    : metrics.status;

  const explanationDisplay = isInsufficient
    ? 'Log your transactions and create savings goals to calculate your personalized ArthoAI Financial Health Score.'
    : metrics.explanation;

  const benchmarkSubtext = isInsufficient || metrics.percentile === null || metrics.percentile === undefined
    ? 'Requires at least 1 month of transaction records for peer benchmarking.'
    : `Consistently outperforming ${metrics.percentile}% of peers`;

  // Factor 1: Saving Consistency
  const isSavingConsistencyAvailable = metrics.factors.savingConsistency !== null;
  const savingConsistencyDesc = !isSavingConsistencyAvailable
    ? 'Add transactions to calculate this metric.'
    : `Evaluates regularity of savings transfers and cash retention. Current factor rating is ${metrics.factors.savingConsistency}%.`;

  // Factor 2: Spending Control
  const isSpendingControlAvailable = metrics.factors.spendingControl !== null;
  const spendingControlDesc = !isSpendingControlAvailable
    ? 'Add transactions to calculate this metric.'
    : `Monitors daily budget discipline and discretionary burn. Current factor rating is ${metrics.factors.spendingControl}%.`;

  // Factor 3: Cash Flow Stability
  const isCashFlowAvailable = metrics.factors.cashFlowStability !== null;
  const cashFlowStabilityDesc = !isCashFlowAvailable
    ? 'Add transactions to calculate this metric.'
    : `Evaluates month-end cash flow cushion and liquidity security. Current factor rating is ${metrics.factors.cashFlowStability}%.`;

  // Factor 4: Goal Progress
  const isGoalProgressAvailable = metrics.factors.goalProgress !== null;
  const goalProgressDesc = !isGoalProgressAvailable
    ? 'Create a savings goal to calculate this metric.'
    : `Average milestone attainment across your active savings goals (${goals.map((g) => `${g.title}: ${Math.round((g.currentAmount / (g.targetAmount || 1)) * 100)}%`).slice(0, 3).join(', ')}).`;

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Header */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
            TRANSPARENT DETERMINISTIC SCORING
          </span>
          <span className="font-label-sm text-label-sm text-outline">
            Bangladesh Digital Ledger Model
          </span>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
          ArthoAI Financial Health Score Breakdown
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
          Unlike traditional black-box credit scores, ArthoAI's score is 100% explainable, deterministic, and grounded in your authentic ledger.
        </p>
      </div>

      {/* Main Score Hero Card */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col md:flex-row items-center justify-between gap-space-lg">
        <div className="flex items-center gap-space-lg">
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" fill="transparent" r="48" stroke="#eff4ff" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                fill="transparent"
                r="48"
                stroke={!isInsufficient && metrics.score !== null ? (metrics.score >= 75 ? '#006c49' : metrics.score >= 50 ? '#0284c7' : '#94a3b8') : '#cbd5e1'}
                strokeDasharray={`${!isInsufficient && metrics.score !== null ? (metrics.score / 100) * 301.6 : 0} 301.6`}
                strokeLinecap="round"
                strokeWidth="10"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold">
                {scoreDisplay}
              </span>
              <span className="text-xs text-outline uppercase font-semibold">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                {`Overall Financial Health: ${statusDisplay}`}
              </h2>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
              {explanationDisplay}
            </p>
            <span className="text-xs font-semibold text-secondary mt-1">
              {benchmarkSubtext}
            </span>
          </div>
        </div>

        <button
          onClick={() => onNavigate('ai-coach')}
          className="px-space-lg py-3 rounded-xl bg-primary-container text-on-primary font-title-md hover:opacity-95 shadow-md flex items-center gap-2 shrink-0 active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary-container">
            auto_awesome
          </span>
          <span>Ask Coach How to Improve Score</span>
        </button>
      </div>

      {/* 4 Factor Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        {/* Factor 1 */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                1. Saving Consistency
              </span>
              <span className="font-headline-md text-headline-md text-secondary font-bold text-sm sm:text-base">
                {isSavingConsistencyAvailable ? `${metrics.factors.savingConsistency}%` : 'Insufficient Data'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {savingConsistencyDesc}
            </p>
          </div>
          <div className="w-full bg-surface-container-low h-2 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-500"
              style={{ width: `${isSavingConsistencyAvailable && metrics.factors.savingConsistency !== null ? metrics.factors.savingConsistency : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Factor 2 */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                2. Spending Control
              </span>
              <span className="font-headline-md text-headline-md text-on-surface font-bold text-sm sm:text-base">
                {isSpendingControlAvailable ? `${metrics.factors.spendingControl}%` : 'Insufficient Data'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {spendingControlDesc}
            </p>
          </div>
          <div className="w-full bg-surface-container-low h-2 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-secondary-fixed-dim h-full rounded-full transition-all duration-500"
              style={{ width: `${isSpendingControlAvailable && metrics.factors.spendingControl !== null ? metrics.factors.spendingControl : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Factor 3 */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                3. Cash Flow Stability
              </span>
              <span className="font-headline-md text-headline-md text-on-surface font-bold text-sm sm:text-base">
                {isCashFlowAvailable ? `${metrics.factors.cashFlowStability}%` : 'Insufficient Data'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {cashFlowStabilityDesc}
            </p>
          </div>
          <div className="w-full bg-surface-container-low h-2 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-500"
              style={{ width: `${isCashFlowAvailable && metrics.factors.cashFlowStability !== null ? metrics.factors.cashFlowStability : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Factor 4 */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                4. Goal Progress
              </span>
              <span className="font-headline-md text-headline-md text-secondary font-bold text-sm sm:text-base">
                {isGoalProgressAvailable ? `${metrics.factors.goalProgress}%` : 'Insufficient Data'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {goalProgressDesc}
            </p>
          </div>
          <div className="w-full bg-surface-container-low h-2 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-500"
              style={{ width: `${isGoalProgressAvailable && metrics.factors.goalProgress !== null ? metrics.factors.goalProgress : 0}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
