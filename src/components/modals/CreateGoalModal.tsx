import React, { useState } from 'react';
import { SavingsGoal } from '../../types/financial';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGoal: (goal: SavingsGoal) => void;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  isOpen,
  onClose,
  onCreateGoal,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Core Liquidity Buffer');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('2025-06-30');
  const [icon, setIcon] = useState('🛡️');
  const [vault, setVault] = useState('bKash Liquid Vault');

  if (!isOpen) return null;

  const target = parseFloat(targetAmount) || 0;
  const current = parseFloat(currentAmount) || 0;
  const remaining = Math.max(0, target - current);

  // Auto calculate required monthly contribution based on actual deadline
  const diffMonths = (() => {
    try {
      const now = new Date('2024-10-14');
      const targetDate = new Date(deadline);
      const diffTime = targetDate.getTime() - now.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, Math.round(days / 30.4));
    } catch {
      return 6;
    }
  })();

  const requiredMonthly = Math.round(remaining / diffMonths);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || target <= 0) return;

    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      category,
      icon,
      targetAmount: target,
      currentAmount: current,
      deadline,
      monthlyPace: requiredMonthly,
      accountVault: vault,
      status: 'On Track',
      color: '#006c49',
      notes: `Goal target: ৳${target.toLocaleString()}`,
    };

    onCreateGoal(newGoal);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">flag</span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
              Create Savings Goal
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Goal Title */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Goal Name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wedding Vault, MacBook Pro, Emergency Fund"
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          {/* Icon & Category */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                Emoji Icon
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
              >
                <option value="🛡️">🛡️ Shield</option>
                <option value="💻">💻 Tech / Laptop</option>
                <option value="🏖️">🏖️ Vacation / Travel</option>
                <option value="🚗">🚗 Vehicle</option>
                <option value="🏠">🏠 House / Rent</option>
                <option value="🎯">🎯 Target</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
              >
                <option value="Core Liquidity Buffer">Core Liquidity Buffer</option>
                <option value="Tech Gear">Tech Gear</option>
                <option value="Holiday Vault">Holiday Vault</option>
                <option value="Investment Pocket">Investment Pocket</option>
                <option value="Family & Life">Family &amp; Life</option>
              </select>
            </div>
          </div>

          {/* Target Amount */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Target Capital (৳)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-bold text-secondary text-lg">৳</span>
              <input
                type="number"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="30000"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest font-headline-md text-on-surface font-bold focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          {/* Initial Saved */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                Initial Saved (৳)
              </label>
              <input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                Target Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
              />
            </div>
          </div>

          {/* Vault */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              Destination Vault
            </label>
            <select
              value={vault}
              onChange={(e) => setVault(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body-md"
            >
              <option value="bKash Liquid Vault">bKash Liquid Vault (High Liquidity)</option>
              <option value="City Bank High-Yield FDR">City Bank High-Yield Savings</option>
              <option value="Nagad micro-pockets">Nagad micro-pockets</option>
            </select>
          </div>

          {/* Required Monthly Planner Callout */}
          {target > 0 && (
            <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between text-xs border border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">
                Remaining: <strong>৳{remaining.toLocaleString()}</strong>
              </span>
              <span className="text-secondary font-bold">
                Req. saving: ~৳{requiredMonthly.toLocaleString()}/mo
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary font-title-md hover:opacity-95 transition-opacity active:scale-95 shadow-sm"
            >
              Create Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
