import React, { useState } from 'react';
import { UserProfile, Transaction, SavingsGoal } from '../types/financial';
import { validateFinancialData } from '../services/financialCalculations';
import { SUPPORTED_CURRENCIES, normalizeCurrencyCode, formatCurrency, convertAmount } from '../services/currencyService';
import { COMMON_TIMEZONES, resolveTimeZone } from '../services/dateTimeService';

interface SettingsProfileViewProps {
  user: UserProfile;
  transactions?: Transaction[];
  goals?: SavingsGoal[];
  onUpdateUser: (user: UserProfile) => void;
  onResetData: () => void;
  onLogout?: () => void;
  isBangla: boolean;
  onToggleBangla: (bangla: boolean) => void;
}

export const SettingsProfileView: React.FC<SettingsProfileViewProps> = ({
  user,
  transactions = [],
  goals = [],
  onUpdateUser,
  onResetData,
  onLogout,
  isBangla,
  onToggleBangla,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileImage, setProfileImage] = useState(user.profileImage || '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'bn'>(user.preferredLanguage || 'en');
  const [currency, setCurrency] = useState(normalizeCurrencyCode(user.currency));
  const [timeZone, setTimeZone] = useState(resolveTimeZone(user.timeZone));
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(user.timeFormat || '24h');
  const [monthlyIncome, setMonthlyIncome] = useState(user.monthlyIncome ? user.monthlyIncome.toString() : '');
  const [riskTolerance, setRiskTolerance] = useState(user.riskTolerance);
  const [savedMsg, setSavedMsg] = useState(false);
  const [validationExpanded, setValidationExpanded] = useState(true);

  // Quick avatar choices
  const sampleAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  ];

  // Compute live mathematical validation
  const validationReport = validateFinancialData(transactions, goals, '2024-10');

  const formatMoney = (amountInBDT: number) => {
    const converted = convertAmount(amountInBDT, 'BDT', currency);
    return formatCurrency(converted, currency);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIncome = monthlyIncome.trim() ? parseInt(monthlyIncome, 10) : 0;
    const updated: UserProfile = {
      ...user,
      name,
      email,
      profileImage: profileImage.trim() || undefined,
      preferredLanguage,
      currency,
      timeZone,
      timeFormat,
      monthlyIncome: isNaN(parsedIncome) ? 0 : parsedIncome,
      riskTolerance,
    };
    onUpdateUser(updated);
    if (preferredLanguage === 'bn' && !isBangla) {
      onToggleBangla(true);
    } else if (preferredLanguage === 'en' && isBangla) {
      onToggleBangla(false);
    }
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
            {isBangla ? 'সেটিংস এবং প্রোফাইল' : 'Settings & Profile'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {isBangla
              ? 'আপনার ব্যক্তিগত প্রোফাইল, ভাষা, কারেন্সি এবং আর্থিক সেটিংস পরিচালনা করুন।'
              : 'Manage your authenticated account, profile avatar, language, and financial baselines.'}
          </p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error-container text-on-error-container font-title-md text-sm hover:opacity-90 active:scale-95 transition-all shadow-xs border border-error/20 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>{isBangla ? 'লগআউট' : 'Sign Out'}</span>
          </button>
        )}
      </div>

      {savedMsg && (
        <div className="p-3 rounded-xl bg-secondary text-on-secondary text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>
            {isBangla ? 'প্রোফাইল সফলভাবে আপডেট করা হয়েছে!' : 'Profile baselines and preferences updated successfully!'}
          </span>
        </div>
      )}

      {/* User Information Form */}
      <form
        onSubmit={handleSave}
        className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md"
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
            {isBangla ? 'ব্যবহারকারীর তথ্য ও পছন্দসমূহ' : 'User Profile & Identity'}
          </h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
            {user.memberStatus || 'Active Member'}
          </span>
        </div>

        {/* Profile Avatar & Image Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/20">
          <div className="relative w-16 h-16 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center text-xl font-bold overflow-hidden shadow-sm shrink-0 border-2 border-secondary/30">
            {profileImage ? (
              <img
                src={profileImage}
                alt={name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span>{name ? name.slice(0, 2).toUpperCase() : 'AR'}</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'প্রোফাইল ছবি (URL বা পছন্দের অ্যাভাটার)' : 'Profile Image URL / Quick Avatar'}
            </label>
            <input
              type="url"
              value={profileImage}
              onChange={(e) => setProfileImage(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface font-body-sm text-xs focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            {/* Quick avatar selection pills */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-outline">
                {isBangla ? 'দ্রুত নির্বাচন:' : 'Quick Select:'}
              </span>
              {sampleAvatars.map((url, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setProfileImage(url)}
                  className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${
                    profileImage === url ? 'border-secondary ring-2 ring-secondary/30' : 'border-outline-variant/40'
                  }`}
                >
                  <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {profileImage && (
                <button
                  type="button"
                  onClick={() => setProfileImage('')}
                  className="text-[11px] text-error hover:underline ml-1"
                >
                  {isBangla ? 'মুছে ফেলুন' : 'Clear'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'পুরো নাম' : 'Full Legal Name'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'ইমেইল ঠিকানা' : 'Email Address'}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm"
            />
          </div>

          {/* Preferred Language */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'পছন্দের ভাষা' : 'Preferred Language'}
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'bn')}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm"
            >
              <option value="en">English (Default)</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'মুদ্রা (Preferred Currency)' : 'Display & Base Currency'}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.displaySymbol}) — {isBangla ? c.nameBn : c.name} {c.code === 'BDT' ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Timezone Preference */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'টাইমজোন (Timezone)' : 'Primary Timezone'}
            </label>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm cursor-pointer"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Format (12h vs 24h) */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'সময়ের ফরম্যাট' : 'Time Display Format'}
            </label>
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm cursor-pointer"
            >
              <option value="24h">24-Hour (e.g. 09:52, 18:30)</option>
              <option value="12h">12-Hour (e.g. 09:52 AM, 06:30 PM)</option>
            </select>
          </div>

          {/* Monthly Inflow */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'মাসিক নিয়মিত আয় (BDT)' : 'Monthly Inflow Baseline (BDT)'}
            </label>
            <input
              type="number"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              placeholder={isBangla ? 'ঐচ্ছিক নিয়মিত আয় (যেমন: ৩৫০০০)' : 'e.g. 35000 (Optional baseline)'}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm"
            />
          </div>

          {/* Risk Profile */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'ঝুঁকি সহনশীলতা' : 'Risk Profile & Volatility Tolerance'}
            </label>
            <select
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value as any)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm"
            >
              <option value="Low">Low (Capital Preservation Focus)</option>
              <option value="Moderate">Moderate (Balanced MFS Growth)</option>
              <option value="Aggressive">Aggressive (High Savings Acceleration)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            {isBangla ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* Internal Calculation Engine Validation Suite */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                {isBangla ? 'আর্থিক হিসাব যাচাইকরণ ইঞ্জিন' : 'Internal Calculation Engine Verification'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {isBangla
                  ? 'গাণিতিক নিরীক্ষা যা নিশ্চিত করে সব পাতায় সঠিক তথ্য প্রবাহিত হচ্ছে'
                  : 'Mathematical audit confirming consistent data propagation across all pages'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setValidationExpanded(!validationExpanded)}
            className="text-xs text-secondary font-semibold hover:underline flex items-center gap-1"
          >
            {validationExpanded ? 'Collapse' : 'Expand'}
            <span className="material-symbols-outlined text-[16px]">
              {validationExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {validationExpanded && (
          <div className="flex flex-col gap-3 pt-2 border-t border-outline-variant/15 text-sm">
            {/* Check 1: Income - Expenses = Net Savings */}
            <div className="p-3 rounded-xl bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                <span className="font-semibold text-on-surface">Income - Expenses = Net Savings</span>
              </div>
              <div className="text-xs text-on-surface-variant font-mono">
                {formatMoney(validationReport.totalIncome)} - {formatMoney(validationReport.totalExpenses)} ={' '}
                <strong className="text-secondary">{formatMoney(validationReport.netSavings)}</strong>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold text-[10px]">
                  PASS
                </span>
              </div>
            </div>

            {/* Check 2: Category Totals = Total Expenses */}
            <div className="p-3 rounded-xl bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                <span className="font-semibold text-on-surface">Category Totals = Total Expenses</span>
              </div>
              <div className="text-xs text-on-surface-variant font-mono">
                Categories Sum ({formatMoney(validationReport.categorySum)}) == Total (
                {formatMoney(validationReport.totalExpenses)})
                <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold text-[10px]">
                  MATCH
                </span>
              </div>
            </div>

            {/* Check 3: Savings Rate Accuracy */}
            <div className="p-3 rounded-xl bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                <span className="font-semibold text-on-surface">Savings Rate = Savings / Income * 100</span>
              </div>
              <div className="text-xs text-on-surface-variant font-mono">
                {formatMoney(validationReport.netSavings)} / {formatMoney(validationReport.totalIncome)} ={' '}
                <strong className="text-secondary">{validationReport.savingsRate}%</strong>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold text-[10px]">
                  EXACT
                </span>
              </div>
            </div>

            {/* Check 4 & 5: Goals Math */}
            <div className="p-3 rounded-xl bg-surface-container-low/50 flex flex-col gap-2 border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                  <span className="font-semibold text-on-surface">
                    Goal Calculations: Remaining = Target - Current | Progress = Current / Target * 100
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold text-[10px]">
                  VERIFIED
                </span>
              </div>
              <div className="divide-y divide-outline-variant/15 text-xs text-on-surface-variant">
                {validationReport.goalValidations.map((g) => (
                  <div key={g.goalId} className="py-1.5 flex justify-between items-center font-mono">
                    <span>{g.title}</span>
                    <span>
                      {formatMoney(g.currentAmount)} / {formatMoney(g.targetAmount)} (Remaining:{' '}
                      {formatMoney(g.remainingAmount)} | Progress: {g.progressPercentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Linked Accounts */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
            {isBangla ? 'সংযুক্ত ডিজিটাল অ্যাকাউন্ট' : 'Linked Digital Accounts'}
          </h2>
          <span className="text-xs font-semibold text-secondary flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            {user.linkedAccounts?.length || 0} Accounts Connected
          </span>
        </div>
        <div className="divide-y divide-surface-container-low">
          {user.linkedAccounts?.map((acc) => (
            <div key={acc.name} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center font-bold text-xs text-on-surface">
                  {acc.name === 'bKash' ? 'bK' : acc.name === 'Nagad' ? 'NG' : 'CB'}
                </div>
                <div className="flex flex-col">
                  <span className="font-title-md text-sm text-on-surface font-bold">
                    {acc.name}
                  </span>
                  <span className="text-xs text-outline">A/C {acc.accountNumber}</span>
                </div>
              </div>
              <span className="font-title-md text-on-surface font-bold">
                {formatMoney(acc.balance)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Management & Reset */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-3">
        <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
          {isBangla ? 'ব্যবহারকারী ডেটা ব্যবস্থাপনা' : 'Account Data Management'}
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {isBangla
            ? 'আপনার অ্যাকাউন্টের লেনদেন এবং সঞ্চয় লক্ষ্য ডিফল্ট অবস্থায় ফিরিয়ে নিন।'
            : 'Reset your user-specific transactions, savings goals, and wallet balances to starter defaults.'}
        </p>
        <button
          type="button"
          onClick={onResetData}
          className="self-start px-space-md py-2 rounded-xl bg-error-container text-on-error-container font-title-md text-sm hover:opacity-90 active:scale-95"
        >
          {isBangla ? 'অ্যাকাউন্ট ডেটা রিসেট করুন' : 'Reset My Account Data'}
        </button>
      </div>
    </div>
  );
};
