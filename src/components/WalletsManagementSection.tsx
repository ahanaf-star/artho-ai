import React, { useState, useEffect, useRef } from 'react';
import { WalletAccount } from '../types/financial';
import {
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
  canConvertCurrency,
} from '../services/currencyService';
import { apiService } from '../services/apiService';
import {
  COUNTRIES,
  CountryInfo,
  getCountryByCode,
  getProvidersForCountryAndType,
  INTERNATIONAL_ACCOUNT_TYPES,
  AccountTypeName,
} from '../data/internationalProviders';

// Retain legacy export for backward-compatibility with existing tests and imports
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
  'Bank Account',
  'Mobile Money / Digital Wallet',
  'Cash',
  'Other Financial Account',
  'Mobile Financial Service (MFS)',
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
  isBangla: _isBangla,
  currency,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WalletAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<WalletAccount | null>(null);

  const displayCurrency = normalizeCurrencyCode(currency);

  // Form State
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('BD');
  const [accountType, setAccountType] = useState<AccountTypeName>('Bank Account');
  const [providerSelect, setProviderSelect] = useState<string>('City Bank');
  const [customProvider, setCustomProvider] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountCurrency, setAccountCurrency] = useState<string>(displayCurrency);
  const [balance, setBalance] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Dropdown UI states
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  const countryRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setIsCountryOpen(false);
      }
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setIsProviderOpen(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setIsCurrencyOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCountryInfo = getCountryByCode(selectedCountryCode);

  // Dynamic providers for currently selected country and account type
  const availableProviders = getProvidersForCountryAndType(selectedCountryCode, accountType);

  // Compute total of accounts converted to active display currency
  const accountsWithBalance = walletAccounts.filter(
    (a) => a.balance !== undefined && a.balance !== null && !isNaN(a.balance)
  );

  const convertibleAccounts = accountsWithBalance.filter((a) => {
    const accCurr = normalizeCurrencyCode(a.currency || 'BDT');
    return canConvertCurrency(accCurr, displayCurrency);
  });

  const unconvertibleCount = accountsWithBalance.length - convertibleAccounts.length;

  const totalManualBalance = convertibleAccounts.reduce((sum, a) => {
    const accCurr = normalizeCurrencyCode(a.currency || 'BDT');
    return sum + convertAmount(a.balance || 0, accCurr, displayCurrency);
  }, 0);

  // Infer sensible initial country based on reporting currency
  const getContextualDefaultCountry = (): string => {
    if (displayCurrency === 'USD') return 'US';
    if (displayCurrency === 'GBP') return 'GB';
    if (displayCurrency === 'EUR') return 'DE';
    if (displayCurrency === 'INR') return 'IN';
    if (displayCurrency === 'CAD') return 'CA';
    if (displayCurrency === 'AUD') return 'AU';
    if (displayCurrency === 'SAR') return 'SA';
    if (displayCurrency === 'JPY') return 'JP';
    if (displayCurrency === 'CNY') return 'CN';
    if (displayCurrency === 'CHF') return 'CH';
    return 'BD';
  };

  const openAddModal = () => {
    const initialCountry = getContextualDefaultCountry();
    const countryInfo = getCountryByCode(initialCountry);

    setEditingAccount(null);
    setSelectedCountryCode(initialCountry);
    setCountrySearch('');

    const initialType: AccountTypeName = initialCountry === 'BD' ? 'Mobile Money / Digital Wallet' : 'Bank Account';
    setAccountType(initialType);

    const providers = getProvidersForCountryAndType(initialCountry, initialType);
    const initialProvider = providers[0] || '__custom__';
    setProviderSelect(initialProvider);
    setCustomProvider('');
    setProviderSearch('');

    setDisplayName('');
    setAccountNumber('');
    setAccountCurrency(countryInfo.defaultCurrency || displayCurrency);
    setCurrencySearch('');
    setBalance('');
    setNotes('');
    setFormError(null);

    setIsCountryOpen(false);
    setIsProviderOpen(false);
    setIsCurrencyOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (account: WalletAccount) => {
    setEditingAccount(account);

    // Identify country
    let targetCountryCode = account.countryCode?.toUpperCase();
    if (!targetCountryCode) {
      // Infer based on provider or currency
      const normCurr = normalizeCurrencyCode(account.currency);
      if (normCurr === 'USD') targetCountryCode = 'US';
      else if (normCurr === 'GBP') targetCountryCode = 'GB';
      else if (normCurr === 'EUR') targetCountryCode = 'DE';
      else if (normCurr === 'INR') targetCountryCode = 'IN';
      else if (normCurr === 'CAD') targetCountryCode = 'CA';
      else if (normCurr === 'AUD') targetCountryCode = 'AU';
      else if (normCurr === 'SAR') targetCountryCode = 'SA';
      else if (normCurr === 'JPY') targetCountryCode = 'JP';
      else if (normCurr === 'CNY') targetCountryCode = 'CN';
      else if (normCurr === 'CHF') targetCountryCode = 'CH';
      else targetCountryCode = 'BD';
    }
    setSelectedCountryCode(targetCountryCode);
    setCountrySearch('');

    // Normalize account type
    let normalizedType: AccountTypeName = 'Bank Account';
    if (
      account.accountType === 'Mobile Financial Service (MFS)' ||
      account.accountType === 'Mobile Money / Digital Wallet'
    ) {
      normalizedType = 'Mobile Money / Digital Wallet';
    } else if (account.accountType === 'Cash') {
      normalizedType = 'Cash';
    } else if (account.accountType === 'Other Financial Account') {
      normalizedType = 'Other Financial Account';
    }
    setAccountType(normalizedType);

    // Match provider
    const providers = getProvidersForCountryAndType(targetCountryCode, normalizedType);
    const match = providers.find((p) => p.toLowerCase() === (account.provider || '').toLowerCase());
    if (match) {
      setProviderSelect(match);
      setCustomProvider('');
    } else {
      setProviderSelect('__custom__');
      setCustomProvider(account.provider || '');
    }
    setProviderSearch('');

    setDisplayName(account.displayName || '');
    setAccountNumber(account.accountNumber || '');

    // Strictly preserve stored currency when editing - do NOT overwrite!
    setAccountCurrency(account.currency ? normalizeCurrencyCode(account.currency) : 'BDT');
    setCurrencySearch('');

    setBalance(account.balance !== undefined && account.balance !== null ? account.balance.toString() : '');
    setNotes(account.notes || '');
    setFormError(null);

    setIsCountryOpen(false);
    setIsProviderOpen(false);
    setIsCurrencyOpen(false);
    setIsModalOpen(true);
  };

  // Handle Country Selection
  const handleSelectCountry = (country: CountryInfo) => {
    setSelectedCountryCode(country.code);
    setIsCountryOpen(false);
    setCountrySearch('');

    // In Add mode: update default currency based on selected country
    if (!editingAccount) {
      setAccountCurrency(country.defaultCurrency);
    }

    // Update provider suggestions
    const newProviders = getProvidersForCountryAndType(country.code, accountType);
    if (newProviders.length > 0) {
      setProviderSelect(newProviders[0]);
      setCustomProvider('');
    } else {
      setProviderSelect('__custom__');
    }
  };

  // Handle Account Type Selection
  const handleSelectAccountType = (newType: AccountTypeName) => {
    setAccountType(newType);
    const newProviders = getProvidersForCountryAndType(selectedCountryCode, newType);
    if (newProviders.length > 0) {
      setProviderSelect(newProviders[0]);
      setCustomProvider('');
    } else {
      setProviderSelect('__custom__');
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Resolve provider name
    const effectiveProvider =
      providerSelect === '__custom__' || providerSelect === 'Other'
        ? customProvider.trim()
        : providerSelect.trim();

    if (!effectiveProvider) {
      setFormError('Please enter or select a provider or institution name.');
      return;
    }

    // Validate balance if entered
    let parsedBalance: number | undefined = undefined;
    if (balance.trim() !== '') {
      const num = Number(balance.trim());
      if (isNaN(num) || !isFinite(num) || num < 0) {
        setFormError('Current balance must be a valid non-negative number.');
        return;
      }
      parsedBalance = num;
    }

    const countryObj = getCountryByCode(selectedCountryCode);

    if (editingAccount) {
      // Edit existing account
      const updatedAccount: WalletAccount = {
        ...editingAccount,
        countryCode: countryObj.code,
        country: countryObj.name,
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
        countryCode: countryObj.code,
        country: countryObj.name,
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

  // Helper for provider badge
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
    if (p.includes('paypal')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-600/20">
          PP
        </div>
      );
    }
    if (p.includes('venmo')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-500/20">
          V
        </div>
      );
    }
    if (p.includes('cash app')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/20">
          $
        </div>
      );
    }
    if (p.includes('revolut')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-500/20">
          R
        </div>
      );
    }
    if (p.includes('wise')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-lime-500/10 text-lime-600 dark:text-lime-400 font-bold text-xs flex items-center justify-center shrink-0 border border-lime-500/20">
          W
        </div>
      );
    }
    if (p.includes('m-pesa')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-xs flex items-center justify-center shrink-0 border border-green-500/20">
          MP
        </div>
      );
    }
    if (type.includes('Cash')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/20">
          <span className="material-symbols-outlined text-[20px]">payments</span>
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
    if (type.includes('Mobile') || type.includes('MFS')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">smartphone</span>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
      </div>
    );
  };

  // Filtered lists for dropdown search
  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.defaultCurrency.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredProviders = availableProviders.filter((p) =>
    p.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const filteredCurrencies = SUPPORTED_CURRENCIES.filter(
    (c) =>
      c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.symbol.toLowerCase().includes(currencySearch.toLowerCase())
  );

  return (
    <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-space-md">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/15">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">account_balance_wallet</span>
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
              Wallets & Banking Accounts
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
              {walletAccounts.length} Accounts
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Country-independent tracking for global banks, mobile wallets, cash, and financial accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {accountsWithBalance.length > 0 && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs"
              title={
                unconvertibleCount > 0
                  ? `Combined balance of convertible accounts. (${unconvertibleCount} account(s) have unconvertible rates)`
                  : 'Combined balance of all manually entered accounts in active display currency'
              }
            >
              <span className="text-outline text-[11px] uppercase tracking-wider font-semibold">
                Manual Total:
              </span>
              <span className="font-bold text-secondary font-mono">
                {formatCurrency(totalManualBalance, displayCurrency)}
              </span>
              {unconvertibleCount > 0 && (
                <span className="text-[10px] text-outline italic">
                  ({unconvertibleCount} excluded)
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Account</span>
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
              No Wallets or Bank Accounts Added Yet
            </h3>
            <p className="text-xs text-on-surface-variant max-w-md mt-1 leading-relaxed">
              Track accounts from Bangladesh (bKash, Nagad, City Bank) or any country worldwide (Chase, Barclays, PayPal, Cash) with multi-currency support.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Your First Account</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant/15">
          {walletAccounts.map((acc) => {
            const maskedId = maskAccountIdentifier(acc.accountNumber);
            const accCurrency = normalizeCurrencyCode(acc.currency || 'BDT');
            const isDifferentFromDisplay = accCurrency !== displayCurrency;
            const canConvert = canConvertCurrency(accCurrency, displayCurrency);
            const convertedToDisplay =
              canConvert && acc.balance !== undefined && acc.balance !== null
                ? convertAmount(acc.balance, accCurrency, displayCurrency)
                : null;
            const currConfig = getCurrencyConfig(accCurrency);
            const countryInfo = getCountryByCode(
              acc.countryCode || (acc.currency === 'BDT' ? 'BD' : undefined)
            );

            return (
              <div
                key={acc.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors hover:bg-surface-container-low/30 rounded-xl px-2"
              >
                {/* Account info */}
                <div className="flex items-center gap-3 min-w-0">
                  {getProviderBadge(acc.provider, acc.accountType || '')}
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
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono"
                        title={countryInfo.name}
                      >
                        {countryInfo.flag} {countryInfo.code}
                      </span>
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
                        {isDifferentFromDisplay && (
                          canConvert && convertedToDisplay !== null ? (
                            <span
                              className="text-[11px] text-secondary font-medium font-mono"
                              title={`${accCurrency} converted to ${displayCurrency}`}
                            >
                              ≈ {formatCurrency(convertedToDisplay, displayCurrency)}
                            </span>
                          ) : (
                            <span
                              className="text-[11px] text-outline italic"
                              title="Exchange rate conversion is unavailable for this currency pair"
                            >
                              Conversion unavailable
                            </span>
                          )
                        )}
                        <span className="text-[10px] text-outline">
                          Manual Balance
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-outline italic">
                        No balance set
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(acc)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                      title="Edit Account"
                      aria-label="Edit account"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingAccount(acc)}
                      className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                      title="Remove Account"
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
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-lg shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">
                  {editingAccount ? 'edit' : 'add_card'}
                </span>
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  {editingAccount ? 'Edit Account' : 'Add Wallet or Bank Account'}
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

              {/* 1. Country / Region (Searchable Selector) */}
              <div className="flex flex-col gap-1 relative" ref={countryRef}>
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Country / Region *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCountryOpen(!isCountryOpen);
                    setIsProviderOpen(false);
                    setIsCurrencyOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm hover:border-secondary transition-all text-left"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span className="text-lg">{selectedCountryInfo.flag}</span>
                    <span>{selectedCountryInfo.name}</span>
                    <span className="text-xs text-outline font-mono">({selectedCountryInfo.code})</span>
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-outline">
                    {isCountryOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
                  </span>
                </button>

                {isCountryOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 p-2 flex flex-col gap-1.5 max-h-60 overflow-hidden">
                    <div className="relative">
                      <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-1/2 -translate-y-1/2">
                        search
                      </span>
                      <input
                        type="text"
                        autoFocus
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search country name or code..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                    <div className="overflow-y-auto max-h-44 flex flex-col divide-y divide-outline-variant/10">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelectCountry(c)}
                          className={`flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors text-left ${
                            c.code === selectedCountryCode
                              ? 'bg-secondary-container text-on-secondary-container font-semibold'
                              : 'hover:bg-surface-container-low text-on-surface'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                            <span className="text-[11px] text-outline font-mono">({c.code})</span>
                          </span>
                          <span className="text-[11px] text-outline font-mono font-bold">
                            {c.defaultCurrency}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Account Type (Bank Account, Mobile Money / Digital Wallet, Cash, Other Financial Account) */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Account Type *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {INTERNATIONAL_ACCOUNT_TYPES.map((type) => {
                    const isSelected = accountType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleSelectAccountType(type)}
                        className={`p-2 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-secondary text-on-secondary border-secondary shadow-xs'
                            : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:border-outline'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] shrink-0">
                          {type === 'Bank Account'
                            ? 'account_balance'
                            : type === 'Mobile Money / Digital Wallet'
                            ? 'smartphone'
                            : type === 'Cash'
                            ? 'payments'
                            : 'savings'}
                        </span>
                        <span className="truncate">{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Provider / Institution (Searchable Dropdown + Custom Entry) */}
              <div className="flex flex-col gap-1 relative" ref={providerRef}>
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Provider / Institution *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsProviderOpen(!isProviderOpen);
                    setIsCountryOpen(false);
                    setIsCurrencyOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm hover:border-secondary transition-all text-left"
                >
                  <span className="truncate">
                    {providerSelect === '__custom__' || providerSelect === 'Other'
                      ? customProvider.trim() || 'Custom Provider / Manual Entry...'
                      : providerSelect}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
                    {isProviderOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
                  </span>
                </button>

                {isProviderOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 p-2 flex flex-col gap-1.5 max-h-60 overflow-hidden">
                    <div className="relative">
                      <span className="material-symbols-outlined text-[18px] text-outline absolute left-2.5 top-1/2 -translate-y-1/2">
                        search
                      </span>
                      <input
                        type="text"
                        autoFocus
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder="Search provider or type custom..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                    <div className="overflow-y-auto max-h-44 flex flex-col divide-y divide-outline-variant/10">
                      {filteredProviders.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setProviderSelect(p);
                            setCustomProvider('');
                            setIsProviderOpen(false);
                            setProviderSearch('');
                          }}
                          className={`flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors text-left ${
                            providerSelect === p
                              ? 'bg-secondary-container text-on-secondary-container font-semibold'
                              : 'hover:bg-surface-container-low text-on-surface'
                          }`}
                        >
                          <span className="truncate">{p}</span>
                        </button>
                      ))}

                      {/* Option to manually enter custom provider */}
                      <button
                        type="button"
                        onClick={() => {
                          setProviderSelect('__custom__');
                          if (providerSearch.trim()) {
                            setCustomProvider(providerSearch.trim());
                          }
                          setIsProviderOpen(false);
                          setProviderSearch('');
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-lg transition-colors text-left font-semibold ${
                          providerSelect === '__custom__' || providerSelect === 'Other'
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'hover:bg-surface-container-low text-secondary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        <span>
                          {providerSearch.trim()
                            ? `Use "${providerSearch.trim()}" as Custom Provider`
                            : '+ Enter Custom Provider / Bank Name...'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Provider Name Input Field */}
                {(providerSelect === '__custom__' || providerSelect === 'Other') && (
                  <div className="mt-1 flex flex-col gap-1">
                    <input
                      type="text"
                      required
                      value={customProvider}
                      onChange={(e) => setCustomProvider(e.target.value)}
                      placeholder="Enter custom provider / institution name"
                      className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                    <p className="text-[11px] text-outline italic">
                      You can enter any local bank, SACCO, credit union, or private wallet.
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Display Name & Account Identifier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Salary, Daily Wallet"
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Account No. / ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 01712345678 or AC-9876"
                    className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                  />
                </div>
              </div>

              {/* 5. Currency & Current Balance */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Currency & Current Balance (Optional)
                </label>
                <div className="flex items-center gap-2">
                  {/* Searchable Currency Selector */}
                  <div className="relative w-36 sm:w-44 shrink-0" ref={currencyRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCurrencyOpen(!isCurrencyOpen);
                        setIsCountryOpen(false);
                        setIsProviderOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-xs sm:text-sm font-semibold hover:border-secondary transition-all"
                      title="Account Currency"
                    >
                      <span className="flex items-center gap-1.5 truncate font-mono">
                        <span>{getCurrencyConfig(accountCurrency).flag}</span>
                        <span>{accountCurrency}</span>
                      </span>
                      <span className="material-symbols-outlined text-[16px] text-outline shrink-0">
                        {isCurrencyOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
                      </span>
                    </button>

                    {isCurrencyOpen && (
                      <div className="absolute top-full left-0 right-0 sm:w-64 mt-1 z-30 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 p-2 flex flex-col gap-1.5 max-h-56 overflow-hidden">
                        <div className="relative">
                          <span className="material-symbols-outlined text-[16px] text-outline absolute left-2 top-1/2 -translate-y-1/2">
                            search
                          </span>
                          <input
                            type="text"
                            autoFocus
                            value={currencySearch}
                            onChange={(e) => setCurrencySearch(e.target.value)}
                            placeholder="Search currency..."
                            className="w-full pl-7 pr-2 py-1 rounded-lg border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                          />
                        </div>
                        <div className="overflow-y-auto max-h-40 flex flex-col divide-y divide-outline-variant/10">
                          {filteredCurrencies.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setAccountCurrency(c.code);
                                setIsCurrencyOpen(false);
                                setCurrencySearch('');
                              }}
                              className={`flex items-center justify-between px-2 py-1.5 text-xs rounded-lg transition-colors text-left ${
                                c.code === accountCurrency
                                  ? 'bg-secondary-container text-on-secondary-container font-semibold'
                                  : 'hover:bg-surface-container-low text-on-surface'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 font-mono">
                                <span>{c.flag}</span>
                                <span>{c.code}</span>
                                <span className="text-[11px] text-outline">({c.displaySymbol})</span>
                              </span>
                              <span className="text-[11px] text-outline truncate max-w-[90px]">
                                {c.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Numeric Balance Input */}
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-secondary pointer-events-none select-none">
                      {getCurrencyConfig(accountCurrency).displaySymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-outline mt-0.5">
                  Stored in {accountCurrency} and converted to {displayCurrency} in summary totals.
                </p>
              </div>

              {/* 6. Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Emergency savings, international freelance income"
                  className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-outline-variant/15 mt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant/30 text-on-surface text-sm font-medium hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  {editingAccount ? 'Update Account' : 'Save Account'}
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
                Remove Account?
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Are you sure you want to remove{' '}
                <strong>"{deletingAccount.displayName || deletingAccount.provider}"</strong> from your manually
                managed accounts?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/15 mt-1">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                className="px-3.5 py-1.5 rounded-xl border border-outline-variant/30 text-on-surface text-sm font-medium hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-error text-on-error font-title-md text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
              >
                Remove Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
