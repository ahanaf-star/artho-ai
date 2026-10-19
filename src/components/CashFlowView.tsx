import React, { useState, useMemo } from 'react';
import { getDetailedForecast } from '../services/financialCalculations';
import { Transaction, SavingsGoal, UserProfile, RecurringObligation } from '../types/financial';
import { NavScreen } from './Sidebar';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  getCurrencyConfig,
} from '../services/currencyService';

interface CashFlowViewProps {
  onNavigate: (screen: NavScreen) => void;
  isBangla: boolean;
  user?: UserProfile | null;
  transactions?: Transaction[];
  goals?: SavingsGoal[];
  onUpdateUser?: (updated: UserProfile) => void;
  onAddTransaction?: (tx: Transaction) => void | Promise<void>;
}

export interface UpcomingExpenseItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDay: number;
  dueDate: string;
  daysRemaining: number;
  status: 'Upcoming' | 'Due Soon' | 'Overdue' | 'Paid';
  isRecurring: boolean;
  recurrenceRule: string;
  isEnabled: boolean;
  isPaid: boolean;
  source: 'obligation' | 'transaction';
  rawObligation?: RecurringObligation;
  matchedTxId?: string;
}

// Category icons and aesthetic color mapping
const getCategoryMetadata = (category: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('house') || cat.includes('rent') || cat.includes('housing') || cat.includes('home')) {
    return {
      icon: 'home',
      label: 'Housing',
      badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
      iconClass: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
    };
  }
  if (
    cat.includes('util') ||
    cat.includes('elect') ||
    cat.includes('water') ||
    cat.includes('gas') ||
    cat.includes('internet') ||
    cat.includes('bill')
  ) {
    return {
      icon: 'bolt',
      label: 'Utilities',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      iconClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    };
  }
  if (
    cat.includes('trans') ||
    cat.includes('metro') ||
    cat.includes('bus') ||
    cat.includes('fare') ||
    cat.includes('fuel') ||
    cat.includes('ride')
  ) {
    return {
      icon: 'directions_subway',
      label: 'Transport',
      badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      iconClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    };
  }
  if (
    cat.includes('loan') ||
    cat.includes('debt') ||
    cat.includes('emi') ||
    cat.includes('dps') ||
    cat.includes('credit')
  ) {
    return {
      icon: 'credit_card',
      label: 'Loan & Debt',
      badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      iconClass: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
    };
  }
  if (
    cat.includes('sub') ||
    cat.includes('stream') ||
    cat.includes('software') ||
    cat.includes('gym') ||
    cat.includes('cloud')
  ) {
    return {
      icon: 'subscriptions',
      label: 'Subscription',
      badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      iconClass: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
    };
  }
  if (cat.includes('edu') || cat.includes('school') || cat.includes('tuition')) {
    return {
      icon: 'school',
      label: 'Education',
      badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
      iconClass: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40',
    };
  }
  if (cat.includes('food') || cat.includes('groc')) {
    return {
      icon: 'restaurant',
      label: 'Food & Groceries',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      iconClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    };
  }
  return {
    icon: 'receipt_long',
    label: category || 'Fixed Obligation',
    badgeClass: 'bg-surface-container-high text-on-surface-variant border-outline-variant/30',
    iconClass: 'text-secondary bg-surface-container',
  };
};

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  onNavigate,
  isBangla: _isBangla,
  user,
  transactions = [],
  goals: _goals = [],
  onUpdateUser,
  onAddTransaction,
}) => {
  const userCurrency = normalizeCurrencyCode(user?.currency);
  const currConfig = getCurrencyConfig(userCurrency);

  const formatMoney = (bdtAmount: number, maxDec?: number) => {
    const converted = convertAmount(bdtAmount, 'BDT', userCurrency);
    return formatCurrency(converted, userCurrency, {
      maximumFractionDigits:
        maxDec !== undefined ? maxDec : userCurrency === 'BDT' || userCurrency === 'JPY' ? 0 : 2,
    });
  };

  // Forecast state
  const [horizon, setHorizon] = useState<7 | 14 | 30>(30);
  const [lockedBuffer, setLockedBuffer] = useState(false);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Add Obligation modal state
  const [isAddObligationOpen, setIsAddObligationOpen] = useState(false);
  const [newObligationName, setNewObligationName] = useState('');
  const [newObligationAmount, setNewObligationAmount] = useState('');
  const [newObligationDay, setNewObligationDay] = useState('1');
  const [newObligationCategory, setNewObligationCategory] = useState('Housing');
  const [newObligationRecurrence, setNewObligationRecurrence] = useState('monthly');

  // Edit Obligation modal state
  const [editingObligation, setEditingObligation] = useState<RecurringObligation | null>(null);
  const [editObligationName, setEditObligationName] = useState('');
  const [editObligationAmount, setEditObligationAmount] = useState('');
  const [editObligationDay, setEditObligationDay] = useState('1');
  const [editObligationCategory, setEditObligationCategory] = useState('Housing');
  const [editObligationRecurrence, setEditObligationRecurrence] = useState('monthly');

  // Delete Confirmation modal state
  const [obligationToDelete, setObligationToDelete] = useState<UpcomingExpenseItem | null>(null);

  // Authentic starting balance from linked accounts
  const startingBalance =
    user?.linkedAccounts && user.linkedAccounts.length > 0
      ? user.linkedAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      : 0;

  const recurringObligations: RecurringObligation[] = user?.recurringObligations || [];

  // Authentic Date Reference
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 1. Unified Upcoming Expenses list from configured recurring obligations and recurring transactions
  const allUpcomingExpenses = useMemo<UpcomingExpenseItem[]>(() => {
    const items: UpcomingExpenseItem[] = [];
    const coveredNames = new Set<string>();

    // Process configured recurring obligations
    recurringObligations.forEach((o) => {
      coveredNames.add(o.name.trim().toLowerCase());

      const isExplicitlyPaid = Boolean(
        o.isPaid || (o.lastPaidDate && o.lastPaidDate.startsWith(currentMonthStr))
      );

      // Check if matched by a real transaction in current month
      const matchingTx = transactions.find((t) => {
        if (t.type !== 'expense' || !t.date || !t.date.startsWith(currentMonthStr)) return false;
        const tDesc = (t.description || '').toLowerCase();
        const tMerch = (t.merchant || '').toLowerCase();
        const oName = o.name.toLowerCase();
        const matchesName = tDesc.includes(oName) || tMerch.includes(oName) || oName.includes(tMerch);
        const matchesAmount = Math.abs(t.amount - o.amount) < 100;
        return matchesName && (matchesAmount || t.isRecurring);
      });

      const isPaid = isExplicitlyPaid || Boolean(matchingTx);
      const clampedDay = Math.min(Math.max(1, o.dueDay), daysInCurrentMonth);
      const dueDateObj = new Date(currentYear, currentMonth, clampedDay);
      const formattedDueDate = dueDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      let status: 'Upcoming' | 'Due Soon' | 'Overdue' | 'Paid';
      if (isPaid) {
        status = 'Paid';
      } else if (clampedDay < currentDay) {
        status = 'Overdue';
      } else if (clampedDay <= currentDay + 3) {
        status = 'Due Soon';
      } else {
        status = 'Upcoming';
      }

      items.push({
        id: o.id,
        name: o.name,
        category: o.category || 'Utility & Fixed Costs',
        amount: o.amount,
        dueDay: clampedDay,
        dueDate: formattedDueDate,
        daysRemaining: clampedDay - currentDay,
        status,
        isRecurring: true,
        recurrenceRule: o.recurrenceRule || 'monthly',
        isEnabled: o.isEnabled !== false,
        isPaid,
        source: 'obligation',
        rawObligation: o,
        matchedTxId: matchingTx?.id,
      });
    });

    // Discover recurring transactions from history that are not yet in recurringObligations
    const seenTxKeys = new Set<string>();
    transactions.forEach((t) => {
      if (t.type !== 'expense' || !t.isRecurring) return;
      const tDesc = (t.description || '').trim().toLowerCase();
      const tMerch = (t.merchant || '').trim().toLowerCase();
      const isAlreadyCovered = Array.from(coveredNames).some((c) =>
        tDesc.includes(c) || c.includes(tDesc) || (tMerch && (tMerch.includes(c) || c.includes(tMerch)))
      );
      if (isAlreadyCovered) return;

      const key = tMerch || tDesc;
      if (!key || seenTxKeys.has(key)) return;
      seenTxKeys.add(key);

      const dueDay = parseInt(t.date?.split('-')[2] || '1', 10);
      const clampedDay = Math.min(Math.max(1, dueDay), daysInCurrentMonth);
      const dueDateObj = new Date(currentYear, currentMonth, clampedDay);
      const formattedDueDate = dueDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const isPaid = Boolean(t.date && t.date.startsWith(currentMonthStr));

      let status: 'Upcoming' | 'Due Soon' | 'Overdue' | 'Paid';
      if (isPaid) {
        status = 'Paid';
      } else if (clampedDay < currentDay) {
        status = 'Overdue';
      } else if (clampedDay <= currentDay + 3) {
        status = 'Due Soon';
      } else {
        status = 'Upcoming';
      }

      items.push({
        id: `tx-rec-${t.id}`,
        name: t.merchant || t.description || 'Recurring Expense',
        category: t.category || 'Utility & Fixed Costs',
        amount: t.amount,
        dueDay: clampedDay,
        dueDate: formattedDueDate,
        daysRemaining: clampedDay - currentDay,
        status,
        isRecurring: true,
        recurrenceRule: 'monthly',
        isEnabled: true,
        isPaid,
        source: 'transaction',
        matchedTxId: t.id,
      });
    });

    return items;
  }, [
    recurringObligations,
    transactions,
    currentYear,
    currentMonth,
    currentDay,
    currentMonthStr,
    daysInCurrentMonth,
  ]);

  // 2. Filter obligations for the selected forecast horizon (7, 14, 30 days)
  const itemsInHorizon = useMemo(() => {
    return allUpcomingExpenses
      .filter((item) => item.isEnabled && item.dueDay <= horizon)
      .sort((a, b) => {
        // Unpaid items first, then nearest dueDay
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.dueDay - b.dueDay;
      });
  }, [allUpcomingExpenses, horizon]);

  const unpaidItemsInHorizon = useMemo(() => {
    return itemsInHorizon.filter((item) => !item.isPaid);
  }, [itemsInHorizon]);

  const paidItemsInHorizon = useMemo(() => {
    return itemsInHorizon.filter((item) => item.isPaid);
  }, [itemsInHorizon]);

  // Exact upcoming obligations total and count for the selected forecast period
  const upcomingBillsInHorizon = useMemo(() => {
    return unpaidItemsInHorizon.reduce((sum, item) => sum + item.amount, 0);
  }, [unpaidItemsInHorizon]);

  const unpaidCount = unpaidItemsInHorizon.length;

  // Items to display in the table based on status filter
  const displayedItems = useMemo(() => {
    if (statusFilter === 'unpaid') return unpaidItemsInHorizon;
    if (statusFilter === 'paid') return paidItemsInHorizon;
    return itemsInHorizon;
  }, [itemsInHorizon, unpaidItemsInHorizon, paidItemsInHorizon, statusFilter]);

  // 3. Generate authentic forecast reflecting only UNPAID future obligations
  const effectiveObligationsForForecast = useMemo(() => {
    return recurringObligations.map((o) => {
      const match = allUpcomingExpenses.find((it) => it.id === o.id);
      return {
        ...o,
        isPaid: match ? match.isPaid : Boolean(o.isPaid),
      };
    });
  }, [recurringObligations, allUpcomingExpenses]);

  const forecast = getDetailedForecast(
    startingBalance,
    false,
    transactions,
    effectiveObligationsForForecast
  );

  const allForecastPoints = forecast.forecastCurve || [];
  const visiblePoints = allForecastPoints.slice(0, horizon);
  const endPoint = visiblePoints[visiblePoints.length - 1];
  const projectedEndBalance = endPoint ? endPoint.projectedBalance : startingBalance;

  // Authentic daily burn calculation
  const nonRecurringExpenses = transactions.filter((t) => t.type === 'expense' && !t.isRecurring);
  const totalNonRecurring = nonRecurringExpenses.reduce((sum, t) => sum + t.amount, 0);
  const dailyBurn = nonRecurringExpenses.length > 0 ? Math.round(totalNonRecurring / 30) : 0;
  const recommendedBuffer = forecast.recommendedBuffer;

  // 4. Handle Mark As Paid / Unpaid
  const handleTogglePaid = (item: UpcomingExpenseItem) => {
    const isCurrentlyPaid = item.isPaid;
    const targetId = item.id;

    if (item.source === 'obligation') {
      const updated = recurringObligations.map((o) => {
        if (o.id === targetId) {
          return {
            ...o,
            isPaid: !isCurrentlyPaid,
            lastPaidDate: !isCurrentlyPaid ? new Date().toISOString().slice(0, 10) : undefined,
          };
        }
        return o;
      });

      if (user && onUpdateUser) {
        onUpdateUser({
          ...user,
          recurringObligations: updated,
        });
      }
    } else {
      // If transaction-sourced item, convert it to an explicit obligation so state persists
      const newObligation: RecurringObligation = {
        id: `obl-${Date.now()}`,
        userId: user?.id,
        name: item.name,
        amount: item.amount,
        dueDay: item.dueDay,
        category: item.category,
        recurrenceRule: 'monthly',
        isEnabled: true,
        isPaid: !isCurrentlyPaid,
        lastPaidDate: !isCurrentlyPaid ? new Date().toISOString().slice(0, 10) : undefined,
      };

      if (user && onUpdateUser) {
        onUpdateUser({
          ...user,
          recurringObligations: [...recurringObligations, newObligation],
        });
      }
    }

    // If marking as paid, record the expense transaction via onAddTransaction
    if (!isCurrentlyPaid && onAddTransaction) {
      onAddTransaction({
        id: `tx-bill-${Date.now()}`,
        userId: user?.id,
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        category: item.category as any,
        amount: item.amount,
        description: `${item.name} Payment`,
        merchant: item.name,
        account: (user?.linkedAccounts?.[0]?.name as any) || 'bKash',
        paymentMethod: 'Auto Bill Pay',
        classification: 'essential',
        isRecurring: true,
      });
    }

    setToastMessage({
      type: 'success',
      text: !isCurrentlyPaid
        ? `"${item.name}" marked as paid! ${formatMoney(item.amount)} deducted from upcoming obligations.`
        : `"${item.name}" marked as unpaid. Forecast recalculated.`,
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 5. Handle Adding a New Obligation
  const handleAddObligation = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = parseFloat(newObligationAmount);
    const day = parseInt(newObligationDay, 10);
    if (!newObligationName.trim() || isNaN(rawAmount) || rawAmount <= 0 || isNaN(day) || day < 1 || day > 31) {
      return;
    }

    const bdtAmount =
      userCurrency === 'BDT' ? rawAmount : convertAmount(rawAmount, userCurrency, 'BDT');

    const newObligation: RecurringObligation = {
      id: `obl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user?.id,
      name: newObligationName.trim(),
      amount: Math.round(bdtAmount),
      dueDay: day,
      category: newObligationCategory || 'Housing',
      recurrenceRule: newObligationRecurrence || 'monthly',
      isEnabled: true,
      isPaid: false,
    };

    if (user && onUpdateUser) {
      onUpdateUser({
        ...user,
        recurringObligations: [...recurringObligations, newObligation],
      });
    }

    setNewObligationName('');
    setNewObligationAmount('');
    setNewObligationDay('1');
    setNewObligationCategory('Housing');
    setNewObligationRecurrence('monthly');
    setIsAddObligationOpen(false);

    setToastMessage({
      type: 'success',
      text: `Added "${newObligation.name}" (${formatMoney(newObligation.amount)}) to upcoming obligations.`,
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 6. Handle Editing an Obligation
  const openEditModal = (item: UpcomingExpenseItem) => {
    let ob = item.rawObligation;
    if (!ob) {
      ob = {
        id: item.id.replace('tx-rec-', ''),
        userId: user?.id,
        name: item.name,
        amount: item.amount,
        dueDay: item.dueDay,
        category: item.category,
        recurrenceRule: item.recurrenceRule,
        isEnabled: item.isEnabled,
        isPaid: item.isPaid,
      };
    }
    setEditingObligation(ob);
    setEditObligationName(ob.name);
    setEditObligationAmount(
      userCurrency === 'BDT'
        ? ob.amount.toString()
        : convertAmount(ob.amount, 'BDT', userCurrency).toString()
    );
    setEditObligationDay(ob.dueDay.toString());
    setEditObligationCategory(ob.category || 'Housing');
    setEditObligationRecurrence(ob.recurrenceRule || 'monthly');
  };

  const handleSaveEditObligation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingObligation) return;

    const rawAmount = parseFloat(editObligationAmount);
    const day = parseInt(editObligationDay, 10);
    if (!editObligationName.trim() || isNaN(rawAmount) || rawAmount <= 0 || isNaN(day) || day < 1 || day > 31) {
      return;
    }

    const bdtAmount =
      userCurrency === 'BDT' ? rawAmount : convertAmount(rawAmount, userCurrency, 'BDT');

    const updatedObligation: RecurringObligation = {
      ...editingObligation,
      name: editObligationName.trim(),
      amount: Math.round(bdtAmount),
      dueDay: day,
      category: editObligationCategory,
      recurrenceRule: editObligationRecurrence,
    };

    const exists = recurringObligations.some((o) => o.id === editingObligation.id);
    const updatedList = exists
      ? recurringObligations.map((o) => (o.id === editingObligation.id ? updatedObligation : o))
      : [...recurringObligations, updatedObligation];

    if (user && onUpdateUser) {
      onUpdateUser({
        ...user,
        recurringObligations: updatedList,
      });
    }

    setEditingObligation(null);
    setToastMessage({
      type: 'success',
      text: `Obligation "${updatedObligation.name}" updated successfully.`,
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 7. Handle Deleting an Obligation
  const handleConfirmDelete = () => {
    if (!obligationToDelete) return;

    const updated = recurringObligations.filter((o) => o.id !== obligationToDelete.id);
    if (user && onUpdateUser) {
      onUpdateUser({
        ...user,
        recurringObligations: updated,
      });
    }

    setToastMessage({
      type: 'success',
      text: `Obligation "${obligationToDelete.name}" removed from forecast.`,
    });
    setTimeout(() => setToastMessage(null), 4000);
    setObligationToDelete(null);
  };

  // 8. Generate dynamic scheduled events list for Key Events Table
  const scheduledEvents = useMemo(() => {
    const events: Array<{
      day: number;
      date: string;
      event: string;
      impact: string;
      type: 'inflow' | 'neutral' | 'pressure' | 'safe';
      cushion: string;
    }> = [];

    // Day 1: Starting Point
    events.push({
      day: 1,
      date: 'Day 1',
      event: 'Starting Account Balance',
      impact: `+${formatMoney(startingBalance)}`,
      type: 'neutral',
      cushion: formatMoney(startingBalance),
    });

    // Unpaid obligations due in horizon
    unpaidItemsInHorizon
      .sort((a, b) => a.dueDay - b.dueDay)
      .forEach((o) => {
        const pointOnDay = visiblePoints.find((p) => p.day === o.dueDay);
        const cushionVal = pointOnDay ? pointOnDay.projectedBalance : startingBalance;
        events.push({
          day: o.dueDay,
          date: `Day ${o.dueDay}`,
          event: o.name,
          impact: `-${formatMoney(o.amount)}`,
          type: 'pressure',
          cushion: formatMoney(cushionVal),
        });
      });

    // Recurring Inflows in horizon
    transactions
      .filter((t) => t.type === 'income' && t.isRecurring)
      .forEach((t) => {
        const dueDay = parseInt(t.date?.split('-')[2] || '1', 10);
        if (dueDay <= horizon) {
          const pointOnDay = visiblePoints.find((p) => p.day === dueDay);
          const cushionVal = pointOnDay ? pointOnDay.projectedBalance : startingBalance;
          events.push({
            day: dueDay,
            date: `Day ${dueDay}`,
            event: t.description || 'Recurring Income',
            impact: `+${formatMoney(t.amount)}`,
            type: 'inflow',
            cushion: formatMoney(cushionVal),
          });
        }
      });

    // Horizon End: Projected Closing Balance
    events.push({
      day: horizon,
      date: `Day ${horizon}`,
      event: 'Projected Closing Balance',
      impact: `${projectedEndBalance >= 0 ? '+' : ''}${formatMoney(projectedEndBalance)}`,
      type: projectedEndBalance >= recommendedBuffer ? 'safe' : 'pressure',
      cushion: formatMoney(projectedEndBalance),
    });

    return events.sort((a, b) => a.day - b.day);
  }, [
    startingBalance,
    unpaidItemsInHorizon,
    visiblePoints,
    transactions,
    horizon,
    projectedEndBalance,
    recommendedBuffer,
    userCurrency,
  ]);

  // Calculate dynamic SVG coordinates from visiblePoints
  const svgCoordinates = useMemo(() => {
    if (visiblePoints.length < 2) {
      return { path: 'M 0,150 L 800,150', area: 'M 0,150 L 800,150 L 800,230 L 0,230 Z' };
    }
    const balances = visiblePoints.map((p) => p.projectedBalance);
    const minVal = Math.min(...balances, 0);
    const maxVal = Math.max(...balances, startingBalance, 1000);
    const range = maxVal - minVal || 1;

    const coords = visiblePoints.map((p, i) => {
      const x = Math.round((i / (visiblePoints.length - 1)) * 800);
      const y = Math.round(210 - ((p.projectedBalance - minVal) / range) * 160);
      return { x, y };
    });

    const pathD = 'M ' + coords.map((c) => `${c.x},${c.y}`).join(' L ');
    const areaD = `${pathD} L 800,230 L 0,230 Z`;
    return { path: pathD, area: areaD };
  }, [visiblePoints, startingBalance]);

  const hasPressure = forecast.pressureDays.length > 0;

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in duration-300 ${
            toastMessage.type === 'error'
              ? 'bg-error text-on-error'
              : 'bg-secondary text-on-secondary'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              {toastMessage.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span className="font-title-md text-sm sm:text-title-md">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded hover:bg-white/20"
            aria-label="Close notification"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header with Horizon Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
              AI-assisted forecast
            </span>
            <span className="font-label-sm text-label-sm text-outline">
              Continuous Digital Ledger Model • Indicative, not guaranteed
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
            Cash Flow Forecast &amp; Liquidity Buffer
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-0.5">
            Understand upcoming obligations, eliminate month-end overdraft stress, and plan your liquidity buffer.
          </p>
        </div>

        {/* Controls: Horizon Tabs */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-surface-container shadow-inner border border-outline-variant/20">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setHorizon(days)}
                className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all font-semibold ${
                  horizon === days
                    ? 'bg-surface-container-lowest shadow-sm text-on-surface font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pressure Zone Alert Banner */}
      {hasPressure ? (
        <div className="p-space-md rounded-2xl bg-error-container/20 border border-error/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-error-container text-error flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-title-md text-title-md text-on-surface font-bold">
                  Upcoming Cash Flow Pressure Zone (Day {forecast.pressureDays.join(', ')})
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] font-bold">
                  High Focus
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Scheduled commitments may reduce your available cash buffer during these days. Reserve liquidity early.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLockedBuffer(!lockedBuffer)}
            className={`px-4 py-2.5 rounded-xl font-title-md text-sm whitespace-nowrap transition-all shadow-sm ${
              lockedBuffer
                ? 'bg-secondary text-on-secondary font-bold'
                : 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
            }`}
          >
            {lockedBuffer
              ? `✓ ${formatMoney(recommendedBuffer)} Buffer Reserved`
              : `Lock ${formatMoney(recommendedBuffer)} Buffer Now`}
          </button>
        </div>
      ) : (
        <div className="p-space-md rounded-2xl bg-secondary-container/20 border border-secondary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-secondary-container text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <h3 className="font-title-md text-title-md text-on-surface font-bold">
                Cash Flow Stable &amp; Well-Buffered
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {itemsInHorizon.length === 0
                  ? `No upcoming scheduled obligations within this ${horizon}-day window. Add recurring bills or rent to customize your forecast.`
                  : `Projected cash flow remains positive throughout the ${horizon}-day period.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAddObligationOpen(true)}
            className="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface border border-outline-variant/30 hover:bg-surface-container font-title-md text-sm flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">add</span>
            <span>+ Add Recurring Bill</span>
          </button>
        </div>
      )}

      {/* KPI Forecast Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Starting Balance */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            Starting Balance
          </span>
          <span className="font-headline-lg text-headline-lg text-on-surface font-bold mt-1">
            {formatMoney(startingBalance)}
          </span>
          <span className="text-xs text-on-surface-variant mt-1">
            {user?.linkedAccounts?.length || 0} Linked Accounts
          </span>
        </div>

        {/* Projected Day Balance */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            Projected Day {horizon} Balance
          </span>
          <span className="font-headline-lg text-headline-lg text-secondary font-bold mt-1">
            {formatMoney(projectedEndBalance)}
          </span>
          <span className="text-xs text-secondary font-medium mt-1">
            Authentic baseline
          </span>
        </div>

        {/* Upcoming Obligations Card (Synchronized with Details) */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-outline uppercase tracking-wider">
              Upcoming Obligations
            </span>
            <button
              onClick={() => setIsBreakdownExpanded((prev) => !prev)}
              className="text-[11px] font-bold text-secondary hover:underline flex items-center gap-0.5"
              title={isBreakdownExpanded ? 'Hide breakdown details' : 'View breakdown details'}
            >
              <span>{isBreakdownExpanded ? 'Hide' : 'Details'}</span>
              <span className="material-symbols-outlined text-[14px]">
                {isBreakdownExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>
          <span className="font-headline-lg text-headline-lg text-error font-bold mt-1">
            {formatMoney(upcomingBillsInHorizon)}
          </span>
          <span className="text-xs text-on-surface-variant mt-1">
            {unpaidCount > 0
              ? `${unpaidCount} upcoming ${unpaidCount === 1 ? 'bill' : 'bills'} in ${horizon}d`
              : `No unpaid bills in ${horizon}d window`}
          </span>
        </div>

        {/* Recommended Buffer */}
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            Recommended Buffer
          </span>
          <span className="font-headline-lg text-headline-lg text-on-surface font-bold mt-1">
            {formatMoney(recommendedBuffer)}
          </span>
          <span className="text-xs text-secondary font-medium mt-1">
            {lockedBuffer ? 'Reserved in liquid vault' : 'Calculated safety margin'}
          </span>
        </div>
      </div>

      {/* SECTION: Upcoming Expense Breakdown & Management */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/15 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary-container/30 text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Upcoming Expense Breakdown
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold">
                  {horizon}-Day Window
                </span>
                {unpaidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-error-container/20 text-error font-label-sm text-xs font-bold">
                    {unpaidCount} Pending ({formatMoney(upcomingBillsInHorizon)})
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Exact breakdown of where your upcoming money is committed, with payment dates and statuses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Status Filter Tabs */}
            <div className="inline-flex p-0.5 rounded-lg bg-surface-container border border-outline-variant/20 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  statusFilter === 'all'
                    ? 'bg-surface-container-lowest text-on-surface font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({itemsInHorizon.length})
              </button>
              <button
                onClick={() => setStatusFilter('unpaid')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  statusFilter === 'unpaid'
                    ? 'bg-surface-container-lowest text-on-surface font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Unpaid ({unpaidItemsInHorizon.length})
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  statusFilter === 'paid'
                    ? 'bg-surface-container-lowest text-on-surface font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Paid ({paidItemsInHorizon.length})
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={() => setIsAddObligationOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-bold flex items-center gap-1 shadow-xs hover:opacity-95 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add Bill</span>
            </button>

            {/* Expand / Collapse Button */}
            <button
              onClick={() => setIsBreakdownExpanded((prev) => !prev)}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
              title={isBreakdownExpanded ? 'Collapse section' : 'Expand section'}
              aria-label={isBreakdownExpanded ? 'Collapse section' : 'Expand section'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isBreakdownExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isBreakdownExpanded ? (
          <div>
            {displayedItems.length === 0 ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center text-center rounded-xl bg-surface-container-low/40 border border-outline-variant/15">
                <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-outline mb-2">
                  <span className="material-symbols-outlined text-[26px]">event_busy</span>
                </div>
                <h4 className="font-title-md text-title-md font-bold text-on-surface">
                  {statusFilter === 'paid'
                    ? `No paid obligations in the ${horizon}-day window`
                    : statusFilter === 'unpaid'
                    ? `No unpaid obligations in the ${horizon}-day window`
                    : `No upcoming expenses scheduled within this ${horizon}-day forecast period`}
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md mt-1">
                  {statusFilter === 'paid'
                    ? 'Bills you mark as paid will be archived here for easy reference.'
                    : `Add your rent, utilities, internet, loans, or subscriptions to forecast exact cash requirements.`}
                </p>
                {statusFilter !== 'paid' && (
                  <button
                    onClick={() => setIsAddObligationOpen(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm flex items-center gap-1.5 shadow-sm hover:opacity-95 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>+ Add Bill / Obligation</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-outline-variant/15 rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-surface-container-low/60 text-outline uppercase font-label-sm text-[11px] tracking-wider border-b border-outline-variant/15">
                      <th className="py-3 px-4 font-bold">Expense</th>
                      <th className="py-3 px-4 font-bold">Due Date</th>
                      <th className="py-3 px-4 font-bold text-right">Amount</th>
                      <th className="py-3 px-4 font-bold text-center">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {displayedItems.map((item) => {
                      const meta = getCategoryMetadata(item.category);
                      const isRowPaid = item.isPaid;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-surface-container/30 transition-colors ${
                            isRowPaid ? 'bg-surface-container-lowest/50 opacity-80' : ''
                          }`}
                        >
                          {/* Expense Name & Category */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${meta.iconClass}`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {meta.icon}
                                </span>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-title-md text-sm font-bold truncate ${
                                      isRowPaid
                                        ? 'line-through text-on-surface-variant'
                                        : 'text-on-surface'
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                  {item.isRecurring && (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-outline uppercase tracking-wider bg-surface-container px-1.5 py-0.5 rounded"
                                      title="Recurring monthly obligation"
                                    >
                                      <span className="material-symbols-outlined text-[11px]">
                                        repeat
                                      </span>
                                      {item.recurrenceRule || 'Monthly'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[11px] font-medium border ${meta.badgeClass}`}
                                  >
                                    {meta.label}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Due Date & Relative Timing */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface text-sm">
                                {item.dueDate}
                              </span>
                              <span className="text-xs text-on-surface-variant">
                                {isRowPaid
                                  ? 'Payment Completed'
                                  : item.daysRemaining === 0
                                  ? 'Due Today'
                                  : item.daysRemaining < 0
                                  ? `${Math.abs(item.daysRemaining)} day(s) overdue`
                                  : item.daysRemaining === 1
                                  ? 'Due tomorrow'
                                  : `Due in ${item.daysRemaining} days (Day ${item.dueDay})`}
                              </span>
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span
                              className={`font-headline-md text-base font-bold ${
                                isRowPaid ? 'text-on-surface-variant' : 'text-error'
                              }`}
                            >
                              {formatMoney(item.amount)}
                            </span>
                          </td>

                          {/* Payment Status Badge */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {item.status === 'Paid' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                <span className="material-symbols-outlined text-[14px]">
                                  check_circle
                                </span>
                                Paid
                              </span>
                            )}
                            {item.status === 'Overdue' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-error-container/30 text-error border border-error/30 animate-pulse">
                                <span className="material-symbols-outlined text-[14px]">
                                  warning
                                </span>
                                Overdue
                              </span>
                            )}
                            {item.status === 'Due Soon' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                <span className="material-symbols-outlined text-[14px]">
                                  hourglass_top
                                </span>
                                Due Soon
                              </span>
                            )}
                            {item.status === 'Upcoming' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-secondary-container/30 text-secondary border border-secondary/30">
                                <span className="material-symbols-outlined text-[14px]">
                                  schedule
                                </span>
                                Upcoming
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Mark Paid / Unpaid Button */}
                              <button
                                onClick={() => handleTogglePaid(item)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs ${
                                  isRowPaid
                                    ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                                    : 'bg-secondary text-on-secondary hover:opacity-95 active:scale-95'
                                }`}
                                title={isRowPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isRowPaid ? 'undo' : 'check'}
                                </span>
                                <span>{isRowPaid ? 'Mark Unpaid' : 'Mark Paid'}</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                                title="Edit Obligation"
                                aria-label={`Edit ${item.name}`}
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => setObligationToDelete(item)}
                                className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                                title="Delete Obligation"
                                aria-label={`Delete ${item.name}`}
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => setIsBreakdownExpanded(true)}
            className="p-3.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/15 flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors"
          >
            <div className="flex items-center gap-2 text-sm text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]">info</span>
              <span>
                <strong>{unpaidCount} upcoming bill(s)</strong> totaling{' '}
                <strong className="text-error">{formatMoney(upcomingBillsInHorizon)}</strong> scheduled in
                this {horizon}-day window.
              </span>
            </div>
            <span className="text-xs font-semibold text-secondary flex items-center gap-0.5">
              <span>View Details</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </span>
          </div>
        )}
      </div>

      {/* Main Forecast Line Chart Canvas Card */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-outline-variant/15 gap-2">
          <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="w-3 h-1 bg-secondary rounded-full"></span>{' '}
              Projected Balance Curve
            </span>
            <span className="flex items-center gap-1.5 text-outline">
              <span className="w-3 h-1 bg-outline-variant rounded-full"></span>{' '}
              Daily Burn (~{formatMoney(dailyBurn)}/day)
            </span>
            {hasPressure && (
              <span className="flex items-center gap-1.5 text-error">
                <span className="w-2 h-2 rounded-full bg-error"></span>{' '}
                Pressure Zone
              </span>
            )}
          </div>
          <span className="text-xs text-outline font-medium">
            {forecast.period || `${horizon} Days Forecast`}
          </span>
        </div>

        {/* SVG Visualization Canvas */}
        <div className="w-full h-64 relative bg-surface-container-low/30 rounded-xl p-3 border border-outline-variant/15">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 240">
            <defs>
              <linearGradient id="cfGradH" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#006c49" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#006c49" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line opacity="0.4" stroke="#d3e4fe" strokeDasharray="4 4" x1="0" x2="800" y1="40" y2="40" />
            <line opacity="0.4" stroke="#d3e4fe" strokeDasharray="4 4" x1="0" x2="800" y1="100" y2="100" />
            <line opacity="0.4" stroke="#d3e4fe" strokeDasharray="4 4" x1="0" x2="800" y1="160" y2="160" />
            <line opacity="0.4" stroke="#d3e4fe" strokeDasharray="4 4" x1="0" x2="800" y1="210" y2="210" />

            {/* Dynamic Area Fill */}
            <path
              d={svgCoordinates.area}
              fill="url(#cfGradH)"
              className="transition-all duration-700 ease-out"
            />

            {/* Dynamic Projected Curve */}
            <path
              d={svgCoordinates.path}
              fill="none"
              stroke="#006c49"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Timeline X Markers */}
          <div className="flex justify-between items-center text-outline font-label-sm text-[11px] pt-2 px-1">
            <span>Day 1 (Start)</span>
            {horizon >= 14 && (
              <span className="text-on-surface font-semibold">
                Day {Math.round(horizon / 2)} (Mid-point)
              </span>
            )}
            <span>Day {horizon} (End)</span>
          </div>
        </div>
      </div>

      {/* Explanation of Forecast Assumptions Card */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">info</span>
            <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
              Forecast Assumptions &amp; Methodology
            </h3>
          </div>
          <button
            onClick={() => setIsAddObligationOpen(true)}
            className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Bill / Obligation</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">speed</span>
              Daily Burn Rate
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {dailyBurn > 0
                ? `Calibrated at ${formatMoney(dailyBurn)}/day based on past 30-day non-recurring spending.`
                : 'No expense history recorded. Daily burn rate will calibrate as you log transactions.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-error">event</span>
              Scheduled Recurring Obligations
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {unpaidCount > 0
                ? `Total ${unpaidCount} unpaid obligation(s) totaling ${formatMoney(upcomingBillsInHorizon)} scheduled in this ${horizon}-day window.`
                : 'No pending recurring obligations in this forecast period.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
              Available Liquidity
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {startingBalance > 0
                ? `Starting balance of ${formatMoney(startingBalance)} across your linked accounts.`
                : 'No liquid balance registered. Update your linked account balances on the Dashboard.'}
            </p>
          </div>
        </div>
      </div>

      {/* Scheduled Inflow/Outflow Timeline Table */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
            Key Events within {horizon}-Day Window
          </h3>
          <button
            onClick={() => onNavigate('ai-coach')}
            className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
          >
            <span>Ask AI Coach Details</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="divide-y divide-surface-container-low border border-outline-variant/15 rounded-xl overflow-hidden text-sm">
          <div className="p-3 bg-surface-container-low/50 font-bold text-xs text-outline uppercase tracking-wider flex justify-between">
            <span className="w-24">Date</span>
            <span className="flex-1">Event / Outflow</span>
            <span className="w-28 text-right">Cash Flow</span>
            <span className="w-28 text-right">Cushion</span>
          </div>
          {scheduledEvents.map((ev, i) => (
            <div
              key={i}
              className={`p-3.5 flex items-center justify-between ${
                ev.type === 'pressure'
                  ? 'bg-error-container/15'
                  : ev.type === 'inflow'
                  ? 'bg-secondary-container/15'
                  : ''
              }`}
            >
              <span className="w-24 font-semibold text-on-surface">{ev.date}</span>
              <span className="flex-1 text-on-surface truncate pr-2">{ev.event}</span>
              <span
                className={`w-28 text-right font-bold ${
                  ev.type === 'inflow'
                    ? 'text-secondary'
                    : ev.type === 'pressure'
                    ? 'text-error'
                    : 'text-on-surface'
                }`}
              >
                {ev.impact}
              </span>
              <span className="w-28 text-right font-semibold text-on-surface">{ev.cushion}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Add Recurring Bill / Obligation */}
      {isAddObligationOpen && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Add Recurring Bill / Obligation
              </h3>
              <button
                onClick={() => setIsAddObligationOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddObligation} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Obligation Name (e.g. House Rent, Internet Bill)
                </label>
                <input
                  type="text"
                  required
                  value={newObligationName}
                  onChange={(e) => setNewObligationName(e.target.value)}
                  placeholder="e.g. House Rent"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Category
                </label>
                <select
                  value={newObligationCategory}
                  onChange={(e) => setNewObligationCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                >
                  <option value="Housing">Housing (Rent, Maintenance)</option>
                  <option value="Utilities">Utilities (Electricity, Water, Gas, Internet)</option>
                  <option value="Transport">Transport (Bus, Metro, Fuel)</option>
                  <option value="Loan & Debt">Loan &amp; Debt (DPS, Loan, Credit Card)</option>
                  <option value="Subscription">Subscription (Streaming, Software, Gym)</option>
                  <option value="Education">Education (Tuition, Courses)</option>
                  <option value="Food & Groceries">Food &amp; Groceries</option>
                  <option value="Other Fixed Costs">Other Fixed Costs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Amount ({currConfig.displaySymbol})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newObligationAmount}
                  onChange={(e) => setNewObligationAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Due Day of Month (1 - 31)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={newObligationDay}
                    onChange={(e) => setNewObligationDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Recurrence
                  </label>
                  <select
                    value={newObligationRecurrence}
                    onChange={(e) => setNewObligationRecurrence(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddObligationOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-outline hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-secondary text-on-secondary shadow-sm hover:opacity-95 active:scale-95 transition-all"
                >
                  Save Obligation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Obligation */}
      {editingObligation && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Edit Upcoming Obligation
              </h3>
              <button
                onClick={() => setEditingObligation(null)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEditObligation} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Obligation Name
                </label>
                <input
                  type="text"
                  required
                  value={editObligationName}
                  onChange={(e) => setEditObligationName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Category
                </label>
                <select
                  value={editObligationCategory}
                  onChange={(e) => setEditObligationCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                >
                  <option value="Housing">Housing (Rent, Maintenance)</option>
                  <option value="Utilities">Utilities (Electricity, Water, Gas, Internet)</option>
                  <option value="Transport">Transport (Bus, Metro, Fuel)</option>
                  <option value="Loan & Debt">Loan &amp; Debt (DPS, Loan, Credit Card)</option>
                  <option value="Subscription">Subscription (Streaming, Software, Gym)</option>
                  <option value="Education">Education (Tuition, Courses)</option>
                  <option value="Food & Groceries">Food &amp; Groceries</option>
                  <option value="Other Fixed Costs">Other Fixed Costs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Amount ({currConfig.displaySymbol})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editObligationAmount}
                  onChange={(e) => setEditObligationAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Due Day of Month (1 - 31)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={editObligationDay}
                    onChange={(e) => setEditObligationDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                    Recurrence
                  </label>
                  <select
                    value={editObligationRecurrence}
                    onChange={(e) => setEditObligationRecurrence(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingObligation(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-outline hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary shadow-sm hover:opacity-95 active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {obligationToDelete && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between text-error">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">delete</span>
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                  Delete Upcoming Obligation
                </h3>
              </div>
              <button
                onClick={() => setObligationToDelete(null)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-lg shrink-0">
                <span className="material-symbols-outlined text-[20px] text-secondary">
                  {getCategoryMetadata(obligationToDelete.category).icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-title-md text-title-md font-bold text-on-surface truncate">
                  {obligationToDelete.name}
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  Amount: {formatMoney(obligationToDelete.amount)} • Due Day: {obligationToDelete.dueDay}
                </p>
              </div>
            </div>

            <p className="font-body-md text-body-md text-on-surface leading-relaxed">
              Are you sure you want to delete this upcoming obligation? This bill will be removed from your cash flow forecast.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setObligationToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-title-md hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-error text-on-error font-title-md hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>Delete Obligation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
