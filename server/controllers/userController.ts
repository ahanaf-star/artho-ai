import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { isDbConnected } from '../config/database';
import { INITIAL_USER } from '../../src/data/mockUser';
import { normalizeCurrency, isValidCurrency, SUPPORTED_CURRENCY_CODES } from '../services/exchangeRateService';

/**
 * GET /api/users/:id
 * Retrieve a user by customId, _id, or email
 */
export async function getUser(req: Request, res: Response) {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === id ||
      authUser.id === id ||
      authUser._id?.toString() === id ||
      authUser.email?.toLowerCase() === id.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot access another user's profile" });
    }
  } else if (id !== 'usr-ahmed-01' && id !== INITIAL_USER.email) {
    return res.status(401).json({ error: 'Authentication required to view user profile' });
  }

  if (!isDbConnected()) {
    // If DB is offline, return demo user if requested
    if (id === 'usr-ahmed-01' || id === INITIAL_USER.email) {
      return res.json(INITIAL_USER);
    }
    return res.status(503).json({
      error: 'Database is currently offline. Running in standalone fallback mode.',
    });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    let user = await UserModel.findOne({
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { customId: id },
        { email: id.toLowerCase() },
      ],
    });

    // Auto-seed demo user if requested and not found in MongoDB
    if (!user && (id === 'usr-ahmed-01' || id === INITIAL_USER.email)) {
      user = await UserModel.create({
        customId: INITIAL_USER.id,
        name: INITIAL_USER.name,
        email: INITIAL_USER.email,
        preferredLanguage: INITIAL_USER.preferredLanguage,
        currency: INITIAL_USER.currency,
        timeZone: INITIAL_USER.timeZone || 'Asia/Dhaka',
        timeFormat: INITIAL_USER.timeFormat || '24h',
        lastFinancialUpdate: INITIAL_USER.lastFinancialUpdate,
        monthlyIncome: INITIAL_USER.monthlyIncome,
        riskTolerance: INITIAL_USER.riskTolerance,
        tagline: INITIAL_USER.tagline,
        city: INITIAL_USER.city,
        memberStatus: INITIAL_USER.memberStatus,
        primaryGoalId: INITIAL_USER.primaryGoalId,
        linkedAccounts: INITIAL_USER.linkedAccounts,
      });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error.message);
    return res.status(500).json({ error: 'Internal server error fetching user' });
  }
}

/**
 * PUT /api/users/:id
 * Update an existing user profile
 */
export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const updates = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Update payload must be an object' });
  }

  // Prevent modifying sensitive or internal fields
  delete updates._id;
  delete updates.createdAt;

  if (updates.currency !== undefined) {
    if (typeof updates.currency !== 'string' || !isValidCurrency(updates.currency)) {
      return res.status(400).json({
        error: `Invalid currency code. Supported currencies: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
      });
    }
    updates.currency = normalizeCurrency(updates.currency);
  }

  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === id ||
      authUser.id === id ||
      authUser._id?.toString() === id ||
      authUser.email?.toLowerCase() === id.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot modify another user's profile" });
    }
  } else if (id !== 'usr-ahmed-01' && id !== INITIAL_USER.email) {
    return res.status(401).json({ error: 'Authentication required to update user profile' });
  }

  if (!isDbConnected()) {
    // If DB is offline, return synthetic updated object for demo
    return res.json({
      ...(id === 'usr-ahmed-01' ? INITIAL_USER : {}),
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = {
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { customId: id },
        { email: id.toLowerCase() },
      ],
    };

    let user = await UserModel.findOneAndUpdate(query, { $set: updates }, { new: true, runValidators: true });

    // If demo user was not yet in DB, create it with updates applied
    if (!user && (id === 'usr-ahmed-01' || id === INITIAL_USER.email)) {
      user = await UserModel.create({
        customId: INITIAL_USER.id,
        name: INITIAL_USER.name,
        email: INITIAL_USER.email,
        preferredLanguage: INITIAL_USER.preferredLanguage,
        currency: INITIAL_USER.currency,
        timeZone: INITIAL_USER.timeZone || 'Asia/Dhaka',
        timeFormat: INITIAL_USER.timeFormat || '24h',
        lastFinancialUpdate: INITIAL_USER.lastFinancialUpdate,
        monthlyIncome: INITIAL_USER.monthlyIncome,
        riskTolerance: INITIAL_USER.riskTolerance,
        tagline: INITIAL_USER.tagline,
        city: INITIAL_USER.city,
        memberStatus: INITIAL_USER.memberStatus,
        linkedAccounts: INITIAL_USER.linkedAccounts,
        ...updates,
      });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error: any) {
    console.error('Error updating user:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error updating user' });
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function createUser(req: Request, res: Response) {
  const {
    name,
    email,
    passwordHash,
    profileImage,
    preferredLanguage,
    currency,
    monthlyIncome,
    riskTolerance,
    tagline,
    city,
    linkedAccounts,
  } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'User name is required' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!isDbConnected()) {
    const fallbackUser = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      profileImage: profileImage || '',
      preferredLanguage: preferredLanguage || 'en',
      currency: normalizeCurrency(currency),
      monthlyIncome: monthlyIncome ? Number(monthlyIncome) : undefined,
      riskTolerance: riskTolerance || undefined,
      tagline: tagline || 'Standard Member',
      city: city || 'Dhaka',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return res.status(201).json(fallbackUser);
  }

  try {
    const existing = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const newUser = await UserModel.create({
      customId: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: passwordHash || '',
      profileImage: profileImage || '',
      preferredLanguage: preferredLanguage || 'en',
      currency: normalizeCurrency(currency),
      monthlyIncome: monthlyIncome ? Number(monthlyIncome) : undefined,
      riskTolerance: riskTolerance || undefined,
      tagline: tagline || 'Standard Member',
      city: city || 'Dhaka',
      linkedAccounts: linkedAccounts || [
        { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
        { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
        { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
      ],
    });

    return res.status(201).json(newUser);
  } catch (error: any) {
    console.error('Error creating user:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error creating user' });
  }
}

// In-memory store for wallet accounts when MongoDB is offline / standalone
const fallbackWalletsByUser = new Map<string, any[]>();

/**
 * GET /api/users/:id/wallets
 * Get all manually managed wallet & bank accounts for user
 */
export async function getWalletAccounts(req: Request, res: Response) {
  const { id } = req.params;
  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === id ||
      authUser.id === id ||
      authUser._id?.toString() === id ||
      authUser.email?.toLowerCase() === id.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot access another user's accounts" });
    }
  } else if (id !== 'usr-ahmed-01' && id !== INITIAL_USER.email) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isDbConnected()) {
    return res.json(fallbackWalletsByUser.get(id) || []);
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const user = await UserModel.findOne({
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { customId: id },
        { email: id.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user.walletAccounts || []);
  } catch (err: any) {
    console.error('Error fetching wallet accounts:', err.message);
    return res.status(500).json({ error: 'Failed to fetch wallet accounts' });
  }
}

/**
 * POST /api/users/:id/wallets
 * Add a new manually managed wallet or bank account
 */
export async function addWalletAccount(req: Request, res: Response) {
  const { id } = req.params;
  const { accountType, provider, displayName, accountNumber, balance, notes } = req.body;

  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === id ||
      authUser.id === id ||
      authUser._id?.toString() === id ||
      authUser.email?.toLowerCase() === id.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot modify another user's accounts" });
    }
  } else if (id !== 'usr-ahmed-01' && id !== INITIAL_USER.email) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!provider || typeof provider !== 'string' || !provider.trim()) {
    return res.status(400).json({ error: 'Provider / Institution name is required' });
  }

  let parsedBalance: number | undefined = undefined;
  if (balance !== undefined && balance !== null && balance !== '') {
    const num = Number(balance);
    if (isNaN(num) || !isFinite(num) || num < 0) {
      return res.status(400).json({ error: 'Current balance must be a non-negative number' });
    }
    parsedBalance = num;
  }

  const newAccount = {
    id: `wlt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: id,
    accountType: accountType || 'Mobile Financial Service (MFS)',
    provider: provider.trim(),
    displayName: displayName ? String(displayName).trim() : '',
    accountNumber: accountNumber ? String(accountNumber).trim() : '',
    balance: parsedBalance !== undefined ? parsedBalance : 0,
    notes: notes ? String(notes).trim() : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isDbConnected()) {
    const list = fallbackWalletsByUser.get(id) || [];
    list.push(newAccount);
    fallbackWalletsByUser.set(id, list);
    return res.status(201).json(newAccount);
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const user = await UserModel.findOneAndUpdate(
      {
        $or: [
          ...(isObjectId ? [{ _id: id }] : []),
          { customId: id },
          { email: id.toLowerCase() },
        ],
      },
      { $push: { walletAccounts: newAccount } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(201).json(newAccount);
  } catch (err: any) {
    console.error('Error adding wallet account:', err.message);
    return res.status(500).json({ error: 'Failed to add wallet account' });
  }
}

/**
 * PUT /api/users/:id/wallets/:accountId
 * Update an existing wallet or bank account
 */
export async function updateWalletAccount(req: Request, res: Response) {
  const { id, accountId } = req.params;
  const updates = req.body;

  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === id ||
      authUser.id === id ||
      authUser._id?.toString() === id ||
      authUser.email?.toLowerCase() === id.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot modify another user's accounts" });
    }
  } else if (id !== 'usr-ahmed-01' && id !== INITIAL_USER.email) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (updates.balance !== undefined && updates.balance !== null && updates.balance !== '') {
    const num = Number(updates.balance);
    if (isNaN(num) || !isFinite(num) || num < 0) {
      return res.status(400).json({ error: 'Current balance must be a non-negative number' });
    }
    updates.balance = num;
  }

  if (updates.provider !== undefined && (!updates.provider || !String(updates.provider).trim())) {
    return res.status(400).json({ error: 'Provider / Institution name cannot be empty' });
  }

  if (!isDbConnected()) {
    const list = fallbackWalletsByUser.get(id) || [];
    const idx = list.findIndex((a) => a.id === accountId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const updated = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    fallbackWalletsByUser.set(id, list);
    return res.json(updated);
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const user = await UserModel.findOne({
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { customId: id },
        { email: id.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const account = user.walletAccounts?.find((a: any) => a.id === accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (updates.accountType !== undefined) account.accountType = updates.accountType;
    if (updates.provider !== undefined) account.provider = String(updates.provider).trim();
    if (updates.displayName !== undefined) account.displayName = String(updates.displayName).trim();
    if (updates.accountNumber !== undefined) account.accountNumber = String(updates.accountNumber).trim();
    if (updates.balance !== undefined) account.balance = Number(updates.balance);
    if (updates.notes !== undefined) account.notes = String(updates.notes).trim();
    account.updatedAt = new Date().toISOString();

    await user.save();
    return res.json(account);
  } catch (err: any) {
    console.error('Error updating wallet account:', err.message);
    return res.status(500).json({ error: 'Failed to update wallet account' });
  }
}

/**
 * DELETE /api/users/:id/wallets/:accountId
 * Delete an existing wallet or bank account
 */
export async function deleteWalletAccount(req: Request, res: Response) {
  const { id, accountId } = req.params;

  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === id ||
      authUser.id === id ||
      authUser._id?.toString() === id ||
      authUser.email?.toLowerCase() === id.toLowerCase();
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot modify another user's accounts" });
    }
  } else if (id !== 'usr-ahmed-01' && id !== INITIAL_USER.email) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isDbConnected()) {
    const list = fallbackWalletsByUser.get(id) || [];
    const idx = list.findIndex((a) => a.id === accountId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    list.splice(idx, 1);
    fallbackWalletsByUser.set(id, list);
    return res.json({ success: true, message: 'Account deleted' });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const user = await UserModel.findOneAndUpdate(
      {
        $or: [
          ...(isObjectId ? [{ _id: id }] : []),
          { customId: id },
          { email: id.toLowerCase() },
        ],
      },
      { $pull: { walletAccounts: { id: accountId } } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting wallet account:', err.message);
    return res.status(500).json({ error: 'Failed to delete wallet account' });
  }
}

