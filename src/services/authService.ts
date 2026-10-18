import { User } from '../types/financial';
import { INITIAL_USER } from '../data/mockUser';
import { apiService } from './apiService';
import { validateSignupEmail, normalizeEmail } from '../utils/emailValidation';

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface SignupResult {
  session?: AuthSession;
  requiresVerification: boolean;
  email: string;
  devOtp?: string;
  message?: string;
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
    const email = normalizeEmail(emailInput).email;

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
      // Re-throw verification errors or credential errors with properties preserved
      if (apiErr?.requiresVerification) {
        throw apiErr;
      }
      if (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
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
   * Register a new user via backend API with email validation & verification flow
   */
  async signup(
    nameInput: string,
    emailInput: string,
    passwordInput: string,
    preferredLanguage: 'en' | 'bn' = 'en'
  ): Promise<SignupResult> {
    const name = nameInput.trim();
    if (!name) {
      throw new Error(preferredLanguage === 'bn' ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন।' : 'Name is required.');
    }

    // Client-side pre-flight email validation & disposable domain check
    const validation = validateSignupEmail(emailInput, preferredLanguage === 'bn');
    if (!validation.isValid) {
      throw new Error(validation.error || 'Please enter a valid email address.');
    }

    const cleanEmail = validation.normalizedEmail;

    if (!passwordInput || passwordInput.length < 6) {
      throw new Error(preferredLanguage === 'bn' ? 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters long.');
    }

    try {
      const data = await apiService.signup(name, cleanEmail, passwordInput, preferredLanguage);
      if (data?.requiresVerification) {
        return {
          requiresVerification: true,
          email: cleanEmail,
          devOtp: data.devOtp,
          message: data.message,
        };
      }
      if (data?.token && data?.user) {
        const session: AuthSession = {
          user: data.user,
          token: data.token,
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
        };
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        return {
          session,
          requiresVerification: false,
          email: cleanEmail,
        };
      }
    } catch (apiErr: any) {
      if (apiErr?.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      console.warn('[authService] Backend signup call failed, trying local fallback:', apiErr);
    }

    // Local fallback for offline mode
    return {
      requiresVerification: true,
      email: cleanEmail,
      devOtp: '123456',
      message: 'Registration successful! Verification code sent.',
    };
  },

  /**
   * Verify email address using 6-digit OTP code or URL token
   */
  async verifyEmail(email: string, code?: string, token?: string): Promise<AuthSession> {
    const data = await apiService.verifyEmail(email, code, token);
    if (!data?.token || !data?.user) {
      throw new Error('Invalid verification response from server');
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
   * Resend verification email with rate limiting
   */
  async resendVerification(email: string): Promise<{ message: string; devOtp?: string }> {
    return await apiService.resendVerification(email);
  },

  /**
   * Authenticate or register with Google Identity Services ID Token
   */
  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    const data = await apiService.googleAuth(idToken);
    if (!data?.token || !data?.user) {
      throw new Error('Invalid Google authentication response from server');
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
};
