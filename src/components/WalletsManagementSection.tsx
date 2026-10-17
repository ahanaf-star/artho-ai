import React, { useState } from 'react';
import { WalletAccount } from '../types/financial';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
} from '../services/currencyService';
import { apiService } from '../services/apiService';

export const COMMON_PROVIDERS = [
  'bKash',
  'Nagad',
  'Rocket',
  'Upay',
  'City Bank',
  'BRAC Bank',
  'Dutch-Bangla Bank',
  'Islami Bank Bangladesh',
  'Other',
] as const;

export const ACCOUNT_TYPES = [
  'Mobile Financial Service (MFS)',
  'Bank Account',
  'Other Financial Account',
] as const;

/**
 * Mask account identifiers in the UI so full numbers are never exposed.
 * e.g., '01712345678' -> '****5678', '1234' -> '****1234'
 */
export function maskAccountIdentifier(raw?: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (trimmed.length <= 4) {
    return `****${trimmed}`;
  }
  return `****${trimmed.slice(-4)}`;
}

interface WalletsManagementSectionProps {
  walletAccounts: WalletAccount[];
  onUpdateWalletAccounts: (accounts: WalletAccount[]) => void;
  userId?: string;
  isBangla: boolean;
  currency: string;
}

export const WalletsManagementSection: React.FC<WalletsManagementSectionProps> = ({
  walletAccounts = [],
  onUpdateWalletAccounts,
  userId,
  isBangla,
  currency,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WalletAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<WalletAccount | null>(null);

  const displayCurrency = normalizeCurrencyCode(currency);

  // Form State
  const [accountType, setAccountType] = useState<string>('Mobile Financial Service (MFS)');
  const [providerSelect, setProviderSelect] = useState<string>('bKash');
  const [customProvider, setCustomProvider] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountCurrency, setAccountCurrency] = useState<string>(displayCurrency);
  const [balance, setBalance] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Compute total of accounts converted to active display currency
  const accountsWithBalance = walletAccounts.filter(
    (a) => a.balance !== undefined && a.balance !== null && !isNaN(a.balance)
  );
  const totalManualBalance = accountsWithBalance.reduce((sum, a) => {
    const accCurr = normalizeCurrencyCode(a.currency || 'BDT');
    return sum + convertAmount(a.balance || 0, accCurr, displayCurrency);
  }, 0);

  const openAddModal = () => {
    setEditingAccount(null);
    setAccountType('Mobile Financial Service (MFS)');
    setProviderSelect('bKash');
    setCustomProvider('');
    setDisplayName('');
    setAccountNumber('');
    setAccountCurrency(displayCurrency);
    setBalance('');
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (account: WalletAccount) => {
    setEditingAccount(account);
    setAccountType(account.accountType || 'Mobile Financial Service (MFS)');

    const isKnownProvider = COMMON_PROVIDERS.includes(account.provider as any);
    if (isKnownProvider) {
      setProviderSelect(account.provider);
      setCustomProvider('');
    } else {
      setProviderSelect('Other');
      setCustomProvider(account.provider || '');
    }

    setDisplayName(account.displayName || '');
    setAccountNumber(account.accountNumber || '');
    setAccountCurrency(normalizeCurrencyCode(account.currency || displayCurrency));
    setBalance(account.balance !== undefined && account.balance !== null ? account.balance.toString() : '');
    setNotes(account.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate provider
    const effectiveProvider =
      providerSelect === 'Other' ? customProvider.trim() : providerSelect.trim();
    if (!effectiveProvider) {
      setFormError(
        isBangla
          ? 'অনুগ্রহ করে প্রোভাইডার বা প্রতিষ্ঠানের নাম লিখুন।'
          : 'Please enter a provider or institution name.'
      );
      return;
    }

    // Validate balance if entered
    let parsedBalance: number | undefined = undefined;
    if (balance.trim() !== '') {
      const num = Number(balance.trim());
      if (isNaN(num) || !isFinite(num) || num < 0) {
        setFormError(
          isBangla
            ? 'ব্যালেন্স একটি বৈধ অ-ঋণাত্মক সংখ্যা হতে হবে।'
            : 'Current balance must be a valid non-negative number.'
        );
        return;
      }
      parsedBalance = num;
    }

    if (editingAccount) {
      // Edit existing account
      const updatedAccount: WalletAccount = {
        ...editingAccount,
        accountType,
        provider: effectiveProvider,
        displayName: displayName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        currency: accountCurrency,
        balance: parsedBalance,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      const updatedList = walletAccounts.map((a) =>
        a.id === editingAccount.id ? updatedAccount : a
      );
      onUpdateWalletAccounts(updatedList);

      if (userId) {
        apiService.updateWalletAccount(userId, editingAccount.id, updatedAccount).catch((err) => {
          console.warn('[WalletsManagement] Backend sync update failed:', err);
        });
      }
    } else {
      // Add new account
      const newAccount: WalletAccount = {
        id: `wlt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: userId,
        accountType,
        provider: effectiveProvider,
        displayName: displayName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        currency: accountCurrency,
        balance: parsedBalance,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedList = [...walletAccounts, newAccount];
      onUpdateWalletAccounts(updatedList);

      if (userId) {
        apiService.addWalletAccount(userId, newAccount).catch((err) => {
          console.warn('[WalletsManagement] Backend sync add failed:', err);
        });
      }
    }

    setIsModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!deletingAccount) return;
    const targetId = deletingAccount.id;
    const updatedList = walletAccounts.filter((a) => a.id !== targetId);
    onUpdateWalletAccounts(updatedList);

    if (userId) {
      apiService.deleteWalletAccount(userId, targetId).catch((err) => {
        console.warn('[WalletsManagement] Backend sync delete failed:', err);
      });
    }

    setDeletingAccount(null);
  };

  // Helper for provider icon/badge
  const getProviderBadge = (provider: string, type: string) => {
    const p = provider.toLowerCase();
    if (p.includes('bkash')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold text-xs flex items-center justify-center shrink-0 border border-pink-500/20">
          bK
        </div>
      );
    }
    if (p.includes('nagad')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs flex items-center justify-center shrink-0 border border-orange-500/20">
          NG
        </div>
      );
    }
    if (p.includes('rocket')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/20">
          RK
        </div>
      );
    }
    if (p.includes('upay')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/20">
          UP
        </div>
      );
    }
    if (type.includes('Bank')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">account_balance</span>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
      </div>
    );
  };

  return (
    <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/15">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">account_balance_wallet</span>
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
              {isBangla ? 'ওয়ালেট ও ব্যাংক অ্যাকাউন্ট' : 'Wallets & Banking Accounts'}
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
              {walletAccounts.length} {isBangla ? 'অ্যাকাউন্ট' : 'Accounts'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {isBangla
              ? 'আপনার ব্যক্তিগত ওয়ালেট ও ব্যাংক অ্যাকাউন্টসমূহ ম্যানুয়ালি পরিচালনা করুন।'
              : 'Manually managed wallets, bank accounts, and mobile financial services.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {accountsWithBalance.length > 0 && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs"
              title="Combined balance of all manually entered accounts (indicative, user-provided)"
            >
              <span className="text-outline text-[11px] uppercase tracking-wider font-semibold">
                {isBangla ? 'ম্যানুয়াল মোট:' : 'Manual Total:'}
              </span>
              <span className="font-bold text-secondary font-mono">
                {formatCurrency(totalManualBalance, displayCurrency)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>{isBangla ? 'অ্যাকাউন্ট যোগ করুন' : 'Add Account'}</span>
          </button>
        </div>
      </div>

      {/* Account List / Empty State */}
      {walletAccounts.length === 0 ? (
        <div className="py-8 px-4 rounded-xl bg-surface-container-low/40 border border-dashed border-outline-variant/30 flex flex-col items-center text-center gap-2.5">
          <div className="w-12 h-12 rounded-2xl bg-secondary-container/30 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">wallet</span>
          </div>
          <div>
            <h3 className="font-title-md text-sm font-bold text-on-surface">
              {isBangla ? 'এখনও কোনো অ্যাকাউন্ট যোগ করা হয়নি' : 'No Wallets or Bank Accounts Added Yet'}
            </h3>
            <p className="text-xs text-on-surface-variant max-w-md mt-1 leading-relaxed">
              {isBangla
                ? 'আপনার ব্যক্তিগত বিকাশ, নগদ, রকেট বা ব্যাংক অ্যাকাউন্ট এখানে যুক্ত করে ব্যালেন্স পর্যবেক্ষণ করুন।'
                : 'Track your personal bKash, Nagad, Rocket, or bank accounts here to manage your finances in one place.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isBangla ? 'প্রথম অ্যাকাউন্ট যোগ করুন' : 'Add Your First Account'}</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant/15">
          {walletAccounts.map((acc) => {
            const maskedId = maskAccountIdentifier(acc.accountNumber);
            const accCurrency = normalizeCurrencyCode(acc.currency || 'BDT');
            const isDifferentFromDisplay = accCurrency !== displayCurrency;
            const convertedToDisplay =
              acc.balance !== undefined && acc.balance !== null
                ? convertAmount(acc.balance, accCurrency, displayCurrency)
                : null;
            const currConfig = getCurrencyConfig(accCurrency);

            return (
              <div
                key={acc.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors hover:bg-surface-container-low/30 rounded-xl px-2"
              >
                {/* Account info */}
                <div className="flex items-center gap-3 min-w-0">
                  {getProviderBadge(acc.provider, acc.accountType)}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-title-md text-sm text-on-surface font-bold truncate">
                        {acc.provider}
                      </span>
                      {acc.displayName && (
                        <span className="text-xs text-on-surface-variant font-medium truncate">
                          ({acc.displayName})
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                        {acc.accountType}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container border border-secondary/20 font-mono">
                        {currConfig.flag} {accCurrency}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-outline flex-wrap font-mono">
                      {maskedId && <span>A/C {maskedId}</span>}
                      {maskedId && acc.notes && <span>•</span>}
                      {acc.notes && (
                        <span className="text-on-surface-variant/80 font-sans italic truncate max-w-xs">
                          {acc.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Balance & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-12 sm:pl-0">
                  <div className="flex flex-col items-start sm:items-end">
                    {acc.balance !== undefined && acc.balance !== null ? (
                      <>
                        <span className="font-title-md text-sm text-on-surface font-bold font-mono">
                          {formatCurrency(acc.balance, accCurrency)}
                        </span>
                        {isDifferentFromDisplay && convertedToDisplay !== null && (
                          <span
                            className="text-[11px] text-secondary font-medium font-mono"
                            title={`${accCurrency} converted to ${displayCurrency}`}
                          >
                            ≈ {formatCurrency(convertedToDisplay, displayCurrency)}
                          </span>
                        )}
                        <span className="text-[10px] text-outline">
                          {isBangla ? 'ম্যানুয়াল ব্যালেন্স' : 'Manual Balance'}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-outline italic">
                        {isBangla ? 'ব্যালেন্স নির্ধারিত নেই' : 'No balance set'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(acc)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                      title={isBangla ? 'সম্পাদনা করুন' : 'Edit Account'}
                      aria-label="Edit account"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingAccount(acc)}
                      className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                      title={isBangla ? 'মুছে ফেলুন' : 'Remove Account'}
                      aria-label="Remove account"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">
                  {editingAccount ? 'edit' : 'add_card'}
                </span>
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  {editingAccount
                    ? isBangla
                      ? 'অ্যাকাউন্ট সম্পাদনা'
                      : 'Edit Account'
                    : isBangla
                    ? 'নতুন অ্যাকাউন্ট যোগ করুন'
                    : 'Add Wallet or Bank Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
                aria-label="Close dialog"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="flex flex-col gap-3.5">
              {formError && (
                <div className="p-2.5 rounded-xl bg-error-container/25 border border-error/30 text-error text-xs flex items-center gap-2 animate-in fade-in duration-150">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Account Type */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'অ্যাকাউন্টের ধরন' : 'Account Type'} *
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider / Institution */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'প্রোভাইডার / প্রতিষ্ঠান' : 'Provider / Institution'} *
                </label>
                <select
                  value={providerSelect}
                  onChange={(e) => setProviderSelect(e.target.value)}
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                >
                  {COMMON_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {providerSelect === 'Other' && (
                  <input
                    type="text"
                    required
                    value={customProvider}
                    onChange={(e) => setCustomProvider(e.target.value)}
                    placeholder={
                      isBangla ? 'প্রতিষ্ঠানের নাম লিখুন (যেমন: Standard Chartered)' : 'Enter custom provider / bank name'
                    }
                    className="mt-1 p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                )}
              </div>

              {/* Display Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'অ্যাকাউন্ট ডিসপ্লে নাম (ঐচ্ছিক)' : 'Account Display Name (Optional)'}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={isBangla ? 'যেমন: বেতন অ্যাকাউন্ট, প্রাইমারি বিকাশ' : 'e.g. Salary Account, Primary Wallet'}
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              {/* Account Number / Identifier */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'অ্যাকাউন্ট নম্বর / আইডি (ঐচ্ছিক)' : 'Account Number / Identifier (Optional)'}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={isBangla ? 'যেমন: 01712345678 বা 2104092' : 'e.g. 01712345678 or AC-98765432'}
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                />
                <p className="text-[11px] text-outline italic">
                  {isBangla
                    ? '* গোপনীয়তার জন্য তালিকায় এটি শুধুমাত্র ****১২৩৪ হিসেবে প্রদর্শিত হবে।'
                    : '* Stored for your reference; will be masked as ****1234 in the interface.'}
                </p>
              </div>

              {/* Account Currency & Current Balance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Account Currency */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    {isBangla ? 'অ্যাকাউন্টের মুদ্রা' : 'Account Currency'} *
                  </label>
                  <select
                    value={accountCurrency}
                    onChange={(e) => setAccountCurrency(normalizeCurrencyCode(e.target.value))}
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.displaySymbol}) — {isBangla ? c.nameBn : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Balance */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    {isBangla
                      ? `বর্তমান ব্যালেন্স (${accountCurrency}, ঐচ্ছিক)`
                      : `Current Balance (${accountCurrency}, Optional)`}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-secondary pointer-events-none select-none">
                      {getCurrencyConfig(accountCurrency).displaySymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      placeholder={
                        accountCurrency === 'JPY'
                          ? '50000'
                          : accountCurrency === 'USD' || accountCurrency === 'EUR' || accountCurrency === 'GBP' || accountCurrency === 'CAD' || accountCurrency === 'AUD'
                          ? '1500'
                          : '15000'
                      }
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-outline">
                {isBangla
                  ? 'ব্যালেন্স নির্বাচিত মুদ্রায় সংরক্ষিত হবে এবং অ্যাপের মূল মুদ্রায় স্বয়ংক্রিয়ভাবে রূপান্তরিত হবে।'
                  : 'Balances in foreign currencies are automatically converted using live exchange rates in summaries.'}
              </p>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'নোট (ঐচ্ছিক)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isBangla ? 'যেমন: জরুরি ফান্ড, দৈনিক খরচ' : 'e.g. Emergency reserve, daily utility wallet'}
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-outline-variant/15 mt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant/30 text-on-surface text-sm font-medium hover:bg-surface-container-low transition-colors"
                >
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  {editingAccount
                    ? isBangla
                      ? 'আপডেট করুন'
                      : 'Update Account'
                    : isBangla
                    ? 'সংরক্ষণ করুন'
                    : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAccount && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-2xl bg-error-container/40 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </div>
            <div>
              <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                {isBangla ? 'অ্যাকাউন্ট মুছে ফেলতে চান?' : 'Remove Account?'}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                {isBangla ? (
                  <>
                    আপনি কি নিশ্চিত যে <strong>"{deletingAccount.displayName || deletingAccount.provider}"</strong>{' '}
                    অ্যাকাউন্টটি মুছে ফেলতে চান?
                  </>
                ) : (
                  <>
                    Are you sure you want to remove{' '}
                    <strong>"{deletingAccount.displayName || deletingAccount.provider}"</strong> from your manually
                    managed accounts?
                  </>
                )}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/15 mt-1">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="px-3.5 py-1.5 rounded-xl border border-outline-variant/30 text-on-surface text-sm font-medium hover:bg-surface-container-low"
              >
                {isBangla ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-error text-on-error font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
              >
                {isBangla ? 'মুছে ফেলুন' : 'Remove Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

