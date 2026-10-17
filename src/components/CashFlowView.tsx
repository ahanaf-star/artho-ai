import React, { useState } from 'react';
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
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  onNavigate,
  isBangla,
  user,
  transactions = [],
  goals: _goals = [],
  onUpdateUser,
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

  const [horizon, setHorizon] = useState<7 | 14 | 30>(30);
  const [isSimulated, setIsSimulated] = useState(false);
  const [lockedBuffer, setLockedBuffer] = useState(false);
  const [isAddObligationOpen, setIsAddObligationOpen] = useState(false);
  const [newObligationName, setNewObligationName] = useState('');
  const [newObligationAmount, setNewObligationAmount] = useState('');
  const [newObligationDay, setNewObligationDay] = useState('1');

  // Authentic starting balance from linked accounts
  const startingBalance =
    user?.linkedAccounts && user.linkedAccounts.length > 0
      ? user.linkedAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      : 0;

  const recurringObligations: RecurringObligation[] = user?.recurringObligations || [];

  // Generate detailed authentic forecast
  const forecast = getDetailedForecast(
    startingBalance,
    isSimulated,
    transactions,
    recurringObligations
  );

  const allForecastPoints = forecast.forecastCurve || [];
  const visiblePoints = allForecastPoints.slice(0, horizon);
  const endPoint = visiblePoints[visiblePoints.length - 1];
  const projectedEndBalance = endPoint ? endPoint.projectedBalance : startingBalance;

  // Authentic daily burn calculation
  const nonRecurringExpenses = transactions.filter((t) => t.type === 'expense' && !t.isRecurring);
  const totalNonRecurring = nonRecurringExpenses.reduce((sum, t) => sum + t.amount, 0);
  const dailyBurn = nonRecurringExpenses.length > 0 ? Math.round(totalNonRecurring / 30) : 0;
  const simulationSaving = isSimulated ? Math.min(300, Math.round(dailyBurn * 0.15)) : 0;

  // Active upcoming obligations within the selected horizon
  const activeObligations = recurringObligations.filter((o) => o.isEnabled);
  const upcomingBillsInHorizon = activeObligations
    .filter((o) => o.dueDay <= horizon)
    .reduce((sum, o) => sum + o.amount, 0);

  const recommendedBuffer = forecast.recommendedBuffer;

  // Handle adding an obligation
  const handleAddObligation = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = parseFloat(newObligationAmount);
    const day = parseInt(newObligationDay, 10);
    if (!newObligationName.trim() || isNaN(rawAmount) || rawAmount <= 0 || isNaN(day) || day < 1 || day > 31) {
      return;
    }

    // Convert from user display currency to base BDT if needed
    const bdtAmount =
      userCurrency === 'BDT' ? rawAmount : convertAmount(rawAmount, userCurrency, 'BDT');

    const newObligation: RecurringObligation = {
      id: `obl-${Date.now()}`,
      userId: user?.id,
      name: newObligationName.trim(),
      amount: Math.round(bdtAmount),
      dueDay: day,
      recurrenceRule: 'monthly',
      isEnabled: true,
    };

    if (user && onUpdateUser) {
      const updatedUser: UserProfile = {
        ...user,
        recurringObligations: [...recurringObligations, newObligation],
      };
      onUpdateUser(updatedUser);
    }

    setNewObligationName('');
    setNewObligationAmount('');
    setNewObligationDay('1');
    setIsAddObligationOpen(false);
  };

  // Generate dynamic scheduled events list
  const scheduledEvents = (() => {
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
      date: isBangla ? '১ম দিন' : 'Day 1',
      event: isBangla ? 'বর্তমান শুরুর ব্যালেন্স' : 'Starting Account Balance',
      impact: `+${formatMoney(startingBalance)}`,
      type: 'neutral',
      cushion: formatMoney(startingBalance),
    });

    // Obligations due in horizon
    activeObligations
      .filter((o) => o.dueDay <= horizon)
      .sort((a, b) => a.dueDay - b.dueDay)
      .forEach((o) => {
        const pointOnDay = visiblePoints.find((p) => p.day === o.dueDay);
        const cushionVal = pointOnDay ? pointOnDay.projectedBalance : startingBalance;
        events.push({
          day: o.dueDay,
          date: isBangla ? `${o.dueDay} তারিখ` : `Day ${o.dueDay}`,
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
            date: isBangla ? `${dueDay} তারিখ` : `Day ${dueDay}`,
            event: t.description || (isBangla ? 'নিয়মিত আয়' : 'Recurring Income'),
            impact: `+${formatMoney(t.amount)}`,
            type: 'inflow',
            cushion: formatMoney(cushionVal),
          });
        }
      });

    // Horizon End: Safe or close point
    events.push({
      day: horizon,
      date: isBangla ? `${horizon}ম দিন` : `Day ${horizon}`,
      event: isBangla ? 'প্রত্যাশিত সমাপনী ব্যালেন্স' : 'Projected Closing Balance',
      impact: `${projectedEndBalance >= 0 ? '+' : ''}${formatMoney(projectedEndBalance)}`,
      type: projectedEndBalance >= recommendedBuffer ? 'safe' : 'pressure',
      cushion: formatMoney(projectedEndBalance),
    });

    return events.sort((a, b) => a.day - b.day);
  })();

  // Calculate dynamic SVG coordinates from visiblePoints
  const svgCoordinates = (() => {
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
  })();

  const hasPressure = forecast.pressureDays.length > 0;

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Header with Horizon Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
              AI-assisted forecast
            </span>
            <span className="font-label-sm text-label-sm text-outline">
              {isBangla ? 'ঢাকা মেট্রো মডেল • পরিবর্তনশীল অনুমান' : 'Bangladesh Digital Ledger Model • Indicative, not guaranteed'}
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
            {isBangla ? 'ক্যাশ-ফ্লো পূর্বাভাস ও তারল্য বাফার' : 'Cash Flow Forecast & Liquidity Buffer'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-0.5">
            {isBangla
              ? 'আসন্ন নিয়মিত খরচ ও বিলের পূর্বাভাস দেখুন, মাসের শেষভাগের চাপ দূর করুন এবং খরচ কমানোর প্রভাব পরীক্ষা করুন।'
              : 'Understand upcoming obligations, eliminate month-end overdraft stress, and simulate expense cuts.'}
          </p>
        </div>

        {/* Controls: Horizon Tabs & Simulation Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Horizon Selection */}
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
                {days} {isBangla ? 'দিন' : 'Days'}
              </button>
            ))}
          </div>

          {/* Simulate Expense Cut Toggle */}
          <button
            onClick={() => setIsSimulated(!isSimulated)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-title-md text-sm transition-all shadow-sm ${
              isSimulated
                ? 'bg-secondary-container text-on-secondary-container font-bold ring-2 ring-secondary'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-outline-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
            <span>
              {isSimulated
                ? isBangla
                  ? `সিমুলেশন সক্রিয় (+${formatMoney(simulationSaving || 300)}/দিন)`
                  : `Simulation Active (+${formatMoney(simulationSaving || 300)}/day)`
                : isBangla
                ? 'খরচ হ্রাস সিমুলেট করুন'
                : 'Simulate Expense Cut'}
            </span>
          </button>
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
                  {isBangla
                    ? `আসন্ন ক্যাশ-ফ্লো প্রেশার জোন (${forecast.pressureDays.map((d) => `${d} তারিখ`).join(', ')})`
                    : `Upcoming Cash Flow Pressure Zone (Day ${forecast.pressureDays.join(', ')})`}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] font-bold">
                  {isBangla ? 'উচ্চ অগ্রাধিকার' : 'High Focus'}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {isBangla
                  ? `নির্ধারিত দায় ও ব্যয়ের কারণে এ সময় তারল্য হ্রাস পাওয়ার সম্ভাবনা রয়েছে। পূর্বেই বাফার আলাদা রাখুন।`
                  : `Scheduled commitments may reduce your available cash buffer during these days. Reserve liquidity early.`}
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
              ? isBangla
                ? `✓ ${formatMoney(recommendedBuffer)} বাফার সংরক্ষিত`
                : `✓ ${formatMoney(recommendedBuffer)} Buffer Reserved`
              : isBangla
              ? `এখনই ${formatMoney(recommendedBuffer)} বাফার রাখুন`
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
                {isBangla ? 'ক্যাশ-ফ্লো স্থিতিশীল ও নিরাপদ' : 'Cash Flow Stable & Well-Buffered'}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {activeObligations.length === 0
                  ? isBangla
                    ? 'কোনো আসন্ন নির্ধারিত দায় নেই। বাড়িভাড়া বা বিল যোগ করে নির্ভুল পূর্বাভাস পর্যবেক্ষণ করুন।'
                    : 'No upcoming scheduled obligations. Add recurring bills or rent to customize your forecast.'
                  : isBangla
                  ? 'আপনার বর্তমান ব্যালেন্স ও আয়ের ভিত্তিতে কোনো তাৎক্ষণিক ক্যাশ-ফ্লো সংকট নেই।'
                  : 'Projected cash flow remains positive throughout the forecast period.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAddObligationOpen(true)}
            className="px-4 py-2 rounded-xl bg-surface-container-lowest text-on-surface border border-outline-variant/30 hover:bg-surface-container font-title-md text-sm flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">add</span>
            <span>{isBangla ? 'বিল বা নিয়মিত খরচ যোগ করুন' : '+ Add Recurring Bill'}</span>
          </button>
        </div>
      )}

      {/* KPI Forecast Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            {isBangla ? 'শুরুর মোট ব্যালেন্স' : 'Starting Balance'}
          </span>
          <span className="font-headline-lg text-headline-lg text-on-surface font-bold mt-1">
            {formatMoney(startingBalance)}
          </span>
          <span className="text-xs text-on-surface-variant mt-1">
            {user?.linkedAccounts?.length || 0} {isBangla ? 'অ্যাকাউন্ট সংযুক্ত' : 'Linked Accounts'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            {isBangla ? `${horizon} দিন শেষের সম্ভাব্য ব্যালেন্স` : `Projected Day ${horizon} Balance`}
          </span>
          <span className="font-headline-lg text-headline-lg text-secondary font-bold mt-1">
            {formatMoney(projectedEndBalance)}
          </span>
          <span className="text-xs text-secondary font-medium mt-1">
            {isSimulated
              ? isBangla
                ? `সিমুলেশনে +${formatMoney(simulationSaving * horizon)} উদ্বৃত্ত`
                : `Simulated surplus +${formatMoney(simulationSaving * horizon)}`
              : isBangla
              ? 'বাস্তব প্রজেকশন'
              : 'Authentic baseline'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            {isBangla ? 'আসন্ন নির্ধারিত দায় ও বিল' : 'Upcoming Obligations'}
          </span>
          <span className="font-headline-lg text-headline-lg text-error font-bold mt-1">
            {formatMoney(upcomingBillsInHorizon)}
          </span>
          <span className="text-xs text-on-surface-variant mt-1">
            {activeObligations.length > 0
              ? `${activeObligations.length} ${isBangla ? 'টি দায় নির্ধারিত' : 'recurring bills'}`
              : isBangla
              ? 'কোনো নির্ধারিত বিল নেই'
              : 'No upcoming bills set'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-outline uppercase tracking-wider">
            {isBangla ? 'প্রস্তাবিত জরুরি বাফার' : 'Recommended Buffer'}
          </span>
          <span className="font-headline-lg text-headline-lg text-on-surface font-bold mt-1">
            {formatMoney(recommendedBuffer)}
          </span>
          <span className="text-xs text-secondary font-medium mt-1">
            {lockedBuffer
              ? isBangla
                ? 'বাফার সংরক্ষিত'
                : 'Reserved in liquid vault'
              : isBangla
              ? 'তারল্য নিরাপত্তা বাফার'
              : 'Calculated safety margin'}
          </span>
        </div>
      </div>

      {/* Main Forecast Line Chart Canvas Card */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-outline-variant/15 gap-2">
          <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="w-3 h-1 bg-secondary rounded-full"></span>{' '}
              {isBangla ? 'সম্ভাব্য ব্যালেন্সের গতিপথ' : 'Projected Balance Curve'}
            </span>
            <span className="flex items-center gap-1.5 text-outline">
              <span className="w-3 h-1 bg-outline-variant rounded-full"></span>{' '}
              {isBangla
                ? `দৈনিক স্বাভাবিক ব্যয় (~${formatMoney(dailyBurn)}/দিন)`
                : `Daily Burn (~${formatMoney(dailyBurn)}/day)`}
            </span>
            {hasPressure && (
              <span className="flex items-center gap-1.5 text-error">
                <span className="w-2 h-2 rounded-full bg-error"></span>{' '}
                {isBangla ? 'প্রেশার জোন' : 'Pressure Zone'}
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
              stroke={isSimulated ? '#00714d' : '#006c49'}
              strokeWidth="3.5"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Timeline X Markers */}
          <div className="flex justify-between items-center text-outline font-label-sm text-[11px] pt-2 px-1">
            <span>{isBangla ? '১ম দিন (শুরু)' : 'Day 1 (Start)'}</span>
            {horizon >= 14 && (
              <span className="text-on-surface font-semibold">
                {isBangla ? `${Math.round(horizon / 2)}তম দিন (মধ্যবর্তী)` : `Day ${Math.round(horizon / 2)} (Mid-point)`}
              </span>
            )}
            <span>{isBangla ? `${horizon}তম দিন (সমাপ্তি)` : `Day ${horizon} (End)`}</span>
          </div>
        </div>
      </div>

      {/* Explanation of Forecast Assumptions Card */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">info</span>
            <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
              {isBangla ? 'পূর্বাভাস গণনা ও কার্যপদ্ধতি' : 'Forecast Assumptions & Methodology'}
            </h3>
          </div>
          <button
            onClick={() => setIsAddObligationOpen(true)}
            className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>{isBangla ? 'নতুন বিল যোগ করুন' : 'Add Bill / Obligation'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">speed</span>
              {isBangla ? 'দৈনিক খরচের হার' : 'Daily Burn Rate'}
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {dailyBurn > 0
                ? isSimulated
                  ? isBangla
                    ? `সিমুলেশন অনুযায়ী দৈনিক খরচ ${formatMoney(Math.max(0, dailyBurn - simulationSaving))} ধরা হয়েছে (${formatMoney(simulationSaving)}/দিন সাশ্রয় অন্তর্ভুক্ত)।`
                    : `Calibrated at ${formatMoney(Math.max(0, dailyBurn - simulationSaving))}/day with simulated ${formatMoney(simulationSaving)}/day discretionary cap.`
                  : isBangla
                  ? `আপনার লেনদেনের ভিত্তিতে দৈনিক গড় খরচ ${formatMoney(dailyBurn)} ধরা হয়েছে।`
                  : `Calibrated at ${formatMoney(dailyBurn)}/day based on past 30-day non-recurring spending.`
                : isBangla
                ? 'এখনও কোনো ব্যয়ের ইতিহাস নেই। লেনদেন যোগ করলে স্বয়ংক্রিয়ভাবে দৈনিক গড় হিসাব হবে।'
                : 'No expense history recorded. Daily burn rate will calibrate as you log transactions.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-error">event</span>
              {isBangla ? 'নির্ধারিত মাসিক দায়' : 'Scheduled Recurring Obligations'}
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {activeObligations.length > 0
                ? isBangla
                  ? `মোট ${activeObligations.length}টি নিয়মিত দায় (মোট ${formatMoney(upcomingBillsInHorizon)}) নির্ধারিত রয়েছে।`
                  : `Total ${activeObligations.length} obligation(s) totaling ${formatMoney(upcomingBillsInHorizon)} scheduled this month.`
                : isBangla
                ? 'কোনো নিয়মিত বিল বা বাসাভাড়া নির্ধারিত নেই। যুক্ত করতে ওপরের বাটনে ক্লিক করুন।'
                : 'No recurring obligations registered. Add your fixed rent or bills to enable automated detection.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-1">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
              {isBangla ? 'উপলব্ধ তারল্য' : 'Available Liquidity'}
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {startingBalance > 0
                ? isBangla
                  ? `সংযুক্ত অ্যাকাউন্টসমূহ থেকে মোট ${formatMoney(startingBalance)} উপলব্ধ রয়েছে।`
                  : `Starting balance of ${formatMoney(startingBalance)} across your linked accounts.`
                : isBangla
                ? 'বর্তমানে অ্যাকাউন্টে কোনো ব্যালেন্স নেই। ড্যাশবোর্ড থেকে ব্যাংক বা বিকাশ ব্যালেন্স যুক্ত করুন।'
                : 'No liquid balance registered. Update your linked account balances on the Dashboard.'}
            </p>
          </div>
        </div>
      </div>

      {/* Scheduled Inflow/Outflow Timeline Table */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
            {isBangla ? `${horizon}-দিনের প্রধান নগদ প্রবাহ ইভেন্টসমূহ` : `Key Events within ${horizon}-Day Window`}
          </h3>
          <button
            onClick={() => onNavigate('ai-coach')}
            className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
          >
            <span>{isBangla ? 'কোচকে জিজ্ঞাসা করুন' : 'Ask AI Coach Details'}</span>
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

      {/* Modal: Add Recurring Obligation */}
      {isAddObligationOpen && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                {isBangla ? 'নতুন নিয়মিত বিল বা দায় যোগ করুন' : 'Add Recurring Bill / Obligation'}
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
                  {isBangla ? 'বিলের নাম (যেমন: বাসা ভাড়া, ইন্টারনেট)' : 'Obligation Name (e.g. Rent, Internet)'}
                </label>
                <input
                  type="text"
                  required
                  value={newObligationName}
                  onChange={(e) => setNewObligationName(e.target.value)}
                  placeholder="e.g. Apartment Rent"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  {isBangla ? `পরিমাণ (${currConfig.displaySymbol})` : `Amount (${currConfig.displaySymbol})`}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newObligationAmount}
                  onChange={(e) => setNewObligationAmount(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  {isBangla ? 'মাসের কোন তারিখে দেয় (১ - ৩১)' : 'Due Day of Month (1 - 31)'}
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
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddObligationOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-outline hover:text-on-surface"
                >
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-secondary text-on-secondary shadow-sm hover:opacity-95"
                >
                  {isBangla ? 'সংরক্ষণ করুন' : 'Save Obligation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
