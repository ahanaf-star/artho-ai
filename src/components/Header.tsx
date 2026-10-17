import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NavScreen } from './Sidebar';
import { Transaction, SavingsGoal, UserProfile } from '../types/financial';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
  formatCurrency,
  convertAmount,
  normalizeCurrencyCode,
} from '../services/currencyService';

interface HeaderProps {
  onNavigate: (screen: NavScreen) => void;
  onOpenMobileSidebar: () => void;
  isBangla: boolean;
  onToggleBangla: (bangla: boolean) => void;
  transactions: Transaction[];
  goals: SavingsGoal[];
  user: UserProfile;
  onLogout?: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
  onCurrencyChange?: (currencyCode: string) => void;
  exchangeRateTimestamp?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenMobileSidebar,
  isBangla,
  onToggleBangla: _onToggleBangla,
  transactions,
  goals,
  user,
  onLogout,
  onCurrencyChange,
  exchangeRateTimestamp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState('');

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  const activeCurrencyCode = normalizeCurrencyCode(user?.currency);
  const activeCurrency = getCurrencyConfig(activeCurrencyCode);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setIsCurrencyOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items for search
  const filteredTxs = searchQuery.trim()
    ? transactions
        .filter(
          (t) =>
            t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 4)
    : [];

  const filteredGoals = searchQuery.trim()
    ? goals
        .filter(
          (g) =>
            g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 2)
    : [];

  // Filtered currencies for dropdown
  const filteredCurrencies = useMemo(() => {
    const q = currencyFilter.trim().toLowerCase();
    if (!q) return SUPPORTED_CURRENCIES;
    return SUPPORTED_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.nameBn.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencyFilter]);

  const handleSelectCurrency = (code: string) => {
    if (onCurrencyChange) {
      onCurrencyChange(code);
    }
    setIsCurrencyOpen(false);
    setCurrencyFilter('');
  };

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-20 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-3 sm:px-4 lg:px-space-lg flex items-center justify-between gap-space-sm sm:gap-space-md border-b border-outline-variant/20 print:hidden">
      {/* Left: Mobile hamburger & Search bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <div className="relative flex-1" ref={searchRef}>
          <div className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-space-sm text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder={
                isBangla
                  ? 'লেনদেন, সঞ্চয় বা পরামর্শ খুঁজুন...'
                  : 'Search transactions, goals, AI insights...'
              }
              className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-space-md bg-surface-container-lowest rounded-xl font-body-sm text-xs sm:text-body-sm text-on-surface placeholder:text-outline border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Live Search Results Popup */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-12 left-0 right-0 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 p-2 z-50 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {filteredGoals.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-outline px-2 uppercase tracking-wider">
                    Savings Goals
                  </span>
                  {filteredGoals.map((g) => {
                    const convertedTarget = convertAmount(g.targetAmount, 'BDT', activeCurrencyCode);
                    const convertedCurrent = convertAmount(g.currentAmount, 'BDT', activeCurrencyCode);
                    return (
                      <button
                        key={g.id}
                        onClick={() => {
                          onNavigate('savings-goals');
                          setIsSearchOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span>{g.icon}</span>
                          <div className="flex flex-col">
                            <span className="font-title-md text-sm text-on-surface">
                              {g.title}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              Target: {formatCurrency(convertedTarget, activeCurrencyCode)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-secondary">
                          {formatCurrency(convertedCurrent, activeCurrencyCode)} saved
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredTxs.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-outline px-2 uppercase tracking-wider">
                    Transactions
                  </span>
                  {filteredTxs.map((t) => {
                    const convertedAmount = convertAmount(t.amount, (t as any).currency || 'BDT', activeCurrencyCode);
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          onNavigate('spending-analysis');
                          setIsSearchOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low text-left"
                      >
                        <div className="flex flex-col">
                          <span className="font-title-md text-sm text-on-surface">
                            {t.merchant}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {t.description} • {t.category}
                          </span>
                        </div>
                        <span
                          className={`text-sm font-bold ${
                            t.type === 'income' ? 'text-secondary' : 'text-on-surface'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'}
                          {formatCurrency(convertedAmount, activeCurrencyCode)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredGoals.length === 0 && filteredTxs.length === 0 && (
                <div className="p-4 text-center text-sm text-outline">
                  No matching results for "{searchQuery}". Try "Pathao", "Emergency", or "bKash".
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-space-md">
        {/* Multi-Currency & Location Selector Control */}
        <div className="relative" ref={currencyRef}>
          <button
            type="button"
            onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface transition-all border border-outline-variant/30 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary/40 shadow-xs"
            aria-label={`Select currency, current is ${activeCurrency.name}`}
            title={`Current Currency: ${activeCurrency.name} (${activeCurrency.code}) • Location: ${user.city || 'Dhaka'}`}
          >
            <span className="font-label-md text-label-md font-bold text-secondary">
              {activeCurrency.displaySymbol}
            </span>
            <span className="font-label-md text-label-md font-medium text-xs sm:text-sm text-on-surface">
              {activeCurrency.code}
            </span>
            <span className="text-outline text-xs hidden sm:inline">•</span>
            <span className="text-on-surface-variant text-xs hidden sm:inline font-medium">
              {user.city || 'Dhaka'}
            </span>
            <span className="material-symbols-outlined text-[16px] text-outline ml-0.5 transition-transform duration-150">
              {isCurrencyOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Currency Dropdown Popover */}
          {isCurrencyOpen && (
            <div className="absolute right-0 sm:left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant/30 p-2.5 z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-2 py-1 flex items-center justify-between border-b border-outline-variant/15 pb-2">
                <div>
                  <h3 className="font-title-md text-xs sm:text-sm font-bold text-on-surface">
                    {isBangla ? 'মুদ্রা নির্বাচন করুন' : 'Select Display Currency'}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    {isBangla
                      ? 'ড্যাশবোর্ড ও রিপোর্ট এই মুদ্রায় রূপান্তর হবে'
                      : 'Dashboard, reports & totals convert live'}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                  11 Currencies
                </span>
              </div>

              {/* Currency Search Input */}
              <div className="relative px-1">
                <span className="material-symbols-outlined absolute left-3 top-2 text-[16px] text-outline">
                  search
                </span>
                <input
                  type="text"
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  placeholder={isBangla ? 'মুদ্রা বা কোড খুঁজুন...' : 'Search currency (e.g. USD, EUR, JPY)...'}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary"
                  autoFocus
                />
              </div>

              {/* Currency List */}
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-0.5 custom-scrollbar">
                {filteredCurrencies.map((c) => {
                  const isSelected = c.code === activeCurrencyCode;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCurrency(c.code)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-secondary-container/25 border border-secondary/40 shadow-xs'
                          : 'hover:bg-surface-container-low border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-secondary text-on-secondary'
                              : 'bg-surface-container-low text-on-surface-variant'
                          }`}
                        >
                          {c.displaySymbol}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-title-md text-xs sm:text-sm font-bold text-on-surface">
                              {c.code}
                            </span>
                            <span className="text-[11px] text-outline">({c.symbol})</span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant truncate max-w-[150px] sm:max-w-[170px]">
                            {isBangla ? c.nameBn : c.name}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[18px] text-secondary font-bold">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}

                {filteredCurrencies.length === 0 && (
                  <div className="p-3 text-center text-xs text-outline">
                    No currencies match "{currencyFilter}"
                  </div>
                )}
              </div>

              {/* Footer: Rate Freshness & User Location Clarity */}
              <div className="pt-2 border-t border-outline-variant/15 px-2 flex flex-col gap-1 text-[10px] text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-secondary">
                      currency_exchange
                    </span>
                    <span>Live Exchange Rates</span>
                  </span>
                  <span className="text-outline">
                    {exchangeRateTimestamp ? `Updated: ${exchangeRateTimestamp.slice(0, 16)}` : 'Updated daily via API'}
                  </span>
                </div>
                <p className="text-outline italic text-[9.5px]">
                  * Note: Currency preference changes display currency; your home city remains {user.city || 'Dhaka'}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Home / Landing quick link */}
        <button
          onClick={() => onNavigate('landing')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/30 transition-colors"
          title="Visit Home / Landing Page"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">home</span>
          <span>{isBangla ? 'হোম' : 'Home'}</span>
        </button>

        {/* Ask ArthoBachao AI Action Button */}
        <button
          onClick={() => onNavigate('ai-coach')}
          className="flex items-center gap-1.5 px-2.5 sm:px-space-md py-2 rounded-full bg-primary-container text-on-primary hover:opacity-90 transition-opacity active:scale-95 shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary-container">
            auto_awesome
          </span>
          <span className="font-title-md text-xs sm:text-title-md whitespace-nowrap">
            {isBangla ? 'পরামর্শ' : 'Ask AI Coach'}
          </span>
        </button>

        {/* User Profile Avatar with Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-space-sm pl-space-xs cursor-pointer select-none py-1 px-1.5 rounded-xl hover:bg-surface-container-low transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs ring-2 ring-secondary/30 overflow-hidden shrink-0">
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{user.name ? user.name.slice(0, 2).toUpperCase() : 'AR'}</span>
              )}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="font-title-md text-title-md leading-none text-on-surface truncate max-w-[120px]">
                {user.name.split(' ')[0]}
              </span>
              <span className="font-label-sm text-label-sm leading-none text-secondary font-semibold mt-1">
                {user.memberStatus || 'Pro Member'}
              </span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline hidden sm:inline">
              expand_more
            </span>
          </div>

          {/* User Popover Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant/30 p-2.5 z-50 flex flex-col gap-1.5 animate-in fade-in duration-150">
              <div className="p-2 border-b border-outline-variant/15 flex flex-col">
                <span className="font-title-md text-sm text-on-surface font-bold truncate">
                  {user.name}
                </span>
                <span className="font-body-sm text-xs text-on-surface-variant truncate">
                  {user.email}
                </span>
                <span className="font-label-sm text-[11px] text-secondary mt-1 font-semibold">
                  Preferred Currency: {activeCurrency.code} ({activeCurrency.symbol})
                </span>
              </div>

              <button
                onClick={() => {
                  onNavigate('settings-profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-sm text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  manage_accounts
                </span>
                <span>{isBangla ? 'প্রোফাইল ও সেটিংস' : 'Profile & Settings'}</span>
              </button>

              {onLogout && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-sm text-error hover:bg-error-container/20 transition-colors border-t border-outline-variant/10 mt-1"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>{isBangla ? 'লগআউট করুন' : 'Sign Out'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
