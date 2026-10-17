import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TransactionModel } from '../models/Transaction';
import { isDbConnected } from '../config/database';
import { INITIAL_TRANSACTIONS } from '../../src/data/mockTransactions';

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
      return res.json(INITIAL_TRANSACTIONS);
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

    return res.json(transactions);
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
      category: category.trim(),
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
      category: category.trim(),
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

    return res.status(201).json(newTx);
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
    if (effectiveType === 'expense') {
      const effectiveMerchant =
        updates.merchant !== undefined
          ? updates.merchant
          : (existingTx.merchant || '').trim();
      if (!effectiveMerchant) {
        return res.status(400).json({ error: 'Merchant / Counterparty is required for expense transactions' });
      }
    }

    Object.assign(existingTx, updates);
    const updatedTx = await existingTx.save();

    return res.json(updatedTx);
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
