import React, { useState, useEffect } from 'react';
import { UserProfile, Transaction, SavingsGoal } from '../types/financial';
import {
  SUPPORTED_CURRENCIES,
  normalizeCurrencyCode,
  formatCurrency,
  convertAmount,
  getCurrencyConfig,
} from '../services/currencyService';
import { WalletsManagementSection } from './WalletsManagementSection';

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
  transactions: _transactions = [],
  goals: _goals = [],
  onUpdateUser,
  onResetData,
  onLogout,
  isBangla,
  onToggleBangla: _onToggleBangla,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileImage, setProfileImage] = useState(user.profileImage || '');
  const [monthlyIncome, setMonthlyIncome] = useState<string>(
    user.monthlyIncome !== undefined && user.monthlyIncome !== null ? user.monthlyIncome.toString() : ''
  );
  const [monthlyIncomeCurrency, setMonthlyIncomeCurrency] = useState<string>(
    normalizeCurrencyCode(user.monthlyIncomeCurrency || user.currency || 'BDT')
  );
  const [monthlyIncomeError, setMonthlyIncomeError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(normalizeCurrencyCode(user.currency));
  const [savedMsg, setSavedMsg] = useState(false);

  // Sync state if user changes externally
  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setProfileImage(user.profileImage || '');
    setMonthlyIncome(
      user.monthlyIncome !== undefined && user.monthlyIncome !== null ? user.monthlyIncome.toString() : ''
    );
    setMonthlyIncomeCurrency(
      normalizeCurrencyCode(user.monthlyIncomeCurrency || user.currency || 'BDT')
    );
    setCurrency(normalizeCurrencyCode(user.currency));
  }, [
    user.id,
    user.name,
    user.email,
    user.profileImage,
    user.monthlyIncome,
    user.monthlyIncomeCurrency,
    user.currency,
  ]);

  // Quick avatar choices
  const sampleAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  ];

  const formatMoney = (amountInBDT: number) => {
    const converted = convertAmount(amountInBDT, 'BDT', currency);
    return formatCurrency(converted, currency);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setMonthlyIncomeError(null);

    let parsedIncome: number | undefined = undefined;
    const trimmedIncome = monthlyIncome.trim();
    if (trimmedIncome !== '') {
      const num = Number(trimmedIncome);
      if (isNaN(num) || !isFinite(num) || num < 0) {
        setMonthlyIncomeError('Please enter a valid, non-negative monetary value.');
        return;
      }
      parsedIncome = Math.round(num * 100) / 100;
    }

    const updated: UserProfile = {
      ...user,
      name: name.trim(),
      email: email.trim(),
      profileImage: profileImage.trim() || undefined,
      monthlyIncome: parsedIncome,
      monthlyIncomeCurrency,
      currency,
    };
    onUpdateUser(updated);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
            Settings & Profile
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage your authenticated account, profile avatar, language, and financial baselines.
          </p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error-container text-on-error-container font-title-md text-sm hover:opacity-90 active:scale-95 transition-all shadow-xs border border-error/20 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out</span>
          </button>
        )}
      </div>

      {savedMsg && (
        <div className="p-3 rounded-xl bg-secondary text-on-secondary text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>
            Profile baselines and preferences updated successfully!
          </span>
        </div>
      )}

      {/* User Information Form */}
      <form
        onSubmit={handleSave}
        className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md"
      >
        <div className="pb-3 border-b border-outline-variant/15">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
            User Profile & Identity
          </h2>
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
              Profile Image URL / Quick Avatar
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
                Quick Select:
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
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              Full Legal Name
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
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm"
            />
          </div>

          {/* Monthly Inflow Baseline */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
                MONTHLY INFLOW BASELINE
              </label>
              <span className="text-[11px] text-outline font-normal">
                (Optional)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Currency Selector */}
              <select
                id="monthlyIncomeCurrency"
                aria-label="Monthly inflow baseline currency"
                value={monthlyIncomeCurrency}
                onChange={(e) => {
                  setMonthlyIncomeCurrency(normalizeCurrencyCode(e.target.value));
                }}
                className="w-44 sm:w-56 p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm cursor-pointer shrink-0 font-medium"
                title="Select baseline currency"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.displaySymbol})
                  </option>
                ))}
              </select>

              {/* Numeric Input */}
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm pointer-events-none select-none">
                  {getCurrencyConfig(monthlyIncomeCurrency).displaySymbol}
                </span>
                <input
                  id="monthlyIncome"
                  aria-label="Monthly inflow baseline amount"
                  type="number"
                  min="0"
                  step="any"
                  value={monthlyIncome}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMonthlyIncome(val);
                    if (monthlyIncomeError) setMonthlyIncomeError(null);
                    if (val.trim() !== '') {
                      const num = Number(val);
                      if (isNaN(num) || !isFinite(num) || num < 0) {
                        setMonthlyIncomeError('Value must be zero or a positive number.');
                      }
                    }
                  }}
                  placeholder="e.g. 35000 (Optional baseline)"
                  className={`w-full pl-8 pr-3 py-3 rounded-xl border bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 font-body-md text-sm transition-all ${
                    monthlyIncomeError
                      ? 'border-error focus:ring-error text-error'
                      : 'border-outline-variant/30 focus:ring-secondary'
                  }`}
                />
              </div>
            </div>
            {monthlyIncomeError ? (
              <span className="text-xs text-error font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {monthlyIncomeError}
              </span>
            ) : (
              <span className="text-[11px] text-outline">
                Used for liquidity buffer and cash flow projections.
              </span>
            )}
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-xs font-semibold text-outline uppercase tracking-wider">
              Display & Base Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-body-md text-sm cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.displaySymbol}) — {c.name} {c.code === 'BDT' ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Save Profile Changes
          </button>
        </div>
      </form>

      {/* Wallets & Banking Accounts */}
      <WalletsManagementSection
        walletAccounts={user.walletAccounts || []}
        onUpdateWalletAccounts={(accounts) => {
          onUpdateUser({
            ...user,
            walletAccounts: accounts,
          });
        }}
        userId={user.id}
        isBangla={isBangla}
        currency={currency}
      />

      {/* Linked Accounts */}
      <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
            Linked Digital Accounts
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
          Account Data Management
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Reset your user-specific transactions, savings goals, and wallet balances to starter defaults.
        </p>
        <button
          type="button"
          onClick={onResetData}
          className="self-start px-space-md py-2 rounded-xl bg-error-container text-on-error-container font-title-md text-sm hover:opacity-90 active:scale-95"
        >
          Reset My Account Data
        </button>
      </div>
    </div>
  );
};
