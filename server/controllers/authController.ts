import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, IUser } from '../models/User';
import { isDbConnected } from '../config/database';
import { INITIAL_USER } from '../../src/data/mockUser';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import {
  isValidCurrency,
  normalizeCurrency,
  SUPPORTED_CURRENCY_CODES,
} from '../services/exchangeRateService';
import {
  validateSignupEmailAsync,
  validateLoginEmail,
} from '../utils/emailValidation';
import {
  generateVerificationCredentials,
  checkResendCooldown,
  storeVerificationCredentials,
  clearStoredVerificationCredentials,
  sendVerificationEmail,
  getTestVerificationCode,
  MAX_VERIFICATION_ATTEMPTS,
} from '../services/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';

// In-memory user store for offline fallback mode or test runs when MongoDB is offline
interface FallbackUser {
  id: string;
  customId: string;
  name: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  emailVerificationOtp?: string;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  emailVerificationAttempts?: number;
  preferredLanguage: string;
  currency: string;
  monthlyIncome?: number;
  riskTolerance?: string;
  tagline?: string;
  city?: string;
  memberStatus?: string;
  primaryGoalId?: string;
  linkedAccounts: any[];
  recurringObligations: any[];
}

const fallbackUsers = new Map<string, FallbackUser>();

// Seed INITIAL_USER in fallback store with isEmailVerified = true
const initialUserHash = bcrypt.hashSync('ahmed123', 10);
fallbackUsers.set(INITIAL_USER.email.toLowerCase(), {
  id: INITIAL_USER.id,
  customId: INITIAL_USER.id,
  name: INITIAL_USER.name,
  email: INITIAL_USER.email.toLowerCase(),
  passwordHash: initialUserHash,
  isEmailVerified: true,
  preferredLanguage: INITIAL_USER.preferredLanguage,
  currency: INITIAL_USER.currency,
  monthlyIncome: INITIAL_USER.monthlyIncome,
  riskTolerance: INITIAL_USER.riskTolerance,
  tagline: INITIAL_USER.tagline,
  city: INITIAL_USER.city,
  memberStatus: INITIAL_USER.memberStatus,
  primaryGoalId: INITIAL_USER.primaryGoalId,
  linkedAccounts: INITIAL_USER.linkedAccounts,
  recurringObligations: [],
});

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
 * Register a new user with required email verification and baseline currency options
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

  // Validate name
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }

  // Validate email format, temporary domains, and domain DNS
  const emailValidation = await validateSignupEmailAsync(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({ error: emailValidation.error || 'Please enter a valid email address.' });
  }

  const cleanEmail = emailValidation.normalizedEmail;

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
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
          error: 'Monthly inflow baseline must be a non-negative number.',
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

  try {
    const creds = generateVerificationCredentials();
    const passwordHash = await bcrypt.hash(password, 10);
    const customId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (isDbConnected()) {
      // Check for existing user in MongoDB
      const existing = await UserModel.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }

      await UserModel.create({
        customId,
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        isEmailVerified: false,
        emailVerificationOtp: creds.otp,
        emailVerificationToken: creds.token,
        emailVerificationExpires: creds.expiresAt,
        emailVerificationSentAt: creds.sentAt,
        emailVerificationAttempts: 0,
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
    } else {
      // Fallback offline / memory store
      if (fallbackUsers.has(cleanEmail)) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }

      fallbackUsers.set(cleanEmail, {
        id: customId,
        customId,
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        isEmailVerified: false,
        emailVerificationOtp: creds.otp,
        emailVerificationToken: creds.token,
        emailVerificationExpires: creds.expiresAt,
        emailVerificationSentAt: creds.sentAt,
        emailVerificationAttempts: 0,
        preferredLanguage: preferredLanguage === 'bn' ? 'bn' : 'en',
        currency: 'BDT',
        monthlyIncome: parsedIncome,
        tagline: 'Standard Member',
        city: 'Dhaka',
        memberStatus: 'Standard Member',
        linkedAccounts: [
          { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
          { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
          { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
        ],
        recurringObligations: [],
      });
    }

    // Store in email verification service and dispatch email
    storeVerificationCredentials(cleanEmail, creds);
    await sendVerificationEmail(cleanEmail, name.trim(), creds.otp, creds.token);

    // Return success indicating verification is required (DO NOT leak OTP or token)
    return res.status(201).json({
      message: 'Registration successful. Please enter the 6-digit verification code sent to your email to verify your account.',
      requiresVerification: true,
      email: cleanEmail,
      user: {
        id: customId,
        customId,
        name: name.trim(),
        email: cleanEmail,
        isEmailVerified: false,
        preferredLanguage: preferredLanguage === 'bn' ? 'bn' : 'en',
        currency: 'BDT',
        monthlyIncome: parsedIncome,
        monthlyIncomeCurrency: parsedCurrency,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error during signup:', error.message);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 * Blocks disposable emails and strictly enforces isEmailVerified
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Validate format and block disposable domains on login as well
  const loginValidation = validateLoginEmail(email);
  if (!loginValidation.isValid) {
    return res.status(400).json({ error: loginValidation.error || 'Please enter a valid email address.' });
  }

  const cleanEmail = loginValidation.normalizedEmail;

  try {
    let user: any = null;

    if (isDbConnected()) {
      user = await UserModel.findOne({ email: cleanEmail });

      // Auto-seed demo user Ahmed Rahman if not yet seeded
      if (!user && cleanEmail === INITIAL_USER.email.toLowerCase()) {
        const demoHash = await bcrypt.hash('ahmed123', 10);
        user = await UserModel.create({
          customId: INITIAL_USER.id,
          name: INITIAL_USER.name,
          email: INITIAL_USER.email.toLowerCase(),
          passwordHash: demoHash,
          isEmailVerified: true,
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

      // If demo user exists but passwordHash is empty or isEmailVerified not set, ensure verified
      if (user && cleanEmail === INITIAL_USER.email.toLowerCase()) {
        let changed = false;
        if (!user.passwordHash) {
          user.passwordHash = await bcrypt.hash('ahmed123', 10);
          changed = true;
        }
        if (user.isEmailVerified !== true) {
          user.isEmailVerified = true;
          changed = true;
        }
        if (changed) {
          await user.save();
        }
      }
    } else {
      // Offline fallback mode
      user = fallbackUsers.get(cleanEmail);
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

    // Reject login if email is not verified
    if (user.isEmailVerified !== true) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: cleanEmail,
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
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

/**
 * POST /api/auth/verify-email
 * Verifies user email with 6-digit OTP or verification token
 */
export async function verifyEmail(req: Request, res: Response) {
  const { email, code, token } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = typeof code === 'string' ? code.trim() : '';
  const cleanToken = typeof token === 'string' ? token.trim() : '';

  if (!cleanCode && !cleanToken) {
    return res.status(400).json({ error: 'Please provide a 6-digit verification code or token.' });
  }

  try {
    let user: any = null;

    if (isDbConnected()) {
      user = await UserModel.findOne({ email: cleanEmail });
    } else {
      user = fallbackUsers.get(cleanEmail);
    }

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.isEmailVerified === true) {
      const jwtToken = generateToken(user);
      return res.json({
        message: 'Your email is already verified. You are logged in.',
        user,
        token: jwtToken,
      });
    }

    // Check maximum attempts
    const currentAttempts = user.emailVerificationAttempts || 0;
    if (currentAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      // Invalidate existing code
      if (isDbConnected()) {
        user.emailVerificationOtp = undefined;
        await user.save();
      } else {
        user.emailVerificationOtp = undefined;
      }
      clearStoredVerificationCredentials(cleanEmail);

      return res.status(400).json({
        error: 'Too many incorrect verification attempts. Please request a new verification code.',
        requiresNewCode: true,
      });
    }

    // Check expiration
    const expiresAt = user.emailVerificationExpires ? new Date(user.emailVerificationExpires).getTime() : 0;
    if (expiresAt && Date.now() > expiresAt) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
        requiresNewCode: true,
      });
    }

    // Verify code or token
    const otpMatch = cleanCode && user.emailVerificationOtp && cleanCode === user.emailVerificationOtp;
    const tokenMatch = cleanToken && user.emailVerificationToken && cleanToken === user.emailVerificationToken;

    if (!otpMatch && !tokenMatch) {
      // Increment attempt counter
      const updatedAttempts = currentAttempts + 1;
      if (isDbConnected()) {
        user.emailVerificationAttempts = updatedAttempts;
        if (updatedAttempts >= MAX_VERIFICATION_ATTEMPTS) {
          user.emailVerificationOtp = undefined;
        }
        await user.save();
      } else {
        user.emailVerificationAttempts = updatedAttempts;
        if (updatedAttempts >= MAX_VERIFICATION_ATTEMPTS) {
          user.emailVerificationOtp = undefined;
        }
      }

      if (updatedAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        clearStoredVerificationCredentials(cleanEmail);
        return res.status(400).json({
          error: 'Too many incorrect verification attempts. Please request a new verification code.',
          requiresNewCode: true,
        });
      }

      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - updatedAttempts;
      return res.status(400).json({
        error: `Invalid verification code. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
      });
    }

    // Successful verification: mark user verified and clear verification secrets
    if (isDbConnected()) {
      user.isEmailVerified = true;
      user.emailVerificationOtp = undefined;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save();
    } else {
      user.isEmailVerified = true;
      user.emailVerificationOtp = undefined;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
    }

    clearStoredVerificationCredentials(cleanEmail);

    const jwtToken = generateToken(user);

    return res.json({
      message: 'Email verified successfully! Welcome to ArthoBachao AI.',
      user,
      token: jwtToken,
    });
  } catch (error: any) {
    console.error('Error during email verification:', error.message);
    return res.status(500).json({ error: 'Internal server error during verification.' });
  }
}

/**
 * POST /api/auth/resend-verification
 * Resends verification code with 60-second cooldown rate limit
 */
export async function resendVerification(req: Request, res: Response) {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const loginValidation = validateLoginEmail(email);
  if (!loginValidation.isValid) {
    return res.status(400).json({ error: loginValidation.error || 'Please enter a valid email address.' });
  }

  const cleanEmail = loginValidation.normalizedEmail;

  try {
    let user: any = null;

    if (isDbConnected()) {
      user = await UserModel.findOne({ email: cleanEmail });
    } else {
      user = fallbackUsers.get(cleanEmail);
    }

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.isEmailVerified === true) {
      return res.status(400).json({ error: 'This email is already verified. You can log in directly.' });
    }

    // Rate limiting cooldown check (60 seconds)
    const isTestBypass = process.env.NODE_ENV !== 'production' && req.headers['x-test-bypass-cooldown'] === 'true';
    if (!isTestBypass) {
      const cooldown = checkResendCooldown(user.emailVerificationSentAt);
      if (!cooldown.allowed) {
        return res.status(429).json({
          error: `Please wait ${cooldown.remainingSeconds} seconds before requesting a new verification code.`,
          remainingSeconds: cooldown.remainingSeconds,
        });
      }
    }

    // Generate new credentials
    const creds = generateVerificationCredentials();

    if (isDbConnected()) {
      user.emailVerificationOtp = creds.otp;
      user.emailVerificationToken = creds.token;
      user.emailVerificationExpires = creds.expiresAt;
      user.emailVerificationSentAt = creds.sentAt;
      user.emailVerificationAttempts = 0;
      await user.save();
    } else {
      user.emailVerificationOtp = creds.otp;
      user.emailVerificationToken = creds.token;
      user.emailVerificationExpires = creds.expiresAt;
      user.emailVerificationSentAt = creds.sentAt;
      user.emailVerificationAttempts = 0;
    }

    storeVerificationCredentials(cleanEmail, creds);
    await sendVerificationEmail(cleanEmail, user.name, creds.otp, creds.token);

    return res.json({
      message: 'A new 6-digit verification code has been sent to your email address.',
      cooldownSeconds: 60,
    });
  } catch (error: any) {
    console.error('Error during resend verification:', error.message);
    return res.status(500).json({ error: 'Internal server error while resending verification code.' });
  }
}

/**
 * GET /api/auth/test-verification-code
 * Strictly for automated testing in non-production loopback environment
 */
export async function getTestVerificationCodeEndpoint(req: Request, res: Response) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Verify request is from local machine
  const ip = req.ip || req.socket.remoteAddress || '';
  if (!ip.includes('127.0.0.1') && !ip.includes('::1') && !ip.includes('localhost')) {
    return res.status(403).json({ error: 'Access restricted to localhost' });
  }

  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  // Check in-memory emailService store
  let code = getTestVerificationCode(email);

  // If not found in emailService store, check DB or fallbackUsers
  if (!code) {
    if (isDbConnected()) {
      const user = await UserModel.findOne({ email });
      if (user?.emailVerificationOtp) {
        code = user.emailVerificationOtp;
      }
    } else {
      const fbUser = fallbackUsers.get(email);
      if (fbUser?.emailVerificationOtp) {
        code = fbUser.emailVerificationOtp;
      }
    }
  }

  if (!code) {
    return res.status(404).json({ error: 'No active verification code found for this email' });
  }

  return res.json({ code });
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
