import { Transaction, SavingsGoal, CustomCategory } from '../types/financial';
import { INITIAL_TRANSACTIONS } from '../data/mockTransactions';
import { INITIAL_SAVINGS_GOALS } from '../data/mockGoals';
import { apiService } from './apiService';

const PREFIX = 'finmate_v2';

function getTxKey(userId: string): string {
  return `${PREFIX}_${userId}_transactions`;
}

function getGoalsKey(userId: string): string {
  return `${PREFIX}_${userId}_goals`;
}

function getCategoriesKey(userId: string): string {
  return `${PREFIX}_${userId}_categories`;
}



export const financialDataService = {
  /**
   * Retrieve user-scoped transactions
   */
  getTransactions(userId: string): Transaction[] {
    if (!userId) return [];
    try {
      const key = getTxKey(userId);
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);

      // If demo user Ahmed Rahman, initialize with full synthetic dataset
      if (userId === 'usr-ahmed-01') {
        localStorage.setItem(key, JSON.stringify(INITIAL_TRANSACTIONS));
        return INITIAL_TRANSACTIONS;
      }

      return [];
    } catch (err) {
      console.error(`Failed reading transactions for user ${userId}:`, err);
      return userId === 'usr-ahmed-01' ? INITIAL_TRANSACTIONS : [];
    }
  },

  /**
   * Save user-scoped transactions
   */
  saveTransactions(userId: string, transactions: Transaction[]): void {
    if (!userId) return;
    try {
      const key = getTxKey(userId);
      localStorage.setItem(key, JSON.stringify(transactions));
    } catch (err) {
      console.error(`Failed saving transactions for user ${userId}:`, err);
    }
  },

  /**
   * Retrieve user-scoped savings goals
   */
  getGoals(userId: string): SavingsGoal[] {
    if (!userId) return [];
    try {
      const key = getGoalsKey(userId);
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);

      // If demo user Ahmed Rahman, initialize with full synthetic goals
      if (userId === 'usr-ahmed-01') {
        localStorage.setItem(key, JSON.stringify(INITIAL_SAVINGS_GOALS));
        return INITIAL_SAVINGS_GOALS;
      }

      return [];
    } catch (err) {
      console.error(`Failed reading goals for user ${userId}:`, err);
      return userId === 'usr-ahmed-01' ? INITIAL_SAVINGS_GOALS : [];
    }
  },

  /**
   * Save user-scoped savings goals
   */
  saveGoals(userId: string, goals: SavingsGoal[]): void {
    if (!userId) return;
    try {
      const key = getGoalsKey(userId);
      localStorage.setItem(key, JSON.stringify(goals));
    } catch (err) {
      console.error(`Failed saving goals for user ${userId}:`, err);
    }
  },

  /**
   * Reset data for a specific user only
   */
  resetUserData(userId: string): void {
    if (!userId) return;
    try {
      localStorage.removeItem(getTxKey(userId));
      localStorage.removeItem(getGoalsKey(userId));
    } catch (err) {
      console.error(`Failed resetting data for user ${userId}:`, err);
    }
  },

  /**
   * Fetch latest transactions from MongoDB backend and sync to local cache
   */
  async syncTransactionsFromBackend(userId: string): Promise<Transaction[] | null> {
    if (!userId) return null;
    try {
      const remote = await apiService.getTransactions(userId);
      if (remote && Array.isArray(remote)) {
        this.saveTransactions(userId, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[financialDataService] Backend transactions sync skipped:', err);
    }
    return null;
  },

  /**
   * Fetch latest goals from MongoDB backend and sync to local cache
   */
  async syncGoalsFromBackend(userId: string): Promise<SavingsGoal[] | null> {
    if (!userId) return null;
    try {
      const remote = await apiService.getGoals(userId);
      if (remote && Array.isArray(remote)) {
        this.saveGoals(userId, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[financialDataService] Backend goals sync skipped:', err);
    }
    return null;
  },

  /**
   * Retrieve user-scoped custom categories
   */
  getCategories(userId: string): CustomCategory[] {
    if (!userId) return [];
    try {
      const key = getCategoriesKey(userId);
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
      return [];
    } catch (err) {
      console.error(`Failed reading categories for user ${userId}:`, err);
      return [];
    }
  },

  /**
   * Save user-scoped custom categories
   */
  saveCategories(userId: string, categories: CustomCategory[]): void {
    if (!userId) return;
    try {
      const key = getCategoriesKey(userId);
      localStorage.setItem(key, JSON.stringify(categories));
    } catch (err) {
      console.error(`Failed saving categories for user ${userId}:`, err);
    }
  },

  /**
   * Fetch latest categories from MongoDB backend and sync to local cache
   */
  async syncCategoriesFromBackend(userId: string): Promise<CustomCategory[] | null> {
    if (!userId) return null;
    try {
      const remote = await apiService.getCategories(userId);
      if (remote && Array.isArray(remote)) {
        this.saveCategories(userId, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[financialDataService] Backend categories sync skipped:', err);
    }
    return null;
  },
};
