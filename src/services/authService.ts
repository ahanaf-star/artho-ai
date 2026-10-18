import { User } from '../types/financial';
import { INITIAL_USER } from '../data/mockUser';
import { apiService } from './apiService';

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
    const email = emailInput.trim().toLowerCase();

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
      // Re-throw validation or credential errors
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
   * Register a new user via backend API
   */
  async signup(
    nameInput: string,
    emailInput: string,
    passwordInput: string,
    preferredLanguage: 'en' | 'bn' = 'en',
    monthlyIncome?: number,
    monthlyIncomeCurrency: string = 'BDT'
  ): Promise<AuthSession> {
    const name = nameInput.trim();
    const email = emailInput.trim().toLowerCase();

    if (!name) {
      throw new Error('Name is required.');
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw new Error('Please enter a valid email address.');
    }
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
      monthlyIncome: monthlyIncome !== undefined ? monthlyIncome : 0,
      monthlyIncomeCurrency: monthlyIncomeCurrency || 'BDT',
      monthlyInflowBaseline: monthlyIncome !== undefined ? monthlyIncome : 0,
      baselineCurrency: monthlyIncomeCurrency || 'BDT',
      riskTolerance: 'Moderate',
      primaryGoalId: 'goal-emergency-fund',
      privacyStatus: 'E2E Encrypted',
      linkedAccounts: [
        { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
        { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
        { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
      ],
    };

    const session: AuthSession = {
      user: newUser,
      token: `fmt_offline_${Date.now()}`,
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
