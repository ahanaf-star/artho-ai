import React from 'react';

export type NavScreen =
  | 'landing'
  | 'login'
  | 'signup'
  | 'dashboard'
  | 'spending-analysis'
  | 'savings-goals'
  | 'cash-flow-forecast'
  | 'ai-coach'
  | 'financial-health'
  | 'insights-alerts'
  | 'settings-profile';

interface SidebarProps {
  activeScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  onLogout,
}) => {
  const navItems: Array<{
    id: NavScreen;
    label: string;
    icon: string;
    badge?: string;
  }> = [
    { id: 'landing', label: 'Landing / Home', icon: 'home' },
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view' },
    { id: 'spending-analysis', label: 'Spending Analysis', icon: 'pie_chart' },
    { id: 'savings-goals', label: 'Savings Goals', icon: 'savings' },
    { id: 'cash-flow-forecast', label: 'Cash Flow Forecast', icon: 'trending_up' },
    { id: 'ai-coach', label: 'AI Coach', icon: 'auto_awesome', badge: 'AI Active' },
    { id: 'financial-health', label: 'Financial Health', icon: 'vital_signs' },
    { id: 'insights-alerts', label: 'Insights & Alerts', icon: 'notifications_active' },
  ];

  const handleItemClick = (screen: NavScreen) => {
    onNavigate(screen);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo Header */}
          <div className="h-20 px-space-lg flex items-center justify-between gap-space-sm border-b border-outline-variant/10">
            <div
              className="flex items-center gap-space-sm cursor-pointer select-none"
              onClick={() => handleItemClick('dashboard')}
            >
              <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm">
                <span className="material-symbols-outlined text-[22px] text-secondary-container">
                  account_balance_wallet
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-lg text-title-lg text-on-surface tracking-tight leading-none font-bold">
                  ArthoBachao AI
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant leading-none mt-1">
                  Intelligent Wealth Engine
                </span>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-space-md py-space-xs mt-2">
            <p className="px-space-sm py-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
              Core Financials
            </p>
            <nav className="flex flex-col gap-space-xs mt-space-xs">
              {navItems.map((item) => {
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`flex items-center justify-between w-full px-space-sm py-space-sm rounded-xl transition-all text-left ${
                      isActive
                        ? 'bg-primary-container text-on-primary font-title-md shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-space-sm">
                      <span
                        className={`material-symbols-outlined text-[20px] ${
                          isActive && item.id === 'ai-coach'
                            ? 'text-tertiary-container'
                            : isActive
                            ? 'text-on-primary'
                            : ''
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="font-body-md text-body-md">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="p-space-md border-t border-outline-variant/30 flex flex-col gap-2">
          <button
            onClick={() => handleItemClick('settings-profile')}
            className={`flex items-center gap-space-sm w-full px-space-sm py-space-sm rounded-xl transition-all text-left ${
              activeScreen === 'settings-profile'
                ? 'bg-primary-container text-on-primary font-title-md shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            <span className="font-body-md text-body-md">Settings &amp; Profile</span>
          </button>
          {onLogout && (
            <button
              onClick={() => {
                onCloseMobile();
                onLogout();
              }}
              className="flex items-center gap-space-sm w-full px-space-sm py-2 rounded-xl text-left text-sm text-error/90 hover:bg-error-container/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span className="font-body-sm text-body-sm font-semibold">Sign Out</span>
            </button>
          )}
          <div className="px-space-sm py-1 flex items-center justify-between text-[11px] text-outline">
            <span>Dhaka Metro • v4.2</span>
            <span className="flex items-center gap-1 text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Live Sync
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
