import { Transaction, SavingsGoal } from '../../src/types/financial';
import { CoachContext, buildCoachContextFromData } from '../services/coachContextBuilder';

export type FixtureKey =
  | 'NEW_USER'
  | 'INCOME_AND_EXPENSES'
  | 'NEGATIVE_CASH_FLOW'
  | 'MULTIPLE_CATEGORIES'
  | 'ESSENTIAL_AND_DISCRETIONARY'
  | 'CUSTOM_CATEGORIES'
  | 'INCOMPLETE_HISTORY'
  | 'PREV_MONTH_RECORDS'
  | 'NO_PREV_MONTH'
  | 'SAVINGS_GOALS'
  | 'VARIABLE_INCOME'
  | 'TRANSFERS_ONLY_OR_MIXED'
  | 'ZERO_INCOME'
  | 'MISSING_OPTIONAL_FIELDS';

function createTx(
  partial: Partial<Transaction> & {
    id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    category: any;
    date: string;
  }
): Transaction {
  return {
    description: 'Deterministic test transaction',
    merchant: 'Standard Merchant',
    account: 'bKash',
    paymentMethod: 'bKash QR Direct',
    classification: partial.type === 'income' ? 'essential' : 'discretionary',
    ...partial,
  };
}

export function createFixtures(activeMonth: string = '2026-10'): Record<FixtureKey, CoachContext> {
  const today = `${activeMonth}-17`;

  // 1. NEW_USER: No transactions, zero balance, no goals
  const newUserContext = buildCoachContextFromData([], [], null, {
    targetMonth: activeMonth,
    today,
  });

  // 2. INCOME_AND_EXPENSES: Healthy user (Income ৳80,000, Expenses ৳50,000, Surplus ৳30,000)
  const incomeAndExpensesTxs: Transaction[] = [
    createTx({ id: 'tx-ie-1', type: 'income', amount: 80000, category: 'Salary & Professional', merchant: 'Tech Corp', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-ie-2', type: 'expense', amount: 25000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-02`, classification: 'essential' }),
    createTx({ id: 'tx-ie-3', type: 'expense', amount: 15000, category: 'Food & Groceries', merchant: 'Shwapno', date: `${activeMonth}-05`, classification: 'essential' }),
    createTx({ id: 'tx-ie-4', type: 'expense', amount: 6000, category: 'Utilities & Bills', merchant: 'DESCO', date: `${activeMonth}-08`, classification: 'essential' }),
    createTx({ id: 'tx-ie-5', type: 'expense', amount: 4000, category: 'Dining & Eating Out', merchant: 'KFC', date: `${activeMonth}-12`, classification: 'discretionary' }),
  ];
  const incomeAndExpensesContext = buildCoachContextFromData(
    incomeAndExpensesTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Main Account', balance: 45000 }] },
    { targetMonth: activeMonth, today }
  );

  // 3. NEGATIVE_CASH_FLOW: Deficit user (Income ৳40,000, Expenses ৳52,000, Deficit -৳12,000)
  const deficitTxs: Transaction[] = [
    createTx({ id: 'tx-def-1', type: 'income', amount: 40000, category: 'Salary & Professional', merchant: 'Employer', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-def-2', type: 'expense', amount: 22000, category: 'Rent & Living', merchant: 'Apartment Owner', date: `${activeMonth}-02`, classification: 'essential' }),
    createTx({ id: 'tx-def-3', type: 'expense', amount: 16000, category: 'Food & Groceries', merchant: 'Supermarket', date: `${activeMonth}-06`, classification: 'essential' }),
    createTx({ id: 'tx-def-4', type: 'expense', amount: 8000, category: 'Shopping', merchant: 'Aarong', date: `${activeMonth}-10`, classification: 'discretionary' }),
    createTx({ id: 'tx-def-5', type: 'expense', amount: 6000, category: 'Dining & Eating Out', merchant: 'Restaurant', date: `${activeMonth}-14`, classification: 'discretionary' }),
  ];
  const negativeCashFlowContext = buildCoachContextFromData(
    deficitTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Wallet', balance: 5000 }] },
    { targetMonth: activeMonth, today }
  );

  // 4. MULTIPLE_CATEGORIES: 7 distinct categories active
  const multiCatTxs: Transaction[] = [
    createTx({ id: 'tx-mc-inc', type: 'income', amount: 120000, category: 'Salary & Professional', merchant: 'Global Ltd', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-mc-1', type: 'expense', amount: 30000, category: 'Rent & Living', merchant: 'Property Mgmt', date: `${activeMonth}-02`, classification: 'essential' }),
    createTx({ id: 'tx-mc-2', type: 'expense', amount: 18000, category: 'Food & Groceries', merchant: 'Chaldal', date: `${activeMonth}-04`, classification: 'essential' }),
    createTx({ id: 'tx-mc-3', type: 'expense', amount: 7500, category: 'Utilities & Bills', merchant: 'Titas Gas', date: `${activeMonth}-07`, classification: 'essential' }),
    createTx({ id: 'tx-mc-4', type: 'expense', amount: 12000, category: 'Healthcare & Medical', merchant: 'Square Hospital', date: `${activeMonth}-09`, classification: 'essential' }),
    createTx({ id: 'tx-mc-5', type: 'expense', amount: 8000, category: 'Education & Learning', merchant: 'University', date: `${activeMonth}-11`, classification: 'essential' }),
    createTx({ id: 'tx-mc-6', type: 'expense', amount: 5000, category: 'Transportation', merchant: 'Uber Dhaka', date: `${activeMonth}-13`, classification: 'essential' }),
    createTx({ id: 'tx-mc-7', type: 'expense', amount: 4500, category: 'Entertainment & Others', merchant: 'Star Cineplex', date: `${activeMonth}-15`, classification: 'discretionary' }),
  ];
  const multipleCategoriesContext = buildCoachContextFromData(
    multiCatTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Bank', balance: 80000 }] },
    { targetMonth: activeMonth, today }
  );

  // 5. ESSENTIAL_AND_DISCRETIONARY: Clear separation between essentials (৳28k) and lifestyle discretionary (৳17k)
  const essDiscTxs: Transaction[] = [
    createTx({ id: 'tx-ed-inc', type: 'income', amount: 75000, category: 'Salary & Professional', merchant: 'Company', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-ed-1', type: 'expense', amount: 20000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-02`, classification: 'essential' }),
    createTx({ id: 'tx-ed-2', type: 'expense', amount: 5000, category: 'Healthcare & Medical', merchant: 'Labaid Pharmacy', date: `${activeMonth}-05`, classification: 'essential' }),
    createTx({ id: 'tx-ed-3', type: 'expense', amount: 3000, category: 'Utilities & Bills', merchant: 'DESCO', date: `${activeMonth}-07`, classification: 'essential' }),
    createTx({ id: 'tx-ed-4', type: 'expense', amount: 7000, category: 'Dining & Eating Out', merchant: 'Madchef', date: `${activeMonth}-09`, classification: 'discretionary' }),
    createTx({ id: 'tx-ed-5', type: 'expense', amount: 6000, category: 'Shopping', merchant: 'Daraz Online', date: `${activeMonth}-12`, classification: 'discretionary' }),
    createTx({ id: 'tx-ed-6', type: 'expense', amount: 4000, category: 'Entertainment & Others', merchant: 'Netflix & Spotify', date: `${activeMonth}-14`, classification: 'discretionary' }),
  ];
  const essentialAndDiscretionaryContext = buildCoachContextFromData(
    essDiscTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Checking', balance: 35000 }] },
    { targetMonth: activeMonth, today }
  );

  // 6. CUSTOM_CATEGORIES: User created custom category tags ('Freelance Tools', 'Pet Care', 'Home Studio')
  const customCatTxs: Transaction[] = [
    createTx({ id: 'tx-cc-inc', type: 'income', amount: 90000, category: 'Salary & Professional', merchant: 'Remote Client', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-cc-1', type: 'expense', amount: 12000, category: 'Freelance Tools' as any, merchant: 'GitHub & Figma', date: `${activeMonth}-03`, classification: 'essential' }),
    createTx({ id: 'tx-cc-2', type: 'expense', amount: 8000, category: 'Pet Care' as any, merchant: 'Pet Store Dhaka', date: `${activeMonth}-06`, classification: 'discretionary' }),
    createTx({ id: 'tx-cc-3', type: 'expense', amount: 15000, category: 'Home Studio' as any, merchant: 'Audio Gear BD', date: `${activeMonth}-10`, classification: 'discretionary' }),
    createTx({ id: 'tx-cc-4', type: 'expense', amount: 20000, category: 'Food & Groceries', merchant: 'Agora', date: `${activeMonth}-12`, classification: 'essential' }),
  ];
  const customCategoriesContext = buildCoachContextFromData(
    customCatTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Freelance Account', balance: 60000 }] },
    { targetMonth: activeMonth, today }
  );

  // 7. INCOMPLETE_HISTORY: Account created 5 days ago, only 3 transactions in current month
  const incompleteTxs: Transaction[] = [
    createTx({ id: 'tx-inc-1', type: 'income', amount: 65000, category: 'Salary & Professional', merchant: 'Employer', date: `${activeMonth}-12`, classification: 'essential' }),
    createTx({ id: 'tx-inc-2', type: 'expense', amount: 3500, category: 'Food & Groceries', merchant: 'Local Bazaar', date: `${activeMonth}-14`, classification: 'essential' }),
    createTx({ id: 'tx-inc-3', type: 'expense', amount: 1200, category: 'Transportation', merchant: 'Rickshaw & Bus', date: `${activeMonth}-16`, classification: 'essential' }),
  ];
  const incompleteHistoryContext = buildCoachContextFromData(
    incompleteTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'bKash', balance: 60300 }] },
    { targetMonth: activeMonth, today }
  );

  // 8. PREV_MONTH_RECORDS: 3 continuous months (August, September, October 2026) for mature MoM & projection
  const multiMonthTxs: Transaction[] = [
    // August 2026
    createTx({ id: 'tx-aug-inc', type: 'income', amount: 85000, category: 'Salary & Professional', merchant: 'Firm', date: '2026-08-01', classification: 'essential' }),
    createTx({ id: 'tx-aug-1', type: 'expense', amount: 48000, category: 'Rent & Living', merchant: 'Landlord', date: '2026-08-03', classification: 'essential' }),
    // September 2026
    createTx({ id: 'tx-sep-inc', type: 'income', amount: 85000, category: 'Salary & Professional', merchant: 'Firm', date: '2026-09-01', classification: 'essential' }),
    createTx({ id: 'tx-sep-1', type: 'expense', amount: 25000, category: 'Rent & Living', merchant: 'Landlord', date: '2026-09-03', classification: 'essential' }),
    createTx({ id: 'tx-sep-2', type: 'expense', amount: 18000, category: 'Food & Groceries', merchant: 'Shwapno', date: '2026-09-08', classification: 'essential' }),
    createTx({ id: 'tx-sep-3', type: 'expense', amount: 7000, category: 'Utilities & Bills', merchant: 'DESCO', date: '2026-09-14', classification: 'essential' }),
    // October 2026 (Current)
    createTx({ id: 'tx-oct-inc', type: 'income', amount: 85000, category: 'Salary & Professional', merchant: 'Firm', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-oct-1', type: 'expense', amount: 26000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-03`, classification: 'essential' }),
    createTx({ id: 'tx-oct-2', type: 'expense', amount: 19000, category: 'Food & Groceries', merchant: 'Shwapno', date: `${activeMonth}-07`, classification: 'essential' }),
    createTx({ id: 'tx-oct-3', type: 'expense', amount: 6500, category: 'Utilities & Bills', merchant: 'DESCO', date: `${activeMonth}-11`, classification: 'essential' }),
    createTx({ id: 'tx-oct-4', type: 'expense', amount: 4000, category: 'Dining & Eating Out', merchant: 'Pizza Hut', date: `${activeMonth}-15`, classification: 'discretionary' }),
  ];
  const prevMonthRecordsContext = buildCoachContextFromData(
    multiMonthTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'City Bank', balance: 95000 }] },
    { targetMonth: activeMonth, today }
  );

  // 9. NO_PREV_MONTH: Brand new user with only 1 month of transactions (no prior data)
  const noPrevMonthTxs: Transaction[] = [
    createTx({ id: 'tx-npm-inc', type: 'income', amount: 70000, category: 'Salary & Professional', merchant: 'Employer', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-npm-1', type: 'expense', amount: 22000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-03`, classification: 'essential' }),
    createTx({ id: 'tx-npm-2', type: 'expense', amount: 14000, category: 'Food & Groceries', merchant: 'Bazaar', date: `${activeMonth}-07`, classification: 'essential' }),
    createTx({ id: 'tx-npm-3', type: 'expense', amount: 4500, category: 'Utilities & Bills', merchant: 'DESCO', date: `${activeMonth}-12`, classification: 'essential' }),
  ];
  const noPrevMonthContext = buildCoachContextFromData(
    noPrevMonthTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'DBBL Account', balance: 29500 }] },
    { targetMonth: activeMonth, today }
  );

  // 10. SAVINGS_GOALS: User with active savings goals
  const goalsData: SavingsGoal[] = [
    {
      id: 'goal-emg',
      title: 'Emergency Safety Net',
      name: 'Emergency Safety Net',
      targetAmount: 100000,
      currentAmount: 45000,
      deadline: '2027-04-01',
      monthlyPace: 5000,
      accountVault: 'City Bank Savings Vault',
      status: 'On Track',
      category: 'Emergency',
      color: '#10B981',
      icon: '🛡️',
    },
    {
      id: 'goal-laptop',
      title: 'Work Laptop Upgrade',
      name: 'Work Laptop Upgrade',
      targetAmount: 80000,
      currentAmount: 20000,
      deadline: '2026-12-31',
      monthlyPace: 15000,
      accountVault: 'bKash Goal Vault',
      status: 'On Track',
      category: 'Electronics',
      color: '#3B82F6',
      icon: '💻',
    },
  ];
  const savingsGoalsContext = buildCoachContextFromData(
    incomeAndExpensesTxs,
    goalsData,
    { linkedAccounts: [{ id: 'acc-1', name: 'Primary Bank', balance: 65000 }] },
    { targetMonth: activeMonth, today }
  );

  // 11. VARIABLE_INCOME: Freelancer with irregular payment dates
  const variableIncomeTxs: Transaction[] = [
    createTx({ id: 'tx-vi-1', type: 'income', amount: 25000, category: 'Salary & Professional', merchant: 'Client Alpha', date: `${activeMonth}-03`, classification: 'essential' }),
    createTx({ id: 'tx-vi-2', type: 'expense', amount: 15000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-05`, classification: 'essential' }),
    createTx({ id: 'tx-vi-3', type: 'income', amount: 45000, category: 'Salary & Professional', merchant: 'Client Beta', date: `${activeMonth}-11`, classification: 'essential' }),
    createTx({ id: 'tx-vi-4', type: 'expense', amount: 12000, category: 'Food & Groceries', merchant: 'Shwapno', date: `${activeMonth}-13`, classification: 'essential' }),
    createTx({ id: 'tx-vi-5', type: 'income', amount: 18000, category: 'Salary & Professional', merchant: 'Client Gamma', date: `${activeMonth}-16`, classification: 'essential' }),
  ];
  const variableIncomeContext = buildCoachContextFromData(
    variableIncomeTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Freelance Wallet', balance: 61000 }] },
    { targetMonth: activeMonth, today }
  );

  // 12. TRANSFERS_ONLY_OR_MIXED: Transfers between accounts (must NOT be counted in income/expense)
  const transferTxs: Transaction[] = [
    createTx({ id: 'tx-tr-inc', type: 'income', amount: 60000, category: 'Salary & Professional', merchant: 'Company', date: `${activeMonth}-01`, classification: 'essential' }),
    createTx({ id: 'tx-tr-1', type: 'transfer', amount: 20000, category: 'Other', merchant: 'bKash Transfer', date: `${activeMonth}-04`, classification: 'essential' }),
    createTx({ id: 'tx-tr-2', type: 'expense', amount: 25000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-05`, classification: 'essential' }),
    createTx({ id: 'tx-tr-3', type: 'transfer', amount: 5000, category: 'Other', merchant: 'Bank to Nagad', date: `${activeMonth}-10`, classification: 'discretionary' }),
    createTx({ id: 'tx-tr-4', type: 'expense', amount: 10000, category: 'Food & Groceries', merchant: 'Market', date: `${activeMonth}-12`, classification: 'essential' }),
  ];
  const transfersContext = buildCoachContextFromData(
    transferTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Checking', balance: 35000 }] },
    { targetMonth: activeMonth, today }
  );

  // 13. ZERO_INCOME: Expenses recorded (৳42,000), but 0 recorded income
  const zeroIncomeTxs: Transaction[] = [
    createTx({ id: 'tx-zi-1', type: 'expense', amount: 22000, category: 'Rent & Living', merchant: 'Landlord', date: `${activeMonth}-02`, classification: 'essential' }),
    createTx({ id: 'tx-zi-2', type: 'expense', amount: 14000, category: 'Food & Groceries', merchant: 'Supermarket', date: `${activeMonth}-07`, classification: 'essential' }),
    createTx({ id: 'tx-zi-3', type: 'expense', amount: 6000, category: 'Healthcare & Medical', merchant: 'Pharma BD', date: `${activeMonth}-12`, classification: 'essential' }),
  ];
  const zeroIncomeContext = buildCoachContextFromData(
    zeroIncomeTxs,
    [],
    { linkedAccounts: [{ id: 'acc-1', name: 'Emergency Savings', balance: 75000 }] },
    { targetMonth: activeMonth, today }
  );

  // 14. MISSING_OPTIONAL_FIELDS: Empty merchant or description, untagged optional fields
  const missingFieldsTxs: Transaction[] = [
    createTx({ id: 'tx-mof-inc', type: 'income', amount: 50000, category: 'Salary & Professional', merchant: '', description: '', date: `${activeMonth}-01` }),
    createTx({ id: 'tx-mof-1', type: 'expense', amount: 18000, category: 'Rent & Living', merchant: '', description: '', date: `${activeMonth}-03` }),
    createTx({ id: 'tx-mof-2', type: 'expense', amount: 7000, category: 'Food & Groceries', merchant: '', description: '', date: `${activeMonth}-08` }),
  ];
  const missingOptionalFieldsContext = buildCoachContextFromData(
    missingFieldsTxs,
    [],
    null,
    { targetMonth: activeMonth, today }
  );

  return {
    NEW_USER: newUserContext,
    INCOME_AND_EXPENSES: incomeAndExpensesContext,
    NEGATIVE_CASH_FLOW: negativeCashFlowContext,
    MULTIPLE_CATEGORIES: multipleCategoriesContext,
    ESSENTIAL_AND_DISCRETIONARY: essentialAndDiscretionaryContext,
    CUSTOM_CATEGORIES: customCategoriesContext,
    INCOMPLETE_HISTORY: incompleteHistoryContext,
    PREV_MONTH_RECORDS: prevMonthRecordsContext,
    NO_PREV_MONTH: noPrevMonthContext,
    SAVINGS_GOALS: savingsGoalsContext,
    VARIABLE_INCOME: variableIncomeContext,
    TRANSFERS_ONLY_OR_MIXED: transfersContext,
    ZERO_INCOME: zeroIncomeContext,
    MISSING_OPTIONAL_FIELDS: missingOptionalFieldsContext,
  };
}
