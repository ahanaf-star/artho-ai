import React, { useState, useEffect } from 'react';
import { Sidebar, NavScreen } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { SpendingAnalysis } from './components/SpendingAnalysis';
import { SavingsGoals } from './components/SavingsGoals';
import { AICoach } from './components/AICoach';
import { CashFlowView } from './components/CashFlowView';
import { FinancialHealthView } from './components/FinancialHealthView';
import { SettingsProfileView } from './components/SettingsProfileView';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { CreateGoalModal } from './components/modals/CreateGoalModal';
import { TransferModal } from './components/modals/TransferModal';
import { MonthlyReportModal } from './components/modals/MonthlyReportModal';
import { authService, AuthSession } from './services/authService';
import { userService } from './services/userService';
import { apiService } from './services/apiService';
import { financialDataService } from './services/financialDataService';
import { calculateFinancialHealthScore, getLocalDateString, normalizeTransactionCategory } from './services/financialCalculations';
import { Transaction, SavingsGoal, UserProfile, CustomCategory, CategoryName } from './types/financial';
import { fetchExchangeRates, getLoadedRates, ExchangeRatesState } from './services/currencyService';

const PRIVATE_SCREENS: NavScreen[] = [
  'dashboard',
  'spending-analysis',
  'savings-goals',
  'cash-flow-forecast',
  'ai-coach',
  'financial-health',
  'settings-profile',
];

function getScreenFromPathname(pathname: string): NavScreen {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  switch (clean) {
    case '':
    case 'landing':
    case 'home':
      return 'landing';
    case 'login':
    case 'signin':
      return 'login';
    case 'signup':
    case 'register':
      return 'signup';
    case 'dashboard':
      return 'dashboard';
    case 'spending-analysis':
    case 'spending':
      return 'spending-analysis';
    case 'savings-goals':
    case 'goals':
      return 'savings-goals';
    case 'cash-flow-forecast':
    case 'cashflow':
      return 'cash-flow-forecast';
    case 'ai-coach':
    case 'coach':
      return 'ai-coach';
    case 'financial-health':
    case 'health':
      return 'financial-health';
    case 'insights-alerts':
    case 'insights':
    case 'alerts':
      return 'dashboard';
    case 'settings-profile':
    case 'settings':
    case 'profile':
      return 'settings-profile';
    default:
      return 'landing';
  }
}

function getPathFromScreen(screen: NavScreen): string {
  switch (screen) {
    case 'landing':
      return '/';
    case 'login':
      return '/login';
    case 'signup':
      return '/signup';
    default:
      return `/${screen}`;
  }
}

function resolveInitialScreen(user: UserProfile | null): NavScreen {
  if (typeof window === 'undefined') return 'landing';
  const target = getScreenFromPathname(window.location.pathname);
  if (!user) {
    if (PRIVATE_SCREENS.includes(target)) {
      return 'login';
    }
    return target;
  }
  if (target === 'landing' && (window.location.pathname === '/' || window.location.pathname === '')) {
    return 'dashboard';
  }
  if (target === 'login' || target === 'signup') {
    return 'dashboard';
  }
  return target;
}

export default function App() {
  // Authenticated User State - strictly source of truth from authService (null if unauthenticated)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return authService.getCurrentUser();
  });

  const [activeScreen, setActiveScreen] = useState<NavScreen>(() => {
    const initialUser = authService.getCurrentUser();
    return resolveInitialScreen(initialUser);
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [coachPreQuery, setCoachPreQuery] = useState<string | undefined>(undefined);

  const isBangla = false;
  const setIsBangla = (_val: boolean) => {};
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesState>(() => getLoadedRates());

  useEffect(() => {
    fetchExchangeRates()
      .then((rates) => {
        setExchangeRates(rates);
      })
      .catch((err) => {
        console.warn('[App] Failed to load latest exchange rates:', err);
      });
  }, []);

  // User-scoped Financial State (empty when unauthenticated)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const user = authService.getCurrentUser();
    return user ? financialDataService.getTransactions(user.id) : [];
  });

  const [goals, setGoals] = useState<SavingsGoal[]>(() => {
    const user = authService.getCurrentUser();
    return user ? financialDataService.getGoals(user.id) : [];
  });

  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
    const user = authService.getCurrentUser();
    return user ? financialDataService.getCategories(user.id) : [];
  });

  // Authoritative dynamic update timestamp for financial overview
  const [lastFinancialUpdate, setLastFinancialUpdate] = useState<string | null>(() => {
    const user = authService.getCurrentUser();
    if (!user) return null;
    return (
      financialDataService.getLastUpdated(user.id) ||
      user.lastFinancialUpdate ||
      user.updatedAt ||
      null
    );
  });
  const [isRefreshingFinancialData, setIsRefreshingFinancialData] = useState<boolean>(false);

  // Modal States
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);

  // Navigate with URL history and strict access protection
  const navigateTo = (screen: NavScreen, userOverride?: UserProfile | null) => {
    let target = screen;
    const activeUser = userOverride !== undefined ? userOverride : currentUser;

    if (!activeUser && PRIVATE_SCREENS.includes(screen)) {
      target = 'login';
    }

    if (activeUser && (screen === 'login' || screen === 'signup')) {
      target = 'dashboard';
    }

    setActiveScreen(target);
    setCoachPreQuery(undefined);

    if (typeof window !== 'undefined') {
      const targetPath = getPathFromScreen(target);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  // Sync browser popstate (back/forward) and initial URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const expectedPath = getPathFromScreen(activeScreen);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, '', expectedPath);
    }

    const handlePopState = () => {
      const screenFromUrl = getScreenFromPathname(window.location.pathname);
      if (!currentUser && PRIVATE_SCREENS.includes(screenFromUrl)) {
        setActiveScreen('login');
        window.history.replaceState(null, '', '/login');
      } else if (currentUser && (screenFromUrl === 'login' || screenFromUrl === 'signup')) {
        setActiveScreen('dashboard');
        window.history.replaceState(null, '', '/dashboard');
      } else {
        setActiveScreen(screenFromUrl);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, activeScreen]);

  // Ensure authenticated user never remains stuck on login or signup screen
  useEffect(() => {
    if (currentUser && (activeScreen === 'login' || activeScreen === 'signup')) {
      setActiveScreen('dashboard');
      if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/signup')) {
        window.history.replaceState(null, '', '/dashboard');
      }
    }
  }, [currentUser, activeScreen]);

  // Session validation with backend token verification on mount
  useEffect(() => {
    const session = authService.getSession();
    if (session?.token) {
      apiService
        .getMe()
        .then((remoteUser) => {
          if (remoteUser) {
            setCurrentUser(remoteUser);
          } else {
            console.warn('[Auth] Remote validation failed: token rejected. Logging out.');
            authService.logout().then(() => {
              setCurrentUser(null);
              setTransactions([]);
              setGoals([]);
              navigateTo('login');
            });
          }
        })
        .catch((err) => {
          console.warn('[Auth] Remote token validation skipped due to network:', err);
        });
    }
  }, []);

  // Helper to record authoritative financial update timestamp
  const recordFinancialUpdateTimestamp = (userId: string, timestamp?: string): string => {
    const ts = timestamp || new Date().toISOString();
    financialDataService.setLastUpdated(userId, ts);
    setLastFinancialUpdate(ts);
    return ts;
  };

  // Helper to revalidate financial data directly from MongoDB backend
  const refreshFinancialData = async (userId: string) => {
    setIsRefreshingFinancialData(true);
    try {
      const [backendTxs, backendGoals, backendCats] = await Promise.all([
        apiService.getTransactions(userId),
        apiService.getGoals(userId),
        apiService.getCategories(userId),
      ]);
      if (backendTxs && Array.isArray(backendTxs)) {
        const normalizedTxs = backendTxs.map((t) => ({
          ...t,
          category: normalizeTransactionCategory(t) as CategoryName,
        }));
        setTransactions(normalizedTxs);
        financialDataService.saveTransactions(userId, normalizedTxs);
      }
      if (backendGoals && Array.isArray(backendGoals)) {
        setGoals(backendGoals);
        financialDataService.saveGoals(userId, backendGoals);
      }
      if (backendCats && Array.isArray(backendCats)) {
        setCustomCategories(backendCats);
        financialDataService.saveCategories(userId, backendCats);
      }

      // Record successful live data refresh timestamp
      const nowIso = recordFinancialUpdateTimestamp(userId);
      apiService.updateUser(userId, { lastFinancialUpdate: nowIso }).catch(() => {});
    } catch (e) {
      console.warn('[App] Failed fetching live data from backend:', e);
    } finally {
      setIsRefreshingFinancialData(false);
    }
  };

  // Revalidate from MongoDB on mount and when currentUser changes
  useEffect(() => {
    if (currentUser?.id) {
      refreshFinancialData(currentUser.id);
    }
  }, [currentUser?.id]);

  // When user signs in or changes, reload user-specific data
  const handleAuthenticated = async (session: AuthSession) => {
    setCurrentUser(session.user);
    const userTxs = financialDataService.getTransactions(session.user.id).map((t) => ({
      ...t,
      category: normalizeTransactionCategory(t) as CategoryName,
    }));
    const userGoals = financialDataService.getGoals(session.user.id);
    const userCats = financialDataService.getCategories(session.user.id);
    setTransactions(userTxs);
    setGoals(userGoals);
    setCustomCategories(userCats);

    const savedTs =
      financialDataService.getLastUpdated(session.user.id) ||
      session.user.lastFinancialUpdate ||
      session.user.updatedAt ||
      null;
    setLastFinancialUpdate(savedTs);

    navigateTo('dashboard', session.user);
    await refreshFinancialData(session.user.id);
  };

  // Sign out handler
  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setTransactions([]);
    setGoals([]);
    setCustomCategories([]);
    setLastFinancialUpdate(null);
    navigateTo('landing', null);
  };

  // Sync transactions to user-scoped storage fallback
  useEffect(() => {
    if (currentUser?.id && transactions.length > 0) {
      financialDataService.saveTransactions(currentUser.id, transactions);
    }
  }, [transactions, currentUser?.id]);

  // Sync goals to user-scoped storage fallback
  useEffect(() => {
    if (currentUser?.id && goals.length > 0) {
      financialDataService.saveGoals(currentUser.id, goals);
    }
  }, [goals, currentUser?.id]);

  // Update User Profile Handler
  const handleUpdateUser = async (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    try {
      await userService.updateProfile(updatedUser);
    } catch (e) {
      console.error('Failed saving profile update:', e);
    }
  };

  // Add Transaction Handler - persists to MongoDB and revalidates
  const handleAddTransaction = async (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);

    // Adjust user account balance
    if (currentUser) {
      const updatedAccounts = currentUser.linkedAccounts.map((acc) => {
        if (acc.name === newTx.account) {
          const newBal =
            newTx.type === 'income' ? acc.balance + newTx.amount : acc.balance - newTx.amount;
          return { ...acc, balance: Math.max(0, newBal) };
        }
        return acc;
      });
      const updatedUser = { ...currentUser, linkedAccounts: updatedAccounts };
      handleUpdateUser(updatedUser);

      try {
        await apiService.createTransaction(currentUser.id, newTx);
        await refreshFinancialData(currentUser.id);
      } catch (err) {
        console.error('Failed to persist transaction to backend:', err);
        await refreshFinancialData(currentUser.id);
      }
    }
  };

  // Update Transaction Handler - persists to MongoDB, adjusts account balance delta, revalidates
  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    if (!currentUser) return;
    const oldTx = transactions.find((t) => t.id === updatedTx.id);

    // Optimistically update transactions
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));

    // Adjust user account balance based on delta
    if (oldTx) {
      const updatedAccounts = currentUser.linkedAccounts.map((acc) => {
        let bal = acc.balance;
        // Reverse old transaction impact
        if (acc.name === oldTx.account) {
          bal = oldTx.type === 'income' ? bal - oldTx.amount : bal + oldTx.amount;
        }
        // Apply new transaction impact
        if (acc.name === updatedTx.account) {
          bal = updatedTx.type === 'income' ? bal + updatedTx.amount : bal - updatedTx.amount;
        }
        return { ...acc, balance: Math.max(0, bal) };
      });
      const updatedUser = { ...currentUser, linkedAccounts: updatedAccounts };
      handleUpdateUser(updatedUser);
    }

    try {
      await apiService.updateTransaction(currentUser.id, updatedTx.id, updatedTx);
      await refreshFinancialData(currentUser.id);
    } catch (err) {
      console.error('Failed to persist transaction update to backend:', err);
      await refreshFinancialData(currentUser.id);
      throw err;
    }
  };

  // Delete Transaction Handler - persists to MongoDB, restores account balance, revalidates
  const handleDeleteTransaction = async (txId: string) => {
    if (!currentUser) return;
    const oldTx = transactions.find((t) => t.id === txId);

    // Optimistically remove
    setTransactions((prev) => prev.filter((t) => t.id !== txId));

    // Restore user account balance
    if (oldTx) {
      const updatedAccounts = currentUser.linkedAccounts.map((acc) => {
        if (acc.name === oldTx.account) {
          const restoredBal =
            oldTx.type === 'income' ? acc.balance - oldTx.amount : acc.balance + oldTx.amount;
          return { ...acc, balance: Math.max(0, restoredBal) };
        }
        return acc;
      });
      const updatedUser = { ...currentUser, linkedAccounts: updatedAccounts };
      handleUpdateUser(updatedUser);
    }

    try {
      await apiService.deleteTransaction(currentUser.id, txId);
      await refreshFinancialData(currentUser.id);
    } catch (err) {
      console.error('Failed to delete transaction from backend:', err);
      await refreshFinancialData(currentUser.id);
      throw err;
    }
  };

  // Create Goal Handler - persists to MongoDB and local cache
  const handleCreateGoal = async (newGoal: SavingsGoal) => {
    const stableId = newGoal.id || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const stableGoal: SavingsGoal = {
      ...newGoal,
      id: stableId,
    };

    setGoals((prev) => {
      const filtered = prev.filter((g) => (g.id || (g as any).customId || (g as any)._id) !== stableId);
      const updated = [...filtered, stableGoal];
      if (currentUser) {
        financialDataService.saveGoals(currentUser.id, updated);
      }
      return updated;
    });

    if (currentUser) {
      try {
        const created = await apiService.createGoal(currentUser.id, stableGoal);
        if (created && created.id) {
          const finalId = created.id;
          setGoals((prev) => {
            const updated = prev.map((g) => (g.id === stableId ? { ...g, ...created, id: finalId } : g));
            financialDataService.saveGoals(currentUser.id, updated);
            return updated;
          });
        }
      } catch (err) {
        console.error('Failed to persist new goal to backend:', err);
      }
    }
  };

  // Update Goal Handler - persists to MongoDB and local cache
  const handleUpdateGoal = async (updatedGoal: SavingsGoal) => {
    const targetId = String(updatedGoal.id || (updatedGoal as any).customId || (updatedGoal as any)._id || '').trim();
    if (!targetId) return;

    setGoals((prev) => {
      const updated = prev.map((g) => {
        const gid = String(g.id || (g as any).customId || (g as any)._id || '').trim();
        return gid === targetId ? { ...g, ...updatedGoal, id: targetId } : g;
      });
      if (currentUser) {
        financialDataService.saveGoals(currentUser.id, updated);
      }
      return updated;
    });

    if (currentUser) {
      try {
        await apiService.updateGoal(targetId, updatedGoal);
      } catch (err) {
        console.error('Failed to persist updated goal to backend:', err);
      }
    }
  };

  // Delete Goal Handler - persists to MongoDB and revalidates
  const handleDeleteGoal = async (goalId: string): Promise<void> => {
    if (!currentUser || !goalId || typeof goalId !== 'string') {
      console.warn('[App] handleDeleteGoal aborted: invalid goalId', goalId);
      return;
    }

    const targetId = String(goalId).trim();
    if (!targetId) return;

    const previousGoals = goals;

    // Optimistically remove ONLY the single goal matching targetId
    const updatedGoals = previousGoals.filter((g: any) => {
      const gid = String(g.id || g.customId || g._id || '').trim();
      return gid !== targetId;
    });

    // Defensive check: NEVER clear all goals if previousGoals had > 1 goals and updatedGoals became 0
    if (previousGoals.length > 1 && updatedGoals.length === 0) {
      console.error('[App] Prevented catastrophic deletion: filter matched all goals', { targetId, previousGoals });
      return;
    }

    setGoals(updatedGoals);
    financialDataService.saveGoals(currentUser.id, updatedGoals);

    // If primary goal was deleted, clear it locally
    if (currentUser.primaryGoalId === targetId) {
      const updatedUser = { ...currentUser, primaryGoalId: undefined };
      setCurrentUser(updatedUser);
      authService.updateProfile({ primaryGoalId: undefined }).catch(() => {});
    }

    try {
      await apiService.deleteGoal(targetId, currentUser.id);
    } catch (err: any) {
      console.warn('[App] Backend deleteGoal warning:', err);
      // Rollback only on fatal network error
      if (err?.message && !err.message.includes('404') && !err.message.includes('not found')) {
        setGoals(previousGoals);
        financialDataService.saveGoals(currentUser.id, previousGoals);
        throw err;
      }
    }
  };

  // Deposit directly to Goal Handler (moves money into savings vault)
  const handleDepositToGoal = async (goalId: string, amount: number) => {
    let targetGoalTitle = '';
    const targetGoal = goals.find((g) => g.id === goalId);
    if (targetGoal) {
      targetGoalTitle = targetGoal.title;
    }
    const updatedAmount = targetGoal ? Math.min(targetGoal.targetAmount, targetGoal.currentAmount + amount) : amount;

    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          return {
            ...g,
            currentAmount: updatedAmount,
          };
        }
        return g;
      })
    );

    // Deduct from bKash (primary liquid savings account)
    if (currentUser) {
      const updatedAccounts = currentUser.linkedAccounts.map((acc) => {
        if (acc.name === 'bKash') {
          return { ...acc, balance: Math.max(0, acc.balance - amount) };
        }
        return acc;
      });
      const updatedUser = { ...currentUser, linkedAccounts: updatedAccounts };
      handleUpdateUser(updatedUser);
    }

    // Record internal transfer transaction
    const depositTx: Transaction = {
      id: `tx-deposit-${Date.now()}`,
      date: getLocalDateString(),
      type: 'transfer',
      category: 'Savings & Investment',
      amount,
      merchant: `Vault Deposit: ${targetGoalTitle || 'Savings Goal'}`,
      description: `Automated deposit into ${targetGoalTitle || 'Savings Goal'}`,
      account: 'bKash',
      paymentMethod: 'bKash Liquid Sweep',
      classification: 'essential',
      location: 'Dhaka',
    };
    setTransactions((prev) => [depositTx, ...prev]);

    if (currentUser) {
      try {
        await Promise.all([
          apiService.updateGoal(goalId, { currentAmount: updatedAmount }),
          apiService.createTransaction(currentUser.id, depositTx),
        ]);
        await refreshFinancialData(currentUser.id);
      } catch (err) {
        console.error('Failed to persist deposit to backend:', err);
      }
    }
  };

  // Transfer Funds Handler
  const handleTransfer = async (from: string, to: string, amount: number) => {
    if (currentUser) {
      const updatedAccounts = currentUser.linkedAccounts.map((acc) => {
        if (acc.name === from) return { ...acc, balance: Math.max(0, acc.balance - amount) };
        if (acc.name === to) return { ...acc, balance: acc.balance + amount };
        return acc;
      });
      const updatedUser = { ...currentUser, linkedAccounts: updatedAccounts };
      handleUpdateUser(updatedUser);
    }

    const transferTx: Transaction = {
      id: `tx-transfer-${Date.now()}`,
      date: getLocalDateString(),
      type: 'transfer',
      category: 'Utility & Fixed Costs',
      amount,
      merchant: `Transfer: ${from} → ${to}`,
      description: `Internal wallet transfer from ${from} to ${to}`,
      account: from as any,
      paymentMethod: 'NPSB Auto-sweep',
      classification: 'essential',
      location: 'Dhaka',
    };
    setTransactions((prev) => [transferTx, ...prev]);

    if (currentUser) {
      try {
        await apiService.createTransaction(currentUser.id, transferTx);
        await refreshFinancialData(currentUser.id);
      } catch (err) {
        console.error('Failed to persist transfer to backend:', err);
      }
    }
  };

  // Reset to default starter dataset for active user
  const handleResetData = () => {
    if (currentUser) {
      financialDataService.resetUserData(currentUser.id);
      const reloadedTxs = financialDataService.getTransactions(currentUser.id);
      const reloadedGoals = financialDataService.getGoals(currentUser.id);
      setTransactions(reloadedTxs);
      setGoals(reloadedGoals);
      setActiveScreen('dashboard');
    }
  };

  // Custom Category Handlers
  const handleCreateCategory = async (name: string): Promise<CustomCategory | null> => {
    if (!currentUser) return null;
    try {
      const created = await apiService.createCategory(currentUser.id, { name, type: 'expense' });
      setCustomCategories((prev) => {
        const next = [...prev.filter((c) => c.id !== created.id), created];
        financialDataService.saveCategories(currentUser.id, next);
        return next;
      });
      return created;
    } catch (err: any) {
      console.error('Failed to create category:', err);
      throw err;
    }
  };

  const handleDeleteCategory = async (catId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      await apiService.deleteCategory(currentUser.id, catId);
      setCustomCategories((prev) => {
        const next = prev.filter((c) => c.id !== catId && c.customId !== catId);
        financialDataService.saveCategories(currentUser.id, next);
        return next;
      });
      return true;
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      throw err;
    }
  };

  // Protected Route Check: Unauthenticated visitors can only view Landing, Login, or Signup
  if (!currentUser) {
    if (activeScreen === 'login' || activeScreen === 'signup') {
      return (
        <AuthScreen
          initialMode={activeScreen === 'signup' ? 'signup' : 'login'}
          onAuthenticated={handleAuthenticated}
          isBangla={isBangla}
          onToggleBangla={setIsBangla}
          onNavigateHome={() => navigateTo('landing')}
          onModeChange={(m) => navigateTo(m)}
        />
      );
    }

    // Default public view for unauthenticated visitors is the Landing Page
    return (
      <div className="min-h-screen bg-background font-body-md text-on-surface antialiased p-4 sm:p-space-lg max-w-7xl mx-auto">
        <LandingPage
          onNavigate={navigateTo}
          isBangla={isBangla}
          onToggleBangla={setIsBangla}
          isAuthenticated={false}
          onOpenLogin={() => navigateTo('login')}
          onOpenSignup={() => navigateTo('signup')}
        />
      </div>
    );
  }

  // Calculate health metrics for current user
  const healthMetrics = calculateFinancialHealthScore(
    transactions,
    goals,
    currentUser.monthlyIncome,
    undefined,
    currentUser.monthlyIncomeCurrency
  );

  // Authenticated user view routing: never render blank if screen is login/signup or unrecognized
  const resolvedScreen: NavScreen =
    activeScreen === 'login' || activeScreen === 'signup' ? 'dashboard' : activeScreen;

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col">
      {/* Sidebar Navigation */}
      <Sidebar
        activeScreen={resolvedScreen}
        onNavigate={(screen) => navigateTo(screen)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className={`lg:pl-72 flex flex-col min-h-screen ${isMonthlyReportOpen ? 'print:hidden print-hide-background' : ''}`}>
        {/* Top Header */}
        <Header
          onNavigate={(screen) => navigateTo(screen)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isBangla={isBangla}
          onToggleBangla={(bangla) => {
            setIsBangla(bangla);
            handleUpdateUser({
              ...currentUser,
              preferredLanguage: bangla ? 'bn' : 'en',
            });
          }}
          transactions={transactions}
          goals={goals}
          user={currentUser}
          onCurrencyChange={(newCurrency) => {
            handleUpdateUser({
              ...currentUser,
              currency: newCurrency,
            });
          }}
          exchangeRateTimestamp={exchangeRates.lastUpdated}
          onLogout={handleLogout}
        />

        {/* View Routing */}
        <main className="flex-1 pt-20 bg-background w-full px-4 sm:px-space-lg py-space-lg">
          {resolvedScreen === 'landing' && (
            <LandingPage
              onNavigate={navigateTo}
              isBangla={isBangla}
              onToggleBangla={(bangla) => {
                setIsBangla(bangla);
                if (currentUser) {
                  handleUpdateUser({
                    ...currentUser,
                    preferredLanguage: bangla ? 'bn' : 'en',
                  });
                }
              }}
              isAuthenticated={true}
              onOpenLogin={() => navigateTo('login')}
              onOpenSignup={() => navigateTo('signup')}
            />
          )}

          {(resolvedScreen === 'dashboard' ||
            (!['landing', 'spending-analysis', 'savings-goals', 'ai-coach', 'cash-flow-forecast', 'financial-health', 'settings-profile'].includes(resolvedScreen))) && (
            <Dashboard
              transactions={transactions}
              goals={goals}
              user={currentUser}
              onNavigate={navigateTo}
              onOpenAddTransaction={() => setIsAddTxOpen(true)}
              onOpenTransfer={() => setIsTransferOpen(true)}
              onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
              onOpenCreateGoal={() => setIsCreateGoalOpen(true)}
              isBangla={isBangla}
              lastUpdated={lastFinancialUpdate}
              onRefreshData={() => {
                if (currentUser?.id) {
                  return refreshFinancialData(currentUser.id);
                }
              }}
              isRefreshing={isRefreshingFinancialData}
            />
          )}

          {resolvedScreen === 'spending-analysis' && (
            <SpendingAnalysis
              user={currentUser}
              transactions={transactions}
              onNavigate={navigateTo}
              onOpenAddTransaction={() => setIsAddTxOpen(true)}
              isBangla={isBangla}
              onCoachQuery={(query) => {
                setCoachPreQuery(query);
                navigateTo('ai-coach');
              }}
              onSelectTransactionForEdit={(tx) => setEditingTransaction(tx)}
              customCategories={customCategories}
              onCreateCategory={handleCreateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {resolvedScreen === 'savings-goals' && (
            <SavingsGoals
              user={currentUser}
              goals={goals}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
              onDepositToGoal={handleDepositToGoal}
              onOpenCreateGoal={() => setIsCreateGoalOpen(true)}
              onNavigate={navigateTo}
              isBangla={isBangla}
            />
          )}

          {resolvedScreen === 'ai-coach' && (
            <AICoach
              transactions={transactions}
              goals={goals}
              monthlyIncome={currentUser.monthlyIncome}
              userName={currentUser.name}
              user={currentUser}
              initialQuery={coachPreQuery}
              onNavigate={navigateTo}
              isBanglaMode={isBangla}
              onToggleBangla={setIsBangla}
            />
          )}

          {resolvedScreen === 'cash-flow-forecast' && (
            <CashFlowView
              user={currentUser}
              transactions={transactions}
              goals={goals}
              onUpdateUser={handleUpdateUser}
              onNavigate={navigateTo}
              isBangla={isBangla}
            />
          )}

          {resolvedScreen === 'financial-health' && (
            <FinancialHealthView
              metrics={healthMetrics}
              goals={goals}
              transactions={transactions}
              user={currentUser}
              onNavigate={navigateTo}
              isBangla={isBangla}
            />
          )}

          {resolvedScreen === 'settings-profile' && (
            <SettingsProfileView
              user={currentUser}
              transactions={transactions}
              goals={goals}
              onUpdateUser={handleUpdateUser}
              onResetData={handleResetData}
              onLogout={handleLogout}
              isBangla={isBangla}
              onToggleBangla={setIsBangla}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        onAddTransaction={handleAddTransaction}
        customCategories={customCategories}
        onCreateCategory={handleCreateCategory}
        isBangla={isBangla}
      />
      <EditTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        customCategories={customCategories}
        isBangla={isBangla}
      />
      <CreateGoalModal
        isOpen={isCreateGoalOpen}
        onClose={() => setIsCreateGoalOpen(false)}
        onCreateGoal={handleCreateGoal}
      />
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        user={currentUser}
        onTransfer={handleTransfer}
      />
      <MonthlyReportModal
        isOpen={isMonthlyReportOpen}
        onClose={() => setIsMonthlyReportOpen(false)}
        transactions={transactions}
        goals={goals}
        user={currentUser}
      />
    </div>
  );
}
