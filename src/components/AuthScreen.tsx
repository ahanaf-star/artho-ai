import React, { useState } from 'react';
import { authService, AuthSession } from '../services/authService';

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
  isBangla: boolean;
  onToggleBangla: (bangla: boolean) => void;
  initialMode?: 'login' | 'signup';
  onNavigateHome?: () => void;
  onModeChange?: (mode: 'login' | 'signup') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  isBangla,
  onToggleBangla,
  initialMode = 'login',
  onNavigateHome,
  onModeChange,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (initialMode && initialMode !== mode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error(isBangla ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন।' : 'Please enter your full name.');
        }
        if (password !== confirmPassword) {
          throw new Error(isBangla ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'Passwords do not match.');
        }
        if (password.length < 6) {
          throw new Error(isBangla ? 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters long.');
        }
        const session = await authService.signup(name, email, password, isBangla ? 'bn' : 'en');
        onAuthenticated(session);
      } else {
        const session = await authService.login(email, password);
        onAuthenticated(session);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const session = await authService.loginAsDemo();
      onAuthenticated(session);
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#6cf8bb] selection:text-[#005236] relative">
      {/* Back to Home Button floating top-left */}
      {onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="absolute top-6 left-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-semibold shadow-xs border border-outline-variant/30 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>{isBangla ? 'হোম পেজ' : 'Back to Home'}</span>
        </button>
      )}

      {/* Language Switch floating top-right */}
      <div className="absolute top-6 right-6 inline-flex p-0.5 rounded-full bg-surface-container-low text-on-surface shadow-xs border border-outline-variant/30">
        <button
          type="button"
          onClick={() => onToggleBangla(false)}
          className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-all ${!isBangla
              ? 'bg-surface-container-lowest shadow-sm text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface'
            }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => onToggleBangla(true)}
          className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-all ${isBangla
              ? 'bg-surface-container-lowest shadow-sm text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface'
            }`}
        >
          বাং
        </button>
      </div>

      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Brand Header */}
        <div
          className={`flex flex-col items-center text-center gap-2 ${onNavigateHome ? 'cursor-pointer' : ''}`}
          onClick={onNavigateHome}
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary shadow-md">
            <span className="material-symbols-outlined text-[32px] text-secondary-container">
              account_balance_wallet
            </span>
          </div>
          <div className="flex flex-col mt-1">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              ArthoBachao AI
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              {isBangla
                ? 'আপনার বুদ্ধিমত্তা সম্পন্ন ব্যক্তিগত আর্থিক অভিভাবক'
                : 'Intelligent Personal Wealth & Savings Engine'}
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                onModeChange?.('login');
              }}
              className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${mode === 'login'
                  ? 'bg-surface-container-lowest shadow-sm text-on-surface font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
                }`}
            >
              {isBangla ? 'লগইন' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                onModeChange?.('signup');
              }}
              className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${mode === 'signup'
                  ? 'bg-surface-container-lowest shadow-sm text-on-surface font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
                }`}
            >
              {isBangla ? 'অ্যাকাউন্ট খুলুন' : 'Create Account'}
            </button>
          </div>

          {/* Quick Demo Access Bar */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full py-2.5 px-3 rounded-xl bg-secondary-container/60 hover:bg-secondary-container text-on-secondary-container font-title-md text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-secondary/30"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span>
              {isBangla ? 'আহমেদ রহমান (ডেমো অ্যাকাউন্ট) হিসেবে প্রবেশ' : 'Sign in as Demo User (Ahmed Rahman)'}
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant/20"></div>
            <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {isBangla ? 'অথবা ইমেইল ব্যবহার করুন' : 'or continue with credentials'}
            </span>
            <div className="flex-1 h-px bg-outline-variant/20"></div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex items-start gap-2 animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {mode === 'signup' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'পুরো নাম' : 'Full Name'}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                    person
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isBangla ? 'যেমন: আহমেদ রহমান' : 'e.g. Tanvir Hossain'}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                {isBangla ? 'ইমেইল ঠিকানা' : 'Email Address'}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'পাসওয়ার্ড' : 'Password'}
                </label>
                {mode === 'login' && (
                  <span className="text-[11px] text-outline font-medium">
                    Demo: ahmed123
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-outline hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  {isBangla ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                    lock_reset
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                  <span>{isBangla ? 'যাচাই করা হচ্ছে...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? isBangla
                        ? 'লগইন করুন'
                        : 'Sign In to Account'
                      : isBangla
                        ? 'অ্যাকাউন্ট তৈরি করুন'
                        : 'Create Account'}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Privacy Footnote */}
          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-center gap-1.5 text-outline text-[11px]">
            <span className="material-symbols-outlined text-[14px] text-secondary">
              verified_user
            </span>
            <span>Client-side SHA-256 encrypted authentication &amp; local data isolation.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
