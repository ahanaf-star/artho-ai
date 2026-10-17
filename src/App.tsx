import React, { useState, useEffect } from 'react';
import { Sidebar, NavScreen } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { SpendingAnalysis } from './components/SpendingAnalysis';
import { SavingsGoals } from './components/SavingsGoals';
import { AICoach } from './components/AICoach';
import { CashFlowView } from './components/CashFlowView';
import { FinancialHealthView } from './components/FinancialHealthView';
import { InsightsAlertsView } from './components/InsightsAlertsView';
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
import { calculateFinancialHealthScore, getLocalDateString } from './services/financialCalculations';
import { Transaction, SavingsGoal, UserProfile } from './types/financial';
import { INITIAL_USER } from './data/mockUser';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<NavScreen>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [coachPreQuery, setCoachPreQuery] = useState<string | undefined>(undefined);

  // Authenticated User State - Default to Ahmed Rahman demo user so app is always interactive
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(
    () => authService.getCurrentUser() || INITIAL_USER
  );
  const [isBangla, setIsBangla] = useState<boolean>(() => {
    const user = authService.getCurrentUser() || INITIAL_USER;
    return user?.preferredLanguage === 'bn';
  });

  // User-scoped Financial State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const user = authService.getCurrentUser() || INITIAL_USER;
    return user ? financialDataService.getTransactions(user.id) : [];
  });

  const [goals, setGoals] = useState<SavingsGoal[]>(() => {
    const user = authService.getCurrentUser() || INITIAL_USER;
    return user ? financialDataService.getGoals(user.id) : [];
  });

  // Modal States
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);

  // Helper to revalidate financial data directly from MongoDB backend
  const refreshFinancialData = async (userId: string) => {
    try {
      const [backendTxs, backendGoals] = await Promise.all([
        apiService.getTransactions(userId),
        apiService.getGoals(userId),
      ]);
      if (backendTxs && Array.isArray(backendTxs)) {
        setTransactions(backendTxs);
        financialDataService.saveTransactions(userId, backendTxs);
      }
      if (backendGoals && Array.isArray(backendGoals)) {
        setGoals(backendGoals);
        financialDataService.saveGoals(userId, backendGoals);
      }
    } catch (e) {
      console.warn('[App] Failed fetching live data from backend:', e);
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
    if (session.user.preferredLanguage === 'bn') {
      setIsBangla(true);
    }
    const userTxs = financialDataService.getTransactions(session.user.id);
    const userGoals = financialDataService.getGoals(session.user.id);
    setTransactions(userTxs);
    setGoals(userGoals);
    setActiveScreen('dashboard');
    await refreshFinancialData(session.user.id);
  };

  // Sign out handler
  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setTransactions([]);
    setGoals([]);
    setActiveScreen('dashboard');
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

  // Create Goal Handler - persists to MongoDB and revalidates
  const handleCreateGoal = async (newGoal: SavingsGoal) => {
    setGoals((prev) => [...prev, newGoal]);
    if (currentUser) {
      try {
        await apiService.createGoal(currentUser.id, newGoal);
        await refreshFinancialData(currentUser.id);
      } catch (err) {
        console.error('Failed to persist new goal to backend:', err);
      }
    }
  };

  // Update Goal Handler - persists to MongoDB and revalidates
  const handleUpdateGoal = async (updatedGoal: SavingsGoal) => {
    setGoals((prev) => prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)));
    if (currentUser) {
      try {
        await apiService.updateGoal(updatedGoal.id, updatedGoal);
        await refreshFinancialData(currentUser.id);
      } catch (err) {
        console.error('Failed to persist updated goal to backend:', err);
      }
    }
  };

  // Delete Goal Handler - persists to MongoDB and revalidates
  const handleDeleteGoal = async (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    if (currentUser) {
      try {
        await apiService.deleteGoal(goalId);
        await refreshFinancialData(currentUser.id);
      } catch (err) {
        console.error('Failed to delete goal in backend:', err);
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

  // Protected Route: If not logged in, render AuthScreen
  if (!currentUser) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        isBangla={isBangla}
        onToggleBangla={setIsBangla}
      />
    );
  }

  // Calculate health metrics for current user
  const healthMetrics = calculateFinancialHealthScore(transactions, goals, currentUser.monthlyIncome);

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col">
      {/* Sidebar Navigation */}
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={(screen) => {
          setActiveScreen(screen);
          setCoachPreQuery(undefined);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Top Header */}
        <Header
          onNavigate={(screen) => {
            setActiveScreen(screen);
            setCoachPreQuery(undefined);
          }}
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
          onLogout={handleLogout}
        />

        {/* View Routing */}
        <main className="flex-1 pt-20 bg-background w-full px-4 sm:px-space-lg py-space-lg">
          {activeScreen === 'landing' && (
            <LandingPage
              onNavigate={setActiveScreen}
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
            />
          )}

          {activeScreen === 'dashboard' && (
            <Dashboard
              transactions={transactions}
              goals={goals}
              user={currentUser}
              onNavigate={setActiveScreen}
              onOpenAddTransaction={() => setIsAddTxOpen(true)}
              onOpenTransfer={() => setIsTransferOpen(true)}
              onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
              onOpenCreateGoal={() => setIsCreateGoalOpen(true)}
              isBangla={isBangla}
            />
          )}

          {activeScreen === 'spending-analysis' && (
            <SpendingAnalysis
              transactions={transactions}
              onNavigate={setActiveScreen}
              onOpenAddTransaction={() => setIsAddTxOpen(true)}
              isBangla={isBangla}
              onCoachQuery={(query) => {
                setCoachPreQuery(query);
                setActiveScreen('ai-coach');
              }}
              onSelectTransactionForEdit={(tx) => setEditingTransaction(tx)}
            />
          )}

          {activeScreen === 'savings-goals' && (
            <SavingsGoals
              goals={goals}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
              onDepositToGoal={handleDepositToGoal}
              onOpenCreateGoal={() => setIsCreateGoalOpen(true)}
              onNavigate={setActiveScreen}
              isBangla={isBangla}
            />
          )}

          {activeScreen === 'ai-coach' && (
            <AICoach
              transactions={transactions}
              goals={goals}
              monthlyIncome={currentUser.monthlyIncome}
              userName={currentUser.name}
              user={currentUser}
              initialQuery={coachPreQuery}
              onNavigate={setActiveScreen}
              isBanglaMode={isBangla}
              onToggleBangla={setIsBangla}
            />
          )}

          {activeScreen === 'cash-flow-forecast' && (
            <CashFlowView
              user={currentUser}
              transactions={transactions}
              goals={goals}
              onUpdateUser={handleUpdateUser}
              onNavigate={setActiveScreen}
              isBangla={isBangla}
            />
          )}

          {activeScreen === 'financial-health' && (
            <FinancialHealthView
              metrics={healthMetrics}
              goals={goals}
              transactions={transactions}
              user={currentUser}
              onNavigate={setActiveScreen}
              isBangla={isBangla}
            />
          )}

          {activeScreen === 'insights-alerts' && (
            <InsightsAlertsView onNavigate={setActiveScreen} isBangla={isBangla} />
          )}

          {activeScreen === 'settings-profile' && (
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
        isBangla={isBangla}
      />
      <EditTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        onDeleteTransaction={handleDeleteTransaction}
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
