import React, { useState } from 'react';
import { SavingsGoal, ScenarioPlan, UserProfile } from '../types/financial';
import {
  calculateScenarioPlans,
  calculateRemainingGoalAmount,
  calculateGoalProgressPercentage,
} from '../services/financialCalculations';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  getCurrencyConfig,
} from '../services/currencyService';
import { NavScreen } from './Sidebar';

interface SavingsGoalsProps {
  goals: SavingsGoal[];
  onUpdateGoal: (updatedGoal: SavingsGoal) => void;
  onDeleteGoal?: (goalId: string) => void;
  onDepositToGoal?: (goalId: string, amount: number) => void;
  onOpenCreateGoal: () => void;
  onNavigate: (screen: NavScreen) => void;
  isBangla: boolean;
  user?: UserProfile | null;
}

export const SavingsGoals: React.FC<SavingsGoalsProps> = ({
  goals,
  onUpdateGoal,
  onDeleteGoal,
  onDepositToGoal,
  onOpenCreateGoal,
  onNavigate,
  isBangla,
  user,
}) => {
  const userCurrency = normalizeCurrencyCode(user?.currency);
  const currConfig = getCurrencyConfig(userCurrency);
  const formatMoney = (amountInBDT: number, opts?: { decimals?: number; roundWhole?: boolean }) => {
    const converted = convertAmount(amountInBDT, 'BDT', userCurrency);
    return formatCurrency(converted, userCurrency, opts);
  };
  const [selectedPlanId, setSelectedPlanId] = useState<'planA' | 'planB' | 'planC'>('planB');
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [adjustModalGoal, setAdjustModalGoal] = useState<SavingsGoal | null>(null);
  const [newPaceInput, setNewPaceInput] = useState<string>('5000');
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    targetAmount: number;
    currentAmount: number;
    monthlyPace: number;
    deadline: string;
    accountVault: string;
  }>({
    title: '',
    targetAmount: 0,
    currentAmount: 0,
    monthlyPace: 0,
    deadline: '',
    accountVault: '',
  });

  // Emergency Fund is the primary goal
  const heroGoal = goals.find((g) => g.id === 'goal-emergency-fund') || goals[0];
  const secondaryGoals = goals.filter((g) => g.id !== heroGoal?.id);

  // Scenario plans for hero goal
  const scenarioPlans = heroGoal ? calculateScenarioPlans(heroGoal) : [];

  // Handle Quick Deposit of ৳1,000
  const handleQuickDeposit = () => {
    if (!heroGoal) return;
    if (onDepositToGoal) {
      onDepositToGoal(heroGoal.id, 1000);
    } else {
      const newAmount = heroGoal.currentAmount + 1000;
      const updated: SavingsGoal = {
        ...heroGoal,
        currentAmount: Math.min(heroGoal.targetAmount, newAmount),
      };
      onUpdateGoal(updated);
    }
    setDepositSuccessMsg(`${formatMoney(1000)} deposited into bKash Liquid Vault! Goal progress updated.`);
    setTimeout(() => {
      setDepositSuccessMsg(null);
    }, 4500);
  };

  // Handle Plan Selection
  const handleSelectPlan = (plan: ScenarioPlan) => {
    setSelectedPlanId(plan.planId);
    if (heroGoal) {
      const updated: SavingsGoal = {
        ...heroGoal,
        monthlyPace: plan.monthlyAmount,
      };
      onUpdateGoal(updated);
      setDepositSuccessMsg(`Applied ${plan.name} (${formatMoney(plan.monthlyAmount)}/month)! Target pace recalibrated.`);
      setTimeout(() => setDepositSuccessMsg(null), 4500);
    }
  };

  // Adjust pace save
  const handleSavePace = () => {
    if (!adjustModalGoal) return;
    const pace = parseInt(newPaceInput, 10);
    if (pace > 0) {
      onUpdateGoal({
        ...adjustModalGoal,
        monthlyPace: pace,
      });
    }
    setAdjustModalGoal(null);
  };

  // Edit goal handlers
  const openEditGoalModal = (g: SavingsGoal) => {
    setEditingGoal(g);
    setEditForm({
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      monthlyPace: g.monthlyPace,
      deadline: g.deadline || '2024-12-31',
      accountVault: g.accountVault || 'bKash Liquid Vault',
    });
  };

  const handleSaveEditGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;
    const updated: SavingsGoal = {
      ...editingGoal,
      title: editForm.title.trim() || editingGoal.title,
      targetAmount: Math.max(1000, Number(editForm.targetAmount)),
      currentAmount: Math.max(0, Number(editForm.currentAmount)),
      monthlyPace: Math.max(500, Number(editForm.monthlyPace)),
      deadline: editForm.deadline,
      accountVault: editForm.accountVault,
    };
    onUpdateGoal(updated);
    setEditingGoal(null);
    setDepositSuccessMsg(`Savings goal "${updated.title}" updated successfully.`);
    setTimeout(() => setDepositSuccessMsg(null), 4000);
  };

  const handleDeleteClick = (goalId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the goal "${title}"?`)) {
      if (onDeleteGoal) {
        onDeleteGoal(goalId);
        setDepositSuccessMsg(`Goal "${title}" has been deleted.`);
        setTimeout(() => setDepositSuccessMsg(null), 4000);
      }
    }
  };

  const renderIntroBox = () => (
    <div className="rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm border border-outline-variant/20 relative overflow-hidden">
      {/* Subtle decorative background accent */}
      <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-secondary-container/20 blur-2xl pointer-events-none"></div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">
            Savings Guide
          </span>
        </div>
        <h2 className="font-title-lg sm:font-headline-sm text-title-lg sm:text-headline-sm text-on-surface font-bold tracking-tight">
          Plan Your Savings, Achieve Your Goals
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1.5 max-w-3xl leading-relaxed">
          Savings Goals helps you plan and track money for the things that matter to you. Set a target amount, choose a target date, and track your progress as you save.
        </p>

        {/* Three Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-md">
          {/* Step 1 */}
          <div className="rounded-xl bg-surface-container-low/50 p-space-md border border-outline-variant/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">flag</span>
                </div>
                <div>
                  <span className="font-label-sm text-[11px] font-bold uppercase tracking-wider text-secondary block leading-none">
                    STEP 1
                  </span>
                  <h3 className="font-title-md text-title-md font-bold text-on-surface leading-tight mt-0.5">
                    Set Your Goal
                  </h3>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Choose what you are saving for, such as a laptop, emergency fund, education, or a trip.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl bg-surface-container-low/50 p-space-md border border-outline-variant/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                </div>
                <div>
                  <span className="font-label-sm text-[11px] font-bold uppercase tracking-wider text-secondary block leading-none">
                    STEP 2
                  </span>
                  <h3 className="font-title-md text-title-md font-bold text-on-surface leading-tight mt-0.5">
                    Set Your Target
                  </h3>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Enter the amount you want to save and your target date.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl bg-surface-container-low/50 p-space-md border border-outline-variant/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">trending_up</span>
                </div>
                <div>
                  <span className="font-label-sm text-[11px] font-bold uppercase tracking-wider text-secondary block leading-none">
                    STEP 3
                  </span>
                  <h3 className="font-title-md text-title-md font-bold text-on-surface leading-tight mt-0.5">
                    Track Your Progress
                  </h3>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Update your savings as you contribute and monitor how close you are to reaching your target.
              </p>
            </div>
          </div>
        </div>

        {/* Helpful Note / Tip */}
        <div className="mt-space-md p-3.5 rounded-xl bg-secondary-container/20 border border-secondary/20 flex items-start gap-2.5 text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-secondary shrink-0 mt-0.5">
            lightbulb
          </span>
          <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
            <strong className="text-secondary font-semibold">
              Tip:{' '}
            </strong>
            Set realistic targets and contribute regularly. Your progress should reflect your actual savings.
          </p>
        </div>
      </div>
    </div>
  );

  if (!heroGoal) {
    return (
      <div className="flex flex-col w-full gap-space-lg pb-space-xl">
        {/* Savings Goals Introduction Box */}
        {renderIntroBox()}

        {/* Existing No Savings Goals Active empty state */}
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 text-center max-w-lg mx-auto my-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center text-3xl mb-4 shadow-sm">
            🛡️
          </div>
          <h3 className="font-headline-md text-2xl font-bold text-on-surface">No Savings Goals Active</h3>
          <p className="font-body-md text-on-surface-variant mt-2 max-w-sm">
            You currently have no active goals in your savings vault. Create your first goal or restore starter demo targets.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              onClick={onOpenCreateGoal}
              className="px-6 py-2.5 bg-primary text-on-primary font-title-md rounded-xl shadow-sm hover:opacity-95 active:scale-95"
            >
              + Create New Goal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const remainingGap = calculateRemainingGoalAmount(heroGoal);
  const achievedPct = calculateGoalProgressPercentage(heroGoal);

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Toast Alert */}
      {depositSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-secondary text-on-secondary flex items-center justify-between shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span className="font-title-md text-sm sm:text-title-md">{depositSuccessMsg}</span>
          </div>
          <button
            onClick={() => setDepositSuccessMsg(null)}
            className="p-1 rounded hover:bg-white/20"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
        <div className="flex flex-col max-w-2xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
              <span className="material-symbols-outlined text-[14px]">auto_graph</span>
              SMART CAPITAL ALLOCATION
            </span>
            <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase font-semibold">
              Vault v3.8
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
            Turn Goals into a Plan
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            AI-assisted savings projection, automated pace tracking, and timeline simulation
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-space-sm">
          <button className="flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all shadow-sm border border-outline-variant/30">
            <span className="material-symbols-outlined text-[18px] text-secondary">autorenew</span>
            <div className="flex flex-col text-left">
              <span className="font-label-sm text-label-sm text-on-surface-variant leading-none">
                Auto-save Rules
              </span>
              <span className="font-title-md text-title-md leading-none mt-0.5 font-bold">
                Active: {formatMoney(100)}/day
              </span>
            </div>
          </button>
          <button
            onClick={onOpenCreateGoal}
            className="flex items-center gap-2 px-space-lg py-3 rounded-xl bg-primary-container text-on-primary hover:bg-inverse-surface transition-all shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px] text-secondary-container">
              add_circle
            </span>
            <span className="font-title-md text-title-md font-semibold">
              + Create New Savings Goal
            </span>
          </button>
        </div>
      </div>

      {/* Savings Goals Introduction Box */}
      {renderIntroBox()}

      {/* Main Workspace Layout */}
      <div className="flex flex-col gap-space-lg w-full">
        {/* Hero Goal Card: Emergency Fund */}
        <div className="relative bg-surface-container-lowest rounded-xl p-space-lg shadow-sm overflow-hidden group border border-outline-variant/20">
            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>

            {/* Header and Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md border-b border-outline-variant/15">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface text-2xl shadow-sm">
                  {heroGoal.icon}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                      {heroGoal.title}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      {heroGoal.status}
                    </span>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {heroGoal.category} • {heroGoal.accountVault}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Velocity
                </span>
                <span className="px-2 py-1 rounded-lg bg-surface-container font-title-md text-title-md text-secondary font-bold">
                  {formatMoney(heroGoal.monthlyPace)}/mo
                </span>
              </div>
            </div>

            {/* Numbers Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm py-space-md my-space-xs rounded-xl bg-surface-container-low px-space-md border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Target Capital
                </span>
                <span className="font-title-lg text-title-lg text-on-surface font-bold mt-0.5">
                  {formatMoney(heroGoal.targetAmount)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Current Saved
                </span>
                <span className="font-headline-md text-headline-md text-secondary font-bold mt-0.5">
                  {formatMoney(heroGoal.currentAmount)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Remaining Gap
                </span>
                <span className="font-title-lg text-title-lg text-error font-bold mt-0.5">
                  {formatMoney(remainingGap)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Completion ETA
                </span>
                <span className="font-title-lg text-title-lg text-on-surface font-bold mt-0.5">
                  Dec 14, 2024
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  1.8 months left
                </span>
              </div>
            </div>

            {/* Progress Visualization Bar with Milestones */}
            <div className="py-space-md flex flex-col gap-2">
              <div className="flex justify-between items-center text-body-sm font-body-sm">
                <span className="text-on-surface font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    verified
                  </span>
                  {achievedPct}% achieved
                </span>
                <span className="text-on-surface-variant">
                  Target Pace: {formatMoney(heroGoal.monthlyPace || 5000)}/mo (92% cadence)
                </span>
              </div>

              {/* Custom Progress Bar */}
              <div className="relative w-full h-4 bg-surface-container-high rounded-full overflow-visible p-0.5 mt-1">
                <div
                  className="h-full bg-gradient-to-r from-secondary-container via-secondary to-on-secondary-container rounded-full relative transition-all duration-1000 ease-out shadow-sm"
                  style={{ width: `${Math.min(100, achievedPct)}%` }}
                >
                  <div className="absolute -right-2 -top-1 w-6 h-6 bg-surface-container-lowest rounded-full shadow-md flex items-center justify-center border border-secondary">
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
                  </div>
                </div>

                {/* Milestone 1 Flag: 10,000 (33.3%) */}
                <div className="absolute top-6 left-[33.3%] -translate-x-1/2 flex flex-col items-center">
                  <div className="w-0.5 h-2 bg-secondary"></div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-bold">
                    <span className="material-symbols-outlined text-[10px]">check</span>
                    {formatMoney(10000, { roundWhole: true })} Hit
                  </div>
                </div>

                {/* Milestone 2 Flag: 20,000 (66.6%) */}
                <div className="absolute top-6 left-[66.6%] -translate-x-1/2 flex flex-col items-center">
                  <div className="w-0.5 h-2 bg-outline"></div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-sm text-[10px] font-semibold">
                    <span className="material-symbols-outlined text-[10px]">flag</span>
                    {formatMoney(20000, { roundWhole: true })} Next
                  </div>
                </div>
              </div>

              {/* Milestone clearance spacer */}
              <div className="h-6"></div>
            </div>

            {/* Bottom Action Strip */}
            <div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md bg-surface-container/50 -mx-space-lg -mb-space-lg px-space-lg py-space-md mt-space-sm border-t border-outline-variant/15">
              <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[18px] text-tertiary-container">
                  info
                </span>
                <span>Next scheduled sweep: {formatMoney(350)} tomorrow at 10:00 AM via Dhaka Bank</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => openEditGoalModal(heroGoal)}
                  className="px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface font-title-md text-title-md hover:bg-surface-container-high transition-colors shadow-sm w-full sm:w-auto border border-outline-variant/30 flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit Goal</span>
                </button>
                <button
                  onClick={() => {
                    setAdjustModalGoal(heroGoal);
                    setNewPaceInput(heroGoal.monthlyPace.toString());
                  }}
                  className="px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface font-title-md text-title-md hover:bg-surface-container-high transition-colors shadow-sm w-full sm:w-auto border border-outline-variant/30"
                >
                  Adjust Pace
                </button>
                <button
                  onClick={handleQuickDeposit}
                  className="px-space-md py-2 rounded-lg bg-secondary text-on-secondary font-title-md text-title-md hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  + Deposit {formatMoney(1000)} Now
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Goals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
            {secondaryGoals.map((g) => {
              const gGap = calculateRemainingGoalAmount(g);
              const gPct = calculateGoalProgressPercentage(g);
              return (
                <div
                  key={g.id}
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between border border-outline-variant/20"
                >
                  <div className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-xl shadow-sm">
                        {g.icon}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                          {g.category}
                        </span>
                        <button
                          onClick={() => openEditGoalModal(g)}
                          className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                          title="Edit Goal"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(g.id, g.title)}
                          className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                          title="Delete Goal"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <h3 className="font-headline-md text-headline-md text-on-surface mt-space-sm font-bold">
                      {g.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Target: {formatMoney(g.targetAmount)}</span>
                      <span>•</span>
                      <span>Target Date: {g.deadline || '2025-06-30'}</span>
                    </p>

                    <div className="mt-space-md flex items-baseline justify-between">
                      <div>
                        <span className="font-numeric-hero text-numeric-hero text-on-surface font-bold">
                          {formatMoney(g.currentAmount)}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant ml-1">
                          / {formatMoney(g.targetAmount)}
                        </span>
                      </div>
                      <span className="font-title-md text-title-md text-on-surface font-semibold">
                        {gPct}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-primary-container rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, gPct)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center mt-3 text-body-sm font-body-sm text-on-surface-variant">
                      <span>Remaining: {formatMoney(gGap)}</span>
                      <span className="font-semibold text-on-surface">
                        Required: {formatMoney(g.monthlyPace)}/mo
                      </span>
                    </div>
                  </div>

                  <div className="pt-space-md mt-space-md flex items-center justify-between border-t border-outline-variant/15">
                    <span className="font-label-sm text-label-sm text-outline">
                      {g.accountVault}
                    </span>
                    <button
                      onClick={() => {
                        if (onDepositToGoal) {
                          onDepositToGoal(g.id, 1000);
                        } else {
                          const updated: SavingsGoal = {
                            ...g,
                            currentAmount: Math.min(g.targetAmount, g.currentAmount + 1000),
                          };
                          onUpdateGoal(updated);
                        }
                        setDepositSuccessMsg(`Boosted ${g.title} by +${formatMoney(1000)}!`);
                        setTimeout(() => setDepositSuccessMsg(null), 4000);
                      }}
                      className="font-title-md text-title-md text-secondary hover:underline flex items-center gap-0.5 font-bold"
                    >
                      Boost Goal (+{formatMoney(1000)})
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section: AI Savings Plan Comparison Simulator */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md relative overflow-hidden border border-outline-variant/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary-container text-[24px]">
                  psychology
                </span>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                    Artho AI Scenario Planning
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Accelerate Emergency Fund completion timeline using contextual cash-flow heuristics
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface font-semibold self-start sm:self-auto">
                Simulated Target: {formatMoney(remainingGap)}
              </span>
            </div>

            {/* 3 Scenario Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
              {scenarioPlans.map((plan) => {
                const isSelected = selectedPlanId === plan.planId;
                const isOptimal = plan.isRecommended;

                if (isOptimal) {
                  return (
                    <div
                      key={plan.planId}
                      className="bg-primary-container text-on-primary rounded-xl p-space-md flex flex-col justify-between shadow-md relative transform md:-translate-y-1 border border-secondary/40"
                    >
                      <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">
                          auto_awesome
                        </span>
                        AI RECOMMENDED
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase tracking-wider">
                            Plan B
                          </span>
                          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-highest/20 text-secondary-container font-medium">
                            {plan.badge}
                          </span>
                        </div>

                        <h4 className="font-title-lg text-title-lg text-on-primary mt-2 font-bold">
                          {plan.name}
                        </h4>

                        <div className="my-space-sm">
                          <span className="font-headline-lg text-headline-lg text-secondary-container font-bold">
                            {formatMoney(plan.monthlyAmount)}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-primary-container">
                            / month
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-space-xs">
                          <div className="flex items-center gap-1.5 text-body-sm font-body-sm text-on-primary">
                            <span className="material-symbols-outlined text-[16px] text-secondary-container">
                              event_available
                            </span>
                            <span>
                              {plan.durationMonths} months ({plan.targetCompletionDate})
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5 text-body-sm font-body-sm text-primary-fixed-dim">
                            <span className="material-symbols-outlined text-[16px] text-secondary-container mt-0.5">
                              tune
                            </span>
                            <span>{plan.adjustmentNote}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-space-md">
                        <button
                          onClick={() => handleSelectPlan(plan)}
                          className="w-full py-2.5 rounded-lg bg-secondary-container text-on-secondary-container font-title-md text-title-md font-bold hover:opacity-95 transition-all shadow-sm active:scale-95"
                        >
                          {isSelected ? '✓ Plan Active' : 'Select Balanced Plan'}
                        </button>
                        <button
                          onClick={() => onNavigate('ai-coach')}
                          className="text-center font-label-md text-label-md text-primary-fixed-dim hover:text-on-primary underline transition-colors"
                        >
                          Customize Rules
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={plan.planId}
                    className={`bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between hover:bg-surface-container transition-all cursor-pointer border ${
                      isSelected ? 'border-secondary ring-2 ring-secondary/20' : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                          {plan.planId === 'planA' ? 'Plan A' : 'Plan C'}
                        </span>
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                          {plan.badge}
                        </span>
                      </div>

                      <h4 className="font-title-lg text-title-lg text-on-surface mt-2 font-bold">
                        {plan.name}
                      </h4>

                      <div className="my-space-sm">
                        <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                          {formatMoney(plan.monthlyAmount)}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          / month
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-space-xs">
                        <div className="flex items-center gap-1.5 text-body-sm font-body-sm text-on-surface">
                          <span className="material-symbols-outlined text-[16px] text-outline">
                            schedule
                          </span>
                          <span>
                            {plan.durationMonths} months ({plan.targetCompletionDate})
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-body-sm font-body-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">
                            {plan.planId === 'planA' ? 'sentiment_satisfied' : 'warning'}
                          </span>
                          <span>{plan.adjustmentNote}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className="mt-space-md w-full py-2 rounded-lg bg-surface-container-highest text-on-surface font-title-md text-title-md hover:bg-outline-variant/30 transition-colors active:scale-95"
                    >
                      {isSelected ? '✓ Plan Active' : 'Apply Plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      {/* Adjust Pace Modal */}
      {adjustModalGoal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Adjust Savings Pace
              </h3>
              <button
                onClick={() => setAdjustModalGoal(null)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Set your target monthly savings velocity for{' '}
              <strong>{adjustModalGoal.title}</strong>. Artho AI will recalibrate your projected finish date automatically.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                Monthly Pace ({userCurrency})
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-bold text-secondary">{currConfig.displaySymbol}</span>
                <input
                  type="number"
                  value={newPaceInput}
                  onChange={(e) => setNewPaceInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-headline-md text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setAdjustModalGoal(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePace}
                className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary font-title-md hover:opacity-95 transition-opacity"
              >
                Update Pace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Full Modal */}
      {editingGoal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{editingGoal.icon}</span>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Edit Savings Goal
                </h3>
              </div>
              <button
                onClick={() => setEditingGoal(null)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditGoal} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Goal Title
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Target Capital ({userCurrency})
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editForm.targetAmount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, targetAmount: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Current Saved ({userCurrency})
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editForm.currentAmount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, currentAmount: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Monthly Pace ({userCurrency})
                  </label>
                  <input
                    type="number"
                    required
                    min="500"
                    value={editForm.monthlyPace}
                    onChange={(e) =>
                      setEditForm({ ...editForm, monthlyPace: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Target Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Target Account / Vault
                </label>
                <select
                  value={editForm.accountVault}
                  onChange={(e) => setEditForm({ ...editForm, accountVault: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                >
                  <option value="bKash Liquid Vault">bKash Liquid Vault</option>
                  <option value="Nagad micro-pockets">Nagad micro-pockets</option>
                  <option value="City Bank High-Yield DPS">City Bank High-Yield DPS</option>
                  <option value="Automated MFS sweep">Automated MFS sweep</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-title-md hover:opacity-95 transition-opacity"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
