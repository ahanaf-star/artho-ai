import { User, Transaction, SavingsGoal, CustomCategory, WalletAccount } from '../types/financial';

const BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('finmate_auth_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.token) {
          headers['Authorization'] = `Bearer ${session.token}`;
        }
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return headers;
}

/**
 * REST API client for MongoDB-backed FinMate AI services
 * Automatically attaches JWT authentication token when available
 */
export const apiService = {
  /**
   * POST /api/auth/signup
   */
  async signup(
    name: string,
    email: string,
    password: string,
    preferredLanguage: 'en' | 'bn' = 'en',
    monthlyIncome?: number,
    monthlyIncomeCurrency: string = 'BDT'
  ) {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        preferredLanguage,
        monthlyIncome,
        monthlyIncomeCurrency,
        monthlyInflowBaseline: monthlyIncome,
        baselineCurrency: monthlyIncomeCurrency,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    return data;
  },

  /**
   * POST /api/auth/login
   */
  async login(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    return data;
  },

  /**
   * POST /api/auth/logout
   */
  async logout() {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (e) {
      // Ignore network errors on logout
    }
  },

  /**
   * GET /api/auth/me
   */
  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch (err) {
      return null;
    }
  },

  /**
   * GET /api/users/:id
   */
  async getUser(id: string): Promise<User | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(id)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] getUser(${id}) failed, falling back to local state:`, err);
      return null;
    }
  },

  /**
   * PUT /api/users/:id
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updates),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] updateUser(${id}) failed, using local update:`, err);
      return null;
    }
  },

  /**
   * GET /api/users/:userId/transactions
   */
  async getTransactions(userId: string): Promise<Transaction[] | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/transactions`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] getTransactions(${userId}) failed, using local cache:`, err);
      return null;
    }
  },

  /**
   * POST /api/users/:userId/transactions
   */
  async createTransaction(userId: string, tx: Transaction): Promise<Transaction> {
    const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/transactions`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(tx),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create transaction (${res.status})`);
    }
    return await res.json();
  },

  /**
   * PUT /api/users/:userId/transactions/:txId
   */
  async updateTransaction(userId: string, txId: string, updates: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/transactions/${encodeURIComponent(txId)}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update transaction (${res.status})`);
    }
    return await res.json();
  },

  /**
   * DELETE /api/users/:userId/transactions/:txId
   */
  async deleteTransaction(userId: string, txId: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/transactions/${encodeURIComponent(txId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete transaction (${res.status})`);
    }
    return true;
  },

  /**
   * GET /api/users/:userId/goals
   */
  async getGoals(userId: string): Promise<SavingsGoal[] | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/goals`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] getGoals(${userId}) failed, using local cache:`, err);
      return null;
    }
  },

  /**
   * POST /api/users/:userId/goals
   */
  async createGoal(userId: string, goal: SavingsGoal): Promise<SavingsGoal | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/goals`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(goal),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] createGoal(${userId}) failed, recorded locally:`, err);
      return null;
    }
  },

  /**
   * PUT /api/goals/:id
   */
  async updateGoal(goalId: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/goals/${encodeURIComponent(goalId)}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updates),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] updateGoal(${goalId}) failed, updated locally:`, err);
      return null;
    }
  },

  /**
   * DELETE /api/goals/:id
   */
  async deleteGoal(goalId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/goals/${encodeURIComponent(goalId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (err) {
      console.warn(`[apiService] deleteGoal(${goalId}) failed, deleted locally:`, err);
      return false;
    }
  },

  /**
   * GET /api/users/:userId/categories
   */
  async getCategories(userId: string): Promise<CustomCategory[] | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/categories`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] getCategories(${userId}) failed, using local cache:`, err);
      return null;
    }
  },

  /**
   * POST /api/users/:userId/categories
   */
  async createCategory(
    userId: string,
    category: { name: string; type?: 'expense' | 'income' }
  ): Promise<CustomCategory> {
    const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/categories`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(category),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create category (${res.status})`);
    }
    return await res.json();
  },

  /**
   * DELETE /api/users/:userId/categories/:catId
   */
  async deleteCategory(userId: string, categoryId: string): Promise<boolean> {
    const res = await fetch(
      `${BASE_URL}/api/users/${encodeURIComponent(userId)}/categories/${encodeURIComponent(categoryId)}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to delete category (${res.status})`);
    }
    return true;
  },

  /**
   * GET /api/users/:userId/wallets
   */
  async getWalletAccounts(userId: string): Promise<WalletAccount[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/wallets`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] getWalletAccounts(${userId}) failed:`, err);
      return [];
    }
  },

  /**
   * POST /api/users/:userId/wallets
   */
  async addWalletAccount(userId: string, account: Partial<WalletAccount>): Promise<WalletAccount | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/wallets`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(account),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to add wallet account');
      }
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] addWalletAccount failed:`, err);
      throw err;
    }
  },

  /**
   * PUT /api/users/:userId/wallets/:accountId
   */
  async updateWalletAccount(
    userId: string,
    accountId: string,
    updates: Partial<WalletAccount>
  ): Promise<WalletAccount | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/api/users/${encodeURIComponent(userId)}/wallets/${encodeURIComponent(accountId)}`,
        {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update wallet account');
      }
      return await res.json();
    } catch (err) {
      console.warn(`[apiService] updateWalletAccount failed:`, err);
      throw err;
    }
  },

  /**
   * DELETE /api/users/:userId/wallets/:accountId
   */
  async deleteWalletAccount(userId: string, accountId: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BASE_URL}/api/users/${encodeURIComponent(userId)}/wallets/${encodeURIComponent(accountId)}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete wallet account');
      }
      return true;
    } catch (err) {
      console.warn(`[apiService] deleteWalletAccount failed:`, err);
      throw err;
    }
  },
};
