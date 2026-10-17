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

