import React, { useState, useEffect, useRef } from 'react';
import { authService, AuthSession } from '../services/authService';
import { validateSignupEmail, isDisposableEmail } from '../utils/emailValidation';

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
  isBangla?: boolean;
  onToggleBangla?: (bangla: boolean) => void;
  initialMode?: 'login' | 'signup';
  onNavigateHome?: () => void;
  onModeChange?: (mode: 'login' | 'signup') => void;
}

declare global {
  interface Window {
    google?: any;
    GOOGLE_CLIENT_ID?: string;
  }
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  isBangla = false,
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

  // Email Verification State
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);

  // UI & Loading States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);

  // Instant pre-flight disposable email warning
  const [disposableWarning, setDisposableWarning] = useState<string | null>(null);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Sync mode with prop
  useEffect(() => {
    if (initialMode && initialMode !== mode && mode !== 'verify') {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-verify if URL contains verifyToken and email
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('verifyToken') || params.get('token');
    const targetEmail = params.get('email');

    if (token && targetEmail) {
      setVerificationEmail(targetEmail);
      setMode('verify');
      setIsLoading(true);
      setErrorMsg(null);

      authService
        .verifyEmail(targetEmail, undefined, token)
        .then((session) => {
          window.history.replaceState({}, document.title, window.location.pathname);
          onAuthenticated(session);
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Token verification failed. Please enter the 6-digit code.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [onAuthenticated]);

  // Live pre-flight disposable domain warning on typing
  const handleEmailChange = (val: string) => {
    setEmail(val);
    setErrorMsg(null);
    if (mode === 'signup' && val.includes('@')) {
      const parts = val.split('@');
      if (parts[1] && isDisposableEmail(parts[1])) {
        setDisposableWarning('Notice: Disposable or temporary email domains are not allowed.');
      } else {
        setDisposableWarning(null);
      }
    } else {
      setDisposableWarning(null);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }

        const emailValidation = validateSignupEmail(email, false);
        if (!emailValidation.isValid) {
          throw new Error(emailValidation.error);
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        const result = await authService.signup(name, email, password, 'en');

        if (result.requiresVerification) {
          setVerificationEmail(result.email);
          setDevOtp(result.devOtp || null);
          setResendCooldown(60);
          setMode('verify');
          return;
        }

        if (result.session) {
          onAuthenticated(result.session);
        }
      } else if (mode === 'login') {
        const session = await authService.login(email, password);
        onAuthenticated(session);
      }
    } catch (err: any) {
      if (err?.requiresVerification) {
        setVerificationEmail(err.email || email);
        setResendCooldown(60);
        setMode('verify');
        setErrorMsg(err.message || 'Please verify your email address to log in.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Email Verification Form Submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const session = await authService.verifyEmail(verificationEmail, otpCode.trim());
      onAuthenticated(session);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend Verification Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setErrorMsg(null);
    setResendSuccessMsg(null);
    setIsLoading(true);

    try {
      const result = await authService.resendVerification(verificationEmail);
      setResendCooldown(60);
      if (result.devOtp) setDevOtp(result.devOtp);
      setResendSuccessMsg('A fresh verification code has been sent to your email.');
      setTimeout(() => setResendSuccessMsg(null), 5000);
    } catch (err: any) {
      if (err.retryAfter) {
        setResendCooldown(err.retryAfter);
      }
      setErrorMsg(err.message || 'Failed to resend verification code. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo user login
  const handleDemoLogin = async () => {
    if (isLoading) return;
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

  // Google Sign-In Initialization
  const googleClientId =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
    (typeof window !== 'undefined' && window.GOOGLE_CLIENT_ID) ||
    '';

  const handleGoogleClick = () => {
    if (isLoading) return;
    setErrorMsg(null);

    if (!googleClientId) {
      setShowGoogleConfigModal(true);
      return;
    }

    // If Google Identity Services SDK is ready, trigger prompt
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              setIsLoading(true);
              try {
                const session = await authService.loginWithGoogle(response.credential);
                onAuthenticated(session);
              } catch (err: any) {
                setErrorMsg(err.message || 'Google authentication failed. Please try again.');
              } finally {
                setIsLoading(false);
              }
            }
          },
        });
        window.google.accounts.id.prompt();
      } catch (_err: any) {
        setErrorMsg('Failed to initialize Google Sign-In. Check console for details.');
      }
    } else {
      setShowGoogleConfigModal(true);
    }
  };

  // Developer simulated Google Sign-In for testing without live Google Cloud setup
  const handleSimulateGoogleLogin = async () => {
    setShowGoogleConfigModal(false);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const mockPayload = {
        sub: `google-user-${Date.now()}`,
        email: email && !isDisposableEmail(email) ? email : 'google.user@example.com',
        name: name || 'Google Verified User',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      };
      const testToken = `test_google_token:${JSON.stringify(mockPayload)}`;
      const session = await authService.loginWithGoogle(testToken);
      onAuthenticated(session);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google simulation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#6cf8bb] selection:text-[#005236] relative">
      {/* Back to Home Button */}
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
              ArthoBachao AI
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Intelligent Personal Wealth &amp; Savings Engine
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-col gap-5">
          {/* Email Verification Step View */}
          {mode === 'verify' ? (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[28px]">mark_email_read</span>
                </div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Verify Your Email
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs">
                  For your security, we sent a 6-digit verification code to:
                </p>
                <span className="font-title-md text-sm font-bold text-on-surface bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/30">
                  {verificationEmail}
                </span>
              </div>

              {/* Development Test Code Hint */}
              {devOtp && (
                <div className="p-2.5 rounded-xl bg-secondary-container/50 border border-secondary/30 text-on-secondary-container text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    <span className="font-medium">Testing Code:</span>
                  </div>
                  <span className="font-mono font-bold tracking-widest text-sm bg-surface-container-lowest px-2 py-0.5 rounded border border-secondary/30">
                    {devOtp}
                  </span>
                </div>
              )}

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Success Banner */}
              {resendSuccessMsg && (
                <div className="p-3 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{resendSuccessMsg}</span>
                </div>
              )}

              {/* Verification Form */}
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider text-center">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full py-3 px-4 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-mono font-bold text-center text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary-container"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 font-bold"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm &amp; Activate Account</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Resend & Back controls */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-outline-variant/15">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="text-outline hover:text-on-surface transition-colors flex items-center gap-1 font-medium"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>Back to Sign In</span>
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  onClick={handleResendCode}
                  className="font-bold text-secondary hover:underline disabled:text-outline disabled:no-underline transition-all"
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </button>
              </div>
            </div>
          ) : (
            /* Standard Login / Signup View */
            <>
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setDisposableWarning(null);
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
                    setDisposableWarning(null);
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

              {/* Quick Demo Access Bar */}
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

              {/* Error Banner */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold flex items-start gap-2 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Disposable Email Warning Banner */}
              {disposableWarning && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0 text-amber-500">warning</span>
                  <span>{disposableWarning}</span>
                </div>
              )}

              {/* Credential Form */}
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
                        disabled={isLoading}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Tanvir Hossain"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
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
                      disabled={isLoading}
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
                    />
                  </div>
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
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
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
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">
                        lock_reset
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={isLoading}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface font-body-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full py-3 rounded-xl bg-primary text-on-primary font-title-md text-sm hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 font-bold"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign In to Account' : 'Create Account'}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Separator for Google Authentication */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-outline-variant/20"></div>
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-outline-variant/20"></div>
              </div>

              {/* Continue with Google Button */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container-low text-on-surface font-title-md text-sm font-semibold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xs disabled:opacity-50 hover:border-outline-variant/60"
              >
                {/* Official Google 'G' Logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

          {/* Privacy Footnote */}
          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-center gap-1.5 text-outline text-[11px]">
            <span className="material-symbols-outlined text-[14px] text-secondary">
              verified_user
            </span>
            <span>Client-side SHA-256 encrypted authentication &amp; local data isolation.</span>
          </div>
        </div>
      </div>

      {/* Google Setup Guide / Testing Modal */}
      {showGoogleConfigModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[24px]">vpn_key</span>
                </div>
                <div>
                  <h3 className="font-title-lg text-base font-bold text-on-surface">
                    Google Sign-In Configuration
                  </h3>
                  <span className="text-xs text-outline">
                    OAuth 2.0 Client ID Setup
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleConfigModal(false)}
                className="text-outline hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
              To enable live Google Sign-In with your Google Workspace or personal Gmail, configure your OAuth Client ID in your .env configuration:
            </p>

            <div className="p-3 rounded-xl bg-surface-container-low font-mono text-[11px] text-on-surface border border-outline-variant/20 flex flex-col gap-1.5">
              <div className="text-outline font-semibold"># In your .env file:</div>
              <div>VITE_GOOGLE_CLIENT_ID=&quot;your-id.apps.googleusercontent.com&quot;</div>
              <div>GOOGLE_CLIENT_ID=&quot;your-id.apps.googleusercontent.com&quot;</div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Development Testing Option
              </span>
              <button
                type="button"
                onClick={handleSimulateGoogleLogin}
                className="w-full py-2.5 px-3 rounded-xl bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-title-md text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-secondary/30"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Simulate Verified Google Sign-In (Test Flow)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
