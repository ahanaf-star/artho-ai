import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { isDbConnected } from '../config/database';
import { INITIAL_USER } from '../../src/data/mockUser';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import {
  isValidCurrency,
  normalizeCurrency,
  SUPPORTED_CURRENCY_CODES,
} from '../services/exchangeRateService';

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';

/**
 * Helper to generate JWT token for user
 */
function generateToken(user: any): string {
  const userId = user._id ? user._id.toString() : user.id;
  return jwt.sign(
    {
      id: userId,
      customId: user.customId || user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/signup
 * Register a new user
 */
export async function signup(req: Request, res: Response) {
  const {
    name,
    email,
    password,
    preferredLanguage,
    monthlyIncome,
    monthlyIncomeCurrency,
    monthlyInflowBaseline,
    baselineCurrency,
  } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleanEmail = email.trim().toLowerCase();
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate Monthly Inflow Baseline amount
  const rawIncome = monthlyIncome !== undefined ? monthlyIncome : monthlyInflowBaseline;
  let parsedIncome: number | undefined = undefined;

  if (rawIncome !== undefined && rawIncome !== null && rawIncome !== '') {
    if (typeof rawIncome === 'string' && rawIncome.trim() === '') {
      parsedIncome = undefined;
    } else {
      const num = Number(rawIncome);
      if (isNaN(num) || !isFinite(num) || num < 0) {
        return res.status(400).json({
          error: 'Monthly inflow baseline must be a non-negative number',
        });
      }
      parsedIncome = Math.round(num * 100) / 100;
    }
  }

  // Validate Baseline Currency
  const rawCurrency = monthlyIncomeCurrency !== undefined ? monthlyIncomeCurrency : baselineCurrency;
  let parsedCurrency = 'BDT';

  if (rawCurrency !== undefined && rawCurrency !== null && rawCurrency !== '') {
    if (typeof rawCurrency !== 'string' || !isValidCurrency(rawCurrency)) {
      return res.status(400).json({
        error: `Invalid baseline currency code. Supported currencies: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
      });
    }
    parsedCurrency = normalizeCurrency(rawCurrency);
  }

  if (!isDbConnected()) {
    return res.status(503).json({
      error: 'Database is currently offline. Please ensure MongoDB is running.',
    });
  }

  try {
    // Check for existing user
    const existing = await UserModel.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists' });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);
    const customId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newUser = await UserModel.create({
      customId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      preferredLanguage: preferredLanguage === 'bn' ? 'bn' : 'en',
      currency: 'BDT',
      monthlyIncome: parsedIncome,
      monthlyIncomeCurrency: parsedCurrency,
      riskTolerance: undefined,
      tagline: 'Standard Member',
      city: 'Dhaka',
      memberStatus: 'Standard Member',
      primaryGoalId: undefined,
      linkedAccounts: [
        { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
        { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
        { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
      ],
      recurringObligations: [],
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
      token,
    });
  } catch (error: any) {
    console.error('Error during signup:', error.message);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!isDbConnected()) {
    // Standalone fallback: demo login
    if (cleanEmail === INITIAL_USER.email.toLowerCase() && password === 'ahmed123') {
      const token = generateToken(INITIAL_USER);
      return res.json({
        user: INITIAL_USER,
        token,
      });
    }
    return res.status(503).json({
      error: 'Database is currently offline. Please ensure MongoDB is running.',
    });
  }

  try {
    let user = await UserModel.findOne({ email: cleanEmail });

    // Auto-seed demo user Ahmed Rahman if not yet seeded
    if (!user && cleanEmail === INITIAL_USER.email.toLowerCase()) {
      const demoHash = await bcrypt.hash('ahmed123', 10);
      user = await UserModel.create({
        customId: INITIAL_USER.id,
        name: INITIAL_USER.name,
        email: INITIAL_USER.email.toLowerCase(),
        passwordHash: demoHash,
        preferredLanguage: INITIAL_USER.preferredLanguage,
        currency: INITIAL_USER.currency,
        monthlyIncome: INITIAL_USER.monthlyIncome,
        riskTolerance: INITIAL_USER.riskTolerance,
        tagline: INITIAL_USER.tagline,
        city: INITIAL_USER.city,
        memberStatus: INITIAL_USER.memberStatus,
        primaryGoalId: INITIAL_USER.primaryGoalId,
        linkedAccounts: INITIAL_USER.linkedAccounts,
      });
    }

    // If demo user exists but passwordHash is empty, update with bcrypt hash
    if (user && cleanEmail === INITIAL_USER.email.toLowerCase() && !user.passwordHash) {
      user.passwordHash = await bcrypt.hash('ahmed123', 10);
      await user.save();
    }

    // Verify user exists and has a password hash
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials.',
      });
    }

    // Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials.',
      });
    }

    const token = generateToken(user);

    return res.json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (error: any) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

/**
 * POST /api/auth/logout
 * Log out user session
 */
export async function logout(_req: Request, res: Response) {
  return res.json({ message: 'Logged out successfully' });
}

/**
 * GET /api/auth/me
 * Retrieve currently authenticated user profile
 */
export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
}
