import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TransactionModel } from '../models/Transaction';
import { isDbConnected } from '../config/database';
import { INITIAL_TRANSACTIONS } from '../../src/data/mockTransactions';

/**
 * Normalizes transaction category to maintain schema consistency and eliminate misclassifications
 */
export function normalizeServerCategory(tx: {
  type?: string;
  category?: string;
  merchant?: string;
  description?: string;
}): string {
  const cat = (tx.category || '').trim();
  const type = tx.type;
  const m = (tx.merchant || '').toLowerCase();
  const d = (tx.description || '').toLowerCase();

  if (type === 'expense') {
    // If an expense was saved under an income category
    if (cat === 'Salary & Inflow' || cat === 'Savings & Investment') {
      if (
        m.includes('food') ||
        m.includes('restaurant') ||
        m.includes('dine') ||
        m.includes('grocery') ||
        m.includes('bazar') ||
        m.includes('shawarma') ||
        m.includes('cafe') ||
        d.includes('food') ||
        d.includes('restaurant') ||
        d.includes('grocery')
      ) {
        return 'Food & Groceries';
      }
      if (
        m.includes('shop') ||
        m.includes('daraz') ||
        m.includes('gadget') ||
        m.includes('cloth') ||
        m.includes('star tech')
      ) {
        return 'Shopping & Gadgets';
      }
      if (
        m.includes('uber') ||
        m.includes('pathao') ||
        m.includes('cng') ||
        m.includes('fuel') ||
        m.includes('bus')
      ) {
        return 'Transportation';
      }
      if (
        m.includes('fee') ||
        m.includes('charge') ||
        m.includes('bkash') ||
        m.includes('cash-out') ||
        m.includes('cashout')
      ) {
        return 'Cash-out & Bank Fees';
      }
      if (m.includes('util') || m.includes('electric') || m.includes('bill') || m.includes('wifi')) {
        return 'Utility & Fixed Costs';
      }
      return 'Food & Groceries';
    }

    const lower = cat.toLowerCase();
    if (lower === 'food' || lower === 'groceries' || lower === 'food & grocery') {
      return 'Food & Groceries';
    }
    if (lower === 'shopping' || lower === 'gadgets') {
      return 'Shopping & Gadgets';
    }
    if (lower === 'utilities' || lower === 'utility' || lower === 'bills') {
      return 'Utility & Fixed Costs';
    }
    if (lower === 'transport' || lower === 'commute') {
      return 'Transportation';
    }
    if (lower === 'fees' || lower === 'cashout' || lower === 'cash-out' || lower === 'bank fees') {
      return 'Cash-out & Bank Fees';
    }
    if (lower === 'entertainment' || lower === 'others') {
      return 'Entertainment & Others';
    }

    return cat || 'Food & Groceries';
  }

  if (type === 'income') {
    const standardExpenses = [
      'Food & Groceries',
      'Shopping & Gadgets',
      'Utility & Fixed Costs',
      'Transportation',
      'Cash-out & Bank Fees',
      'Entertainment & Others',
    ];
    if (standardExpenses.includes(cat)) {
      return 'Salary & Inflow';
    }

    const lower = cat.toLowerCase();
    if (
      lower === 'salary' ||
      lower === 'inflow' ||
      lower === 'income' ||
      lower === 'paycheck' ||
      lower === 'remittance'
    ) {
      return 'Salary & Inflow';
    }
    if (
      lower === 'savings' ||
      lower === 'investment' ||
      lower === 'dividend' ||
      lower === 'interest' ||
      lower === 'yield'
    ) {
      return 'Savings & Investment';
    }

    return cat || 'Salary & Inflow';
  }

  return cat;
}

/**
 * GET /api/users/:userId/transactions
 * Retrieve all transactions for a user
 */
export async function getTransactions(req: Request, res: Response) {
  const { userId } = req.params;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === userId ||
      authUser.id === userId ||
      authUser._id?.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot access another user's transactions" });
    }
  } else if (userId !== 'usr-ahmed-01') {
    return res.status(401).json({ error: 'Authentication required to view transactions' });
  }

  if (!isDbConnected()) {
    if (userId === 'usr-ahmed-01') {
      const mapped = INITIAL_TRANSACTIONS.map((tx) => ({
        ...tx,
        category: normalizeServerCategory(tx),
      }));
      return res.json(mapped);
    }
    return res.status(503).json({
      error: 'Database is currently offline. Running in standalone fallback mode.',
    });
  }

  try {
    let transactions = await TransactionModel.find({ userId }).sort({ date: -1, createdAt: -1 });

    // Auto-seed initial transactions if demo user has no records in MongoDB
    if (transactions.length === 0 && userId === 'usr-ahmed-01') {
      const seedData = INITIAL_TRANSACTIONS.map((tx) => ({
        customId: tx.id,
        userId: 'usr-ahmed-01',
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        date: tx.date,
        merchant: tx.merchant,
        account: tx.account,
        paymentMethod: tx.paymentMethod,
        classification: tx.classification,
        isRecurring: tx.isRecurring ?? false,
        fee: tx.fee ?? 0,
        location: tx.location ?? 'Dhaka',
      }));

      await TransactionModel.insertMany(seedData);
      transactions = await TransactionModel.find({ userId }).sort({ date: -1, createdAt: -1 });
    }

    const normalized = transactions.map((t) => {
      const doc = t.toJSON ? t.toJSON() : (t.toObject ? t.toObject() : { ...t });
      return {
        ...doc,
        id: doc.customId || doc.id || doc._id?.toString(),
        category: normalizeServerCategory(doc),
      };
    });

    return res.json(normalized);
  } catch (error: any) {
    console.error('Error fetching transactions:', error.message);
    return res.status(500).json({ error: 'Internal server error fetching transactions' });
  }
}

/**
 * POST /api/users/:userId/transactions
 * Create a new transaction for a user
 */
export async function createTransaction(req: Request, res: Response) {
  const authUser = (req as any).user;
  const authUserId = (req as any).userId || authUser?.customId || authUser?._id?.toString() || authUser?.id;
  const urlUserId = req.params.userId;
  const targetUserId = authUserId || urlUserId;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  if (authUser && urlUserId) {
    const isOwner =
      authUser.customId === urlUserId ||
      authUser.id === urlUserId ||
      authUser._id?.toString() === urlUserId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot record transactions for another user" });
    }
  } else if (!authUser && targetUserId !== 'usr-ahmed-01') {
    return res.status(401).json({ error: 'Authentication required to create transactions' });
  }

  const {
    id,
    type,
    amount,
    category,
    description,
    date,
    merchant,
    account,
    paymentMethod,
    classification,
    fee,
    location,
    isRecurring,
  } = req.body;

  // Validate amount
  const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number greater than zero' });
  }

  // Validate type
  if (!type || !['expense', 'income', 'transfer'].includes(type)) {
    return res.status(400).json({ error: 'Transaction type must be expense, income, or transfer' });
  }

  // Validate category & description
  if (!category || typeof category !== 'string' || !category.trim()) {
    return res.status(400).json({ error: 'Category is required' });
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  // Validate merchant: required for expense, optional for income / transfer
  const trimmedMerchant = typeof merchant === 'string' ? merchant.trim() : '';
  if (type === 'expense' && !trimmedMerchant) {
    return res.status(400).json({ error: 'Merchant / Counterparty is required for expense transactions' });
  }

  const rawCategory = category.trim();
  const normalizedCategory = normalizeServerCategory({
    type,
    category: rawCategory,
    merchant: trimmedMerchant,
    description: description.trim(),
  });

  const incomeCategories = ['Salary & Inflow', 'Savings & Investment'];
  if (type === 'expense' && incomeCategories.includes(rawCategory) && incomeCategories.includes(normalizedCategory)) {
    return res.status(400).json({ error: 'Income categories cannot be used for expense transactions' });
  }

  const standardExpenseCategories = [
    'Food & Groceries',
    'Shopping & Gadgets',
    'Utility & Fixed Costs',
    'Transportation',
    'Cash-out & Bank Fees',
    'Entertainment & Others',
  ];
  if (type === 'income' && standardExpenseCategories.includes(rawCategory)) {
    return res.status(400).json({ error: 'Expense categories cannot be used for income transactions' });
  }

  // Validate date format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const txDate = date || new Date().toISOString().split('T')[0];
  if (!dateRegex.test(txDate)) {
    return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
  }

  if (!isDbConnected()) {
    // If DB is offline, return mock created transaction with ID
    const fallbackTx = {
      id: id || `tx-${Date.now()}`,
      userId: targetUserId,
      type,
      amount: parsedAmount,
      category: normalizedCategory,
      description: description.trim(),
      date: txDate,
      merchant: trimmedMerchant,
      account: account || 'bKash',
      paymentMethod: paymentMethod || 'Direct Payment',
      classification: classification || 'essential',
      fee: fee ? Number(fee) : 0,
      location: location || 'Dhaka',
      isRecurring: Boolean(isRecurring),
      createdAt: new Date().toISOString(),
    };
    return res.status(201).json(fallbackTx);
  }

  try {
    const newTx = await TransactionModel.create({
      customId: id || `tx-${Date.now()}`,
      userId: targetUserId,
      type,
      amount: parsedAmount,
      category: normalizedCategory,
      description: description.trim(),
      date: txDate,
      merchant: trimmedMerchant,
      account: account || 'bKash',
      paymentMethod: paymentMethod || 'Direct Payment',
      classification: classification || 'essential',
      fee: fee ? Number(fee) : 0,
      location: location || 'Dhaka',
      isRecurring: Boolean(isRecurring),
    });

    const ret = newTx.toJSON ? newTx.toJSON() : newTx;
    return res.status(201).json(ret);
  } catch (error: any) {
    console.error('Error creating transaction:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error creating transaction' });
  }
}

/**
 * PUT /api/users/:userId/transactions/:txId or PUT /api/transactions/:id
 * Update an existing transaction
 */
export async function updateTransaction(req: Request, res: Response) {
  const txId = req.params.txId || req.params.id;
  const updates = req.body;

  if (!txId || typeof txId !== 'string') {
    return res.status(400).json({ error: 'Valid transaction ID is required' });
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Update payload must be an object' });
  }

  delete updates._id;
  delete updates.userId;
  delete updates.createdAt;
  delete updates.customId;

  // Validate editable fields if present
  if (updates.amount !== undefined) {
    const parsedAmount = typeof updates.amount === 'number' ? updates.amount : parseFloat(updates.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number greater than zero' });
    }
    updates.amount = parsedAmount;
  }

  if (updates.type !== undefined && !['expense', 'income', 'transfer'].includes(updates.type)) {
    return res.status(400).json({ error: 'Transaction type must be expense, income, or transfer' });
  }

  if (updates.merchant !== undefined) {
    if (typeof updates.merchant !== 'string') {
      return res.status(400).json({ error: 'Merchant must be a string' });
    }
    updates.merchant = updates.merchant.trim();
  }

  if (updates.category !== undefined) {
    if (typeof updates.category !== 'string' || !updates.category.trim()) {
      return res.status(400).json({ error: 'Category cannot be empty' });
    }
    updates.category = updates.category.trim();
  }

  if (updates.description !== undefined) {
    if (typeof updates.description !== 'string' || !updates.description.trim()) {
      return res.status(400).json({ error: 'Description cannot be empty' });
    }
    updates.description = updates.description.trim();
  }

  if (updates.date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(updates.date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }
  }

  if (updates.classification !== undefined) {
    if (!['essential', 'discretionary', 'anomalies'].includes(updates.classification)) {
      return res.status(400).json({ error: 'Classification must be essential, discretionary, or anomalies' });
    }
  }

  const authUser = (req as any).user;

  if (!isDbConnected()) {
    if (updates.type === 'expense' && updates.merchant !== undefined && !updates.merchant) {
      return res.status(400).json({ error: 'Merchant / Counterparty is required for expense transactions' });
    }
    return res.json({
      ...updates,
      id: txId,
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(txId);
    const query = {
      $or: [
        ...(isObjectId ? [{ _id: txId }] : []),
        { customId: txId },
      ],
    };

    const existingTx = await TransactionModel.findOne(query);
    if (!existingTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const urlUserId = req.params.userId;
    if (urlUserId && authUser) {
      const isOwnerOfUrl =
        authUser.customId === urlUserId ||
        authUser.id === urlUserId ||
        authUser._id?.toString() === urlUserId;
      if (!isOwnerOfUrl) {
        return res.status(403).json({ error: "Access forbidden: You cannot modify another user's transaction" });
      }
    }

    if (authUser) {
      const isOwner =
        authUser.customId === existingTx.userId ||
        authUser.id === existingTx.userId ||
        authUser._id?.toString() === existingTx.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Access forbidden: You cannot modify another user's transaction" });
      }
    } else if (existingTx.userId !== 'usr-ahmed-01') {
      return res.status(401).json({ error: 'Authentication required to update this transaction' });
    }

    // Validate conditional merchant requirement for expense transactions
    const effectiveType = updates.type !== undefined ? updates.type : existingTx.type;
    const effectiveCat = updates.category !== undefined ? updates.category.trim() : existingTx.category;
    const effectiveMerchant =
      updates.merchant !== undefined
        ? updates.merchant
        : (existingTx.merchant || '').trim();
    const effectiveDesc =
      updates.description !== undefined
        ? updates.description
        : (existingTx.description || '').trim();

    if (effectiveType === 'expense' && !effectiveMerchant) {
      return res.status(400).json({ error: 'Merchant / Counterparty is required for expense transactions' });
    }

    const normalizedCategory = normalizeServerCategory({
      type: effectiveType,
      category: effectiveCat,
      merchant: effectiveMerchant,
      description: effectiveDesc,
    });

    const incomeCategories = ['Salary & Inflow', 'Savings & Investment'];
    if (
      effectiveType === 'expense' &&
      incomeCategories.includes(effectiveCat) &&
      incomeCategories.includes(normalizedCategory)
    ) {
      return res.status(400).json({ error: 'Income categories cannot be used for expense transactions' });
    }

    const standardExpenseCategories = [
      'Food & Groceries',
      'Shopping & Gadgets',
      'Utility & Fixed Costs',
      'Transportation',
      'Cash-out & Bank Fees',
      'Entertainment & Others',
    ];
    if (effectiveType === 'income' && standardExpenseCategories.includes(effectiveCat)) {
      return res.status(400).json({ error: 'Expense categories cannot be used for income transactions' });
    }

    if (updates.category !== undefined) {
      updates.category = normalizedCategory;
    }

    Object.assign(existingTx, updates);
    const updatedTx = await existingTx.save();
    const retObj = updatedTx.toJSON ? updatedTx.toJSON() : (updatedTx.toObject ? updatedTx.toObject() : { ...updatedTx });
    retObj.category = normalizeServerCategory(retObj);

    return res.json(retObj);
  } catch (error: any) {
    console.error('Error updating transaction:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error updating transaction' });
  }
}

/**
 * DELETE /api/users/:userId/transactions/:txId or DELETE /api/transactions/:id
 * Delete a transaction
 */
export async function deleteTransaction(req: Request, res: Response) {
  const txId = req.params.txId || req.params.id;

  if (!txId || typeof txId !== 'string') {
    return res.status(400).json({ error: 'Valid transaction ID is required' });
  }

  const authUser = (req as any).user;

  if (!isDbConnected()) {
    return res.json({ message: 'Transaction removed successfully (in-memory mode)', id: txId });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(txId);
    const query = {
      $or: [
        ...(isObjectId ? [{ _id: txId }] : []),
        { customId: txId },
      ],
    };

    const existingTx = await TransactionModel.findOne(query);
    if (!existingTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const urlUserId = req.params.userId;
    if (urlUserId && authUser) {
      const isOwnerOfUrl =
        authUser.customId === urlUserId ||
        authUser.id === urlUserId ||
        authUser._id?.toString() === urlUserId;
      if (!isOwnerOfUrl) {
        return res.status(403).json({ error: "Access forbidden: You cannot delete another user's transaction" });
      }
    }

    if (authUser) {
      const isOwner =
        authUser.customId === existingTx.userId ||
        authUser.id === existingTx.userId ||
        authUser._id?.toString() === existingTx.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Access forbidden: You cannot delete another user's transaction" });
      }
    } else if (existingTx.userId !== 'usr-ahmed-01') {
      return res.status(401).json({ error: 'Authentication required to delete this transaction' });
    }

    await existingTx.deleteOne();
    return res.json({ message: 'Transaction deleted successfully', id: txId });
  } catch (error: any) {
    console.error('Error deleting transaction:', error.message);
    return res.status(500).json({ error: 'Internal server error deleting transaction' });
  }
}
