/**
 * Server-side balance calculation and transaction synchronization utilities.
 * Ensures consistent account balances and Available Balance across all financial operations.
 */

export interface LinkedAccount {
  name: string;
  balance: number;
  accountNumber: string;
  type: string;
}

/**
 * Extracts source (from) and destination (to) accounts from a transfer transaction.
 */
export function extractTransferAccounts(tx: {
  account?: string;
  merchant?: string;
  description?: string;
  toAccount?: string;
}): { fromAccount: string; toAccount?: string } {
  const fromAccount = (tx.account || 'bKash').trim();
  if (tx.toAccount && typeof tx.toAccount === 'string') {
    return { fromAccount, toAccount: tx.toAccount.trim() };
  }

  // Check merchant format: "Transfer: City Bank → bKash" or "Transfer: City Bank -> bKash"
  const merchant = tx.merchant || '';
  const arrowMatch = merchant.match(/Transfer:\s*(.+?)\s*(?:→|->)\s*(.+)/i);
  if (arrowMatch && arrowMatch[2]) {
    return { fromAccount: arrowMatch[1].trim(), toAccount: arrowMatch[2].trim() };
  }

  // Check description format: "Internal wallet transfer from City Bank to bKash"
  const desc = tx.description || '';
  const descMatch = desc.match(/transfer from\s+(.+?)\s+to\s+(.+)/i);
  if (descMatch && descMatch[2]) {
    return { fromAccount: descMatch[1].trim(), toAccount: descMatch[2].trim() };
  }

  return { fromAccount };
}

/**
 * Applies or reverts a transaction against an array of linked accounts.
 * - Income increases the account balance.
 * - Expense decreases the account balance (clamped to 0).
 * - Transfer deducts from source and credits destination (total balance preserved).
 */
export function applyTransactionToAccounts(
  accounts: LinkedAccount[],
  tx: {
    type: string;
    amount: number;
    account?: string;
    merchant?: string;
    description?: string;
    toAccount?: string;
  },
  direction: 'apply' | 'revert' = 'apply'
): LinkedAccount[] {
  if (!accounts || !Array.isArray(accounts)) {
    accounts = [];
  }

  // Clone accounts to avoid mutating inputs
  const result: LinkedAccount[] = accounts.map((a) => ({
    name: a.name,
    balance: Number(a.balance) || 0,
    accountNumber: a.accountNumber || '',
    type: a.type || 'MFS',
  }));

  const amount = Number(tx.amount) || 0;
  if (amount <= 0) return result;

  const findOrCreateAccount = (name: string): LinkedAccount => {
    const cleanName = name.trim();
    const existing = result.find(
      (a) => a.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing;
    const newAcc: LinkedAccount = {
      name: cleanName,
      balance: 0,
      accountNumber: '',
      type: cleanName.toLowerCase().includes('bank') ? 'Bank Account' : 'MFS',
    };
    result.push(newAcc);
    return newAcc;
  };

  if (tx.type === 'income') {
    const acc = findOrCreateAccount(tx.account || 'bKash');
    if (direction === 'apply') {
      acc.balance = Math.round((acc.balance + amount) * 100) / 100;
    } else {
      acc.balance = Math.max(0, Math.round((acc.balance - amount) * 100) / 100);
    }
  } else if (tx.type === 'expense') {
    const acc = findOrCreateAccount(tx.account || 'bKash');
    if (direction === 'apply') {
      acc.balance = Math.max(0, Math.round((acc.balance - amount) * 100) / 100);
    } else {
      acc.balance = Math.round((acc.balance + amount) * 100) / 100;
    }
  } else if (tx.type === 'transfer') {
    const { fromAccount, toAccount } = extractTransferAccounts(tx);
    const fromAcc = findOrCreateAccount(fromAccount);

    if (toAccount && toAccount.toLowerCase() !== fromAccount.toLowerCase()) {
      const toAcc = findOrCreateAccount(toAccount);
      if (direction === 'apply') {
        fromAcc.balance = Math.max(0, Math.round((fromAcc.balance - amount) * 100) / 100);
        toAcc.balance = Math.round((toAcc.balance + amount) * 100) / 100;
      } else {
        fromAcc.balance = Math.round((fromAcc.balance + amount) * 100) / 100;
        toAcc.balance = Math.max(0, Math.round((toAcc.balance - amount) * 100) / 100);
      }
    } else {
      // General transfer / savings vault deposit out of account
      if (direction === 'apply') {
        fromAcc.balance = Math.max(0, Math.round((fromAcc.balance - amount) * 100) / 100);
      } else {
        fromAcc.balance = Math.round((fromAcc.balance + amount) * 100) / 100;
      }
    }
  }

  return result;
}

/**
 * Calculates total available balance following the project's single source of truth rules:
 * - If linkedAccounts configured: sum of account balances
 * - If accounts empty: net cumulative cash flow sum(incomes) - sum(expenses)
 */
export function calculateTotalBalance(
  accounts?: LinkedAccount[] | null,
  transactions?: Array<{ type: string; amount: number }> | null
): number {
  if (accounts && accounts.length > 0) {
    const total = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    return Math.round(total * 100) / 100;
  }
  if (transactions && transactions.length > 0) {
    const net = transactions.reduce((acc, t) => {
      if (t.type === 'income') return acc + (Number(t.amount) || 0);
      if (t.type === 'expense') return acc - (Number(t.amount) || 0);
      return acc;
    }, 0);
    return Math.max(0, Math.round(net * 100) / 100);
  }
  return 0;
}
