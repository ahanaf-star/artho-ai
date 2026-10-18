import { User } from '../types/financial';
import { INITIAL_USER } from '../data/mockUser';
import { apiService } from './apiService';
import { validateLoginEmail, validateSignupEmail } from '../utils/emailValidation';

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

const STORAGE_SESSION_KEY = 'finmate_auth_session';

export const authService = {
  /**
   * Get active authenticated session from local persistence
   */
  getSession(): AuthSession | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (session.expiresAt && Date.now() > session.expiresAt) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return null;
      }
      return session;
    } catch (e) {
      console.error('Failed reading auth session:', e);
      return null;
    }
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    const session = this.getSession();
    return session ? session.user : null;
  },

  /**
   * Check if user is logged in
   */
  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  },

  /**
   * Authenticate user with email and password via backend API
   */
  async login(emailInput: string, passwordInput: string): Promise<AuthSession> {
    const emailValidation = validateLoginEmail(emailInput);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error || 'Please enter a valid email address.');
    }
    const email = emailValidation.normalizedEmail;

    try {
      const data = await apiService.login(email, passwordInput);
      if (data?.token && data?.user) {
        const session: AuthSession = {
          user: data.user,
          token: data.token,
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
        };
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        return session;
      }
    } catch (apiErr: any) {
      // Re-throw validation or verification errors directly
      if (
        apiErr?.requiresVerification ||
        (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch'))
      ) {
        throw apiErr;
      }
      console.warn('[authService] Backend login call failed, trying local fallback:', apiErr);
    }

    // Local fallback for offline mode
    if (email === INITIAL_USER.email.toLowerCase() && passwordInput === 'ahmed123') {
      const session: AuthSession = {
        user: INITIAL_USER,
        token: `fmt_offline_${Date.now()}`,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      return session;
    }

    throw new Error('Invalid email or password. Please verify your credentials.');
  },

  /**
   * Register a new user via backend API (requires subsequent email verification)
   */
  async signup(
    nameInput: string,
    emailInput: string,
    passwordInput: string,
    preferredLanguage: 'en' | 'bn' = 'en',
    monthlyIncome?: number,
    monthlyIncomeCurrency: string = 'BDT'
  ): Promise<AuthSession & { requiresVerification: boolean; email: string; message: string; cooldownSeconds?: number }> {
    const name = nameInput.trim();
    if (!name) {
      throw new Error('Name is required.');
    }

    const emailValidation = validateSignupEmail(emailInput);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error || 'Please enter a valid email address.');
    }
    const email = emailValidation.normalizedEmail;

    if (!passwordInput || passwordInput.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      const data = await apiService.signup(
        name,
        email,
        passwordInput,
        preferredLanguage,
        monthlyIncome,
        monthlyIncomeCurrency
      );
      const user: User = data.user || {
        id: `usr-${Date.now()}`,
        name,
        email,
        preferredLanguage,
        currency: 'BDT',
        monthlyIncome,
        monthlyIncomeCurrency,
        createdAt: new Date().toISOString(),
        isEmailVerified: false,
      };
      return {
        user,
        token: '',
        expiresAt: 0,
        requiresVerification: true,
        email,
        message: data.message || 'Please check your email for your verification code.',
        cooldownSeconds: data.cooldownRemainingSeconds || 60,
      };
    } catch (apiErr: any) {
      if (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      console.warn('[authService] Backend signup call failed, trying local fallback:', apiErr);
    }

    // Local fallback for offline mode
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      preferredLanguage,
      currency: 'BDT',
      createdAt: new Date().toISOString(),
      tagline: 'Standard Member',
      memberStatus: 'Standard Member',
      city: 'Dhaka',
      monthlyIncome: monthlyIncome || 0,
      monthlyIncomeCurrency: monthlyIncomeCurrency || 'BDT',
      riskTolerance: 'Moderate',
      primaryGoalId: 'goal-emergency-fund',
      privacyStatus: 'E2E Encrypted',
      isEmailVerified: false,
      linkedAccounts: [
        { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
        { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
        { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
      ],
    };

    const session: AuthSession & { requiresVerification: boolean; email: string; message: string } = {
      user: newUser,
      token: `fmt_offline_${Date.now()}`,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
      requiresVerification: true,
      email,
      message: 'Registration successful. Please verify your email.',
    };

    return session;
  },

  /**
   * Verify email with 6-digit OTP code and create authenticated session
   */
  async verifyEmail(emailInput: string, code: string): Promise<AuthSession> {
    const email = emailInput.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!email) {
      throw new Error('Email address is required.');
    }
    if (!cleanCode) {
      throw new Error('Please enter the 6-digit verification code.');
    }

    const data = await apiService.verifyEmail(email, cleanCode);
    if (!data?.token || !data?.user) {
      throw new Error('Verification failed. Please try again.');
    }

    const session: AuthSession = {
      user: data.user,
      token: data.token,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Resend verification code with rate-limit cooldown
   */
  async resendVerification(emailInput: string): Promise<{ message: string; cooldownSeconds?: number }> {
    const emailValidation = validateLoginEmail(emailInput);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error || 'Please enter a valid email address.');
    }
    const email = emailValidation.normalizedEmail;

    return await apiService.resendVerification(email);
  },

  /**
   * Quick Demo Login for testing and evaluation
   */
  async loginAsDemo(): Promise<AuthSession> {
    return this.login(INITIAL_USER.email, 'ahmed123');
  },

  /**
   * Log out active user and clear session
   */
  async logout(): Promise<void> {
    try {
      await apiService.logout();
    } catch (e) {
      // Ignore network errors
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    } catch (e) {
      console.error('Failed removing session:', e);
    }
  },

  /**
   * Update active user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    let session = this.getSession();
    if (!session) {
      session = {
        user: INITIAL_USER,
        token: `fmt_demo_${Date.now()}`,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }

    const updatedUser: User = {
      ...session.user,
      ...updates,
    };

    // Update active session locally
    session.user = updatedUser;
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));

    // Sync to backend via apiService
    try {
      await apiService.updateUser(updatedUser.id, updates);
    } catch (err) {
      console.warn('[authService] Remote update profile sync skipped:', err);
    }

    return updatedUser;
  },

  /**
   * Directly sync active session user locally in localStorage without triggering remote update
   */
  setSessionUser(updatedUser: User): void {
    const session = this.getSession();
    if (session) {
      session.user = { ...session.user, ...updatedUser };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
  },
};
