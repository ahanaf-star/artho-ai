import React, { useState, useEffect } from 'react';
import { authService, AuthSession } from '../services/authService';
import {
  SUPPORTED_CURRENCIES,
  normalizeCurrencyCode,
  getCurrencyConfig,
} from '../services/currencyService';
import { validateSignupEmail, validateLoginEmail, isDisposableEmail } from '../utils/emailValidation';

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
  isBangla: _isBangla,
  onToggleBangla: _onToggleBangla,
  initialMode = 'login',
  onNavigateHome,
  onModeChange,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyIncomeCurrency, setMonthlyIncomeCurrency] = useState('BDT');
  const [monthlyIncomeError, setMonthlyIncomeError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email verification state
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (initialMode && (initialMode === 'login' || initialMode === 'signup') && mode !== 'verify') {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Inline check for disposable domain warnings
  const emailDisposableWarning = React.useMemo(() => {
    if (!email || !email.includes('@')) return null;
    const domain = email.split('@')[1];
    if (domain && domain.includes('.') && isDisposableEmail(domain)) {
      return 'Disposable and temporary email addresses are not permitted. Please use your permanent email.';
    }
    return null;
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setMonthlyIncomeError(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }

        const emailCheck = validateSignupEmail(email);
        if (!emailCheck.isValid) {
          throw new Error(emailCheck.error || 'Please enter a valid email address.');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        let parsedIncome: number | undefined = undefined;
        const trimmedIncome = monthlyIncome.trim();
        if (trimmedIncome !== '') {
          const num = Number(trimmedIncome);
          if (isNaN(num) || !isFinite(num) || num < 0) {
            setMonthlyIncomeError('Value must be zero or a positive number.');
            setIsLoading(false);
            return;
          }
          parsedIncome = Math.round(num * 100) / 100;
        }

        const result = await authService.signup(
          name,
          email,
          password,
          'en',
          parsedIncome,
          monthlyIncomeCurrency
        );
        setVerificationEmail(result.email);
        setMode('verify');
        setInfoMsg(
          result.message ||
            `A 6-digit verification code has been sent to ${result.email}. Please enter it below to verify your account.`
        );
        setResendCooldown(result.cooldownSeconds || 60);
      } else if (mode === 'login') {
        const emailCheck = validateLoginEmail(email);
        if (!emailCheck.isValid) {
          throw new Error(emailCheck.error || 'Please enter a valid email address.');
        }

        const session = await authService.login(email, password);
        onAuthenticated(session);
      } else if (mode === 'verify') {
        if (!verificationCode.trim()) {
          throw new Error('Please enter the 6-digit verification code.');
        }
        const session = await authService.verifyEmail(verificationEmail || email, verificationCode);
        onAuthenticated(session);
      }
    } catch (err: any) {
      if (err?.requiresVerification || err?.isUnverified) {
        setVerificationEmail(err.email || email);
        setMode('verify');
        setInfoMsg(
          err.message ||
            'An unverified account with this email was found. Please enter your 6-digit verification code below.'
        );
        setErrorMsg(null);
        if (err.cooldownRemainingSeconds) {
          setResendCooldown(err.cooldownRemainingSeconds);
        }
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    const targetEmail = verificationEmail || email;
    try {
      const res = await authService.resendVerification(targetEmail);
      setInfoMsg(res.message || 'A new verification code has been sent to your email.');
      setResendCooldown(res.cooldownSeconds || 60);
    } catch (err: any) {
      if (err.remainingSeconds) {
        setResendCooldown(err.remainingSeconds);
      }
      setErrorMsg(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
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
          <span>Back to Home</span>
        </button>
      )}

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
              Artho AI
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Intelligent Personal Wealth &amp; Savings Engine
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-5">
          {/* Mode Switcher Tabs */}
          {mode !== 'verify' ? (
            <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                  onModeChange?.('login');
                }}
                className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-surface-container-lowest shadow-sm text-on-surface font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setInfoMsg(null);
                  onModeChange?.('signup');
                }}
                className={`py-2 rounded-lg font-title-md text-sm font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-surface-container-lowest shadow-sm text-on-surface font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  mark_email_read
                </span>
                <span className="font-title-md text-sm font-bold text-on-surface">
                  Verify Your Email
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="text-xs text-primary hover:underline font-semibold"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Quick Demo Access Bar (only shown on login/signup mode) */}
          {mode !== 'verify' && (
            <>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-secondary-container/60 hover:bg-secondary-container text-on-secondary-container font-title-md text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-secondary/30"
              >
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>Sign in as Demo User (Ahmed Rahman)</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline-variant/20"></div>
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                  or continue with credentials
                </span>
                <div className="flex-1 h-px bg-outline-variant/20"></div>
              </div>
            </>
          )}

          {/* Info Banner */}
          {infoMsg && (
            <div className="p-3 rounded-xl bg-primary-container/20 border border-primary/30 text-on-surface text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                info
              </span>
              <span className="leading-snug">{infoMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex flex-col gap-2.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                <span className="leading-snug">{errorMsg}</span>
              </div>
              {errorMsg.toLowerCase().includes('already exists') && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-error/20 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                      setInfoMsg(null);
                      onModeChange?.('login');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest text-primary font-bold hover:bg-surface transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">login</span>
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationEmail(email);
                      setMode('verify');
                      setErrorMsg(null);
                      setInfoMsg('Enter the 6-digit verification code sent to your email, or click Resend if expired.');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    <span>Verify Existing Email</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Verification Screen Mode */}
          {mode === 'verify' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-1 text-xs">
                <span className="text-on-surface-variant font-medium">Verification code sent to:</span>
                <span className="font-bold text-on-surface text-sm break-all">
                  {verificationEmail || email}
                </span>
                <span className="text-outline text-[11px] mt-0.5">
                  Enter the 6-digit code received in your inbox.
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  6-Digit Verification Code
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                    pin
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-3 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-mono text-center text-lg tracking-[0.35em] font-bold focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Log In</span>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  </>
                )}
              </button>

              {/* Resend Verification Code Button */}
              <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-outline-variant/15">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading || resendCooldown > 0}
                  className="text-xs font-semibold text-primary hover:text-primary/80 disabled:text-outline transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  {resendCooldown > 0 ? (
                    <span>Resend code in {resendCooldown}s</span>
                  ) : (
                    <span>Resend verification code</span>
                  )}
                </button>
                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                      setInfoMsg(null);
                      onModeChange?.('signup');
                    }}
                    className="hover:text-on-surface transition-colors cursor-pointer"
                  >
                    Return to signup
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                      setInfoMsg(null);
                      onModeChange?.('login');
                    }}
                    className="text-primary hover:underline transition-colors cursor-pointer"
                  >
                    Switch to Sign In
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Login or Signup Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              {mode === 'signup' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Full Name
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
                      placeholder="e.g. Tanvir Hossain"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Email Address
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
                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl border bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 ${
                      emailDisposableWarning
                        ? 'border-error ring-1 ring-error focus:ring-error'
                        : 'border-outline-variant/30 focus:ring-primary-container'
                    }`}
                  />
                </div>
                {emailDisposableWarning && (
                  <p className="text-[11px] font-semibold text-error mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">warning</span>
                    {emailDisposableWarning}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Password
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
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">
                      Confirm Password
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

                  {/* Monthly Inflow Baseline with Currency Selector (Optional) */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="registrationMonthlyIncome"
                        className="text-xs font-semibold text-outline uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <span>MONTHLY INFLOW BASELINE</span>
                        <span className="text-[10px] text-on-surface-variant font-normal lowercase tracking-normal bg-surface-container px-1.5 py-0.5 rounded-md">
                          optional
                        </span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Currency Selector */}
                      <select
                        id="registrationMonthlyIncomeCurrency"
                        aria-label="Monthly inflow baseline currency"
                        value={monthlyIncomeCurrency}
                        onChange={(e) => {
                          setMonthlyIncomeCurrency(normalizeCurrencyCode(e.target.value));
                        }}
                        className="w-40 sm:w-48 p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container font-body-md text-sm cursor-pointer shrink-0 font-medium"
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
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm pointer-events-none select-none">
                          {getCurrencyConfig(monthlyIncomeCurrency).displaySymbol}
                        </span>
                        <input
                          id="registrationMonthlyIncome"
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
                          placeholder="e.g. 50000"
                          className={`w-full pl-8 pr-3 py-2.5 rounded-xl border bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 transition-all ${
                            monthlyIncomeError
                              ? 'border-error focus:ring-error text-error'
                              : 'border-outline-variant/30 focus:ring-primary-container'
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
                      <span className="text-[11px] text-outline leading-tight">
                        Your expected total monthly income from all sources. Used for liquidity buffer and cash flow projections.
                      </span>
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading || !!emailDisposableWarning}
                className="mt-2 w-full py-3 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>{mode === 'login' ? 'Authenticating...' : 'Registering...'}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'login' ? 'Sign In to Account' : 'Create Account & Verify'}
                    </span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>

              {/* Mode Switching Helper */}
              <div className="flex items-center justify-between text-xs pt-1 px-1 text-on-surface-variant">
                <span>{mode === 'signup' ? 'Already registered?' : 'Need an account?'}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = mode === 'signup' ? 'login' : 'signup';
                      setMode(next);
                      setErrorMsg(null);
                      setInfoMsg(null);
                      onModeChange?.(next);
                    }}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {mode === 'signup' ? 'Sign In' : 'Sign Up'}
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationEmail(email);
                      setMode('verify');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="font-semibold text-secondary hover:underline cursor-pointer"
                  >
                    Verify Email
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Privacy Footnote */}
          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-center gap-1.5 text-outline text-[11px]">
            <span className="material-symbols-outlined text-[14px] text-secondary">
              verified_user
            </span>
            <span>Cryptographically verified email &amp; local data isolation.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
