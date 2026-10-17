import React, { useState, useRef, useEffect } from 'react';
import { NavScreen } from './Sidebar';
import { Transaction, SavingsGoal, UserProfile } from '../types/financial';

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
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenMobileSidebar,
  isBangla,
  onToggleBangla,
  transactions,
  goals,
  user,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
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

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-20 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-4 lg:px-space-lg flex items-center justify-between gap-space-md border-b border-outline-variant/20">
      {/* Left: Mobile hamburger & Search bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
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
              className="w-full h-11 pl-10 pr-space-md bg-surface-container-lowest rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
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
                  {filteredGoals.map((g) => (
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
                            Target: ৳{g.targetAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-secondary">
                        ৳{g.currentAmount.toLocaleString()} saved
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {filteredTxs.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-outline px-2 uppercase tracking-wider">
                    Transactions
                  </span>
                  {filteredTxs.map((t) => (
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
                        {t.type === 'income' ? '+' : '-'}৳{t.amount.toLocaleString()}
                      </span>
                    </button>
                  ))}
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
      <div className="flex items-center gap-2 sm:gap-space-md">
        {/* Currency & Dhaka Pill */}
        <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-1.5 rounded-full bg-surface-container-low text-on-surface">
          <span className="font-label-md text-label-md font-semibold text-secondary">৳</span>
          <span className="font-label-md text-label-md font-medium text-xs sm:text-sm">
            BDT • Dhaka
          </span>
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
          className="flex items-center gap-1.5 px-3 sm:px-space-md py-2 rounded-full bg-primary-container text-on-primary hover:opacity-90 transition-opacity active:scale-95 shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary-container">
            auto_awesome
          </span>
          <span className="font-title-md text-xs sm:text-title-md whitespace-nowrap">
            {isBangla ? 'পরামর্শ নিন' : 'Ask ArthoBachao AI'}
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
