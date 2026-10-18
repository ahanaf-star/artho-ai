import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { isDbConnected } from '../config/database';
import { INITIAL_USER } from '../../src/data/mockUser';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { validateSignupEmail, normalizeEmail } from '../utils/emailValidation';
import { emailService } from '../services/emailService';
import { googleAuthService } from '../services/googleAuthService';

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';

/**
 * In-memory fallback user registry for standalone/offline development and testing
 */
export const fallbackUsers = new Map<string, any>();

// Seed fallback demo user
fallbackUsers.set(INITIAL_USER.email.toLowerCase(), {
  ...INITIAL_USER,
  _id: 'usr-ahmed-01',
  passwordHash: bcrypt.hashSync('ahmed123', 10),
  isEmailVerified: true,
  authProvider: 'local',
});

/**
 * Helper to generate JWT token for user session
 */
export function generateToken(user: any): string {
  const userId = user._id ? user._id.toString() : user.id;
  return jwt.sign(
    {
      id: userId,
      customId: user.customId || user.id,
      email: user.email,
      name: user.name,
      isEmailVerified: user.isEmailVerified !== false,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Helper to sanitize user object for client response (strips passwordHash and verification secrets)
 */
function sanitizeUser(user: any): any {
  const plain = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete plain.passwordHash;
  delete plain.emailVerificationOtp;
  delete plain.emailVerificationToken;
  delete plain.emailVerificationExpires;
  delete plain.__v;
  return plain;
}

/**
 * Helper to find user in MongoDB or in-memory fallback
 */
async function findUserByEmailOrId(identifier: string): Promise<any | null> {
  const clean = identifier.trim().toLowerCase();
  if (isDbConnected()) {
    return await UserModel.findOne({
      $or: [
        { email: clean },
        { customId: identifier },
      ],
    });
  }
  return fallbackUsers.get(clean) || Array.from(fallbackUsers.values()).find((u) => u.id === identifier || u.customId === identifier) || null;
}

/**
 * POST /api/auth/signup
 * Register a new user with secure email validation, disposable domain blocking,
 * and email verification initiation.
 */
export async function signup(req: Request, res: Response) {
  const { name, email, password, preferredLanguage, monthlyIncome } = req.body;
  const isBangla = preferredLanguage === 'bn';

  // 1. Validate required name
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      error: isBangla ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন।' : 'Name is required.',
    });
  }

  // 2. Comprehensive Email Validation: Format, Normalization, & Disposable Email Blocking
  const emailValidation = validateSignupEmail(email, isBangla);
  if (!emailValidation.isValid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  const cleanEmail = emailValidation.normalizedEmail;

  // 3. Password strength check
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      error: isBangla
        ? 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।'
        : 'Password must be at least 6 characters long.',
    });
  }

  try {
    // 4. Check for existing user
    let existingUser: any = null;
    if (isDbConnected()) {
      existingUser = await UserModel.findOne({ email: cleanEmail });
    } else {
      existingUser = fallbackUsers.get(cleanEmail);
    }

    if (existingUser) {
      if (existingUser.isEmailVerified !== false) {
        return res.status(409).json({
          error: isBangla
            ? 'এই ইমেইল ঠিকানা দিয়ে ইতোমধ্যে একটি অ্যাকাউন্ট রয়েছে।'
            : 'An account with this email address already exists. Please sign in.',
        });
      }

      // If user exists but is unverified, refresh verification code and resend
      const { code, token, expiresAt } = emailService.generateVerificationCredentials();
      existingUser.emailVerificationOtp = code;
      existingUser.emailVerificationToken = token;
      existingUser.emailVerificationExpires = expiresAt;
      existingUser.emailVerificationSentAt = new Date();

      if (isDbConnected()) {
        await existingUser.save();
      } else {
        fallbackUsers.set(cleanEmail, existingUser);
      }

      const emailResult = await emailService.sendVerificationEmail({
        to: cleanEmail,
        name: existingUser.name,
        code,
        token,
      });

      return res.status(200).json({
        message: isBangla
          ? 'এই ইমেইলে আগের একটি অ্যাকাউন্ট যাচাইকরণের অপেক্ষায় আছে। একটি নতুন কোড পাঠানো হয়েছে।'
          : 'An unverified account with this email already exists. A new verification code has been sent.',
        requiresVerification: true,
        email: cleanEmail,
        devOtp: emailResult.devCode,
      });
    }

    // 5. Generate secure verification credentials
    const { code, token, expiresAt } = emailService.generateVerificationCredentials();

    // 6. Hash password securely
    const passwordHash = await bcrypt.hash(password, 10);
    const customId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const parsedIncome =
      typeof monthlyIncome === 'number' && monthlyIncome > 0
        ? monthlyIncome
        : typeof monthlyIncome === 'string' && parseFloat(monthlyIncome) > 0
          ? parseFloat(monthlyIncome)
          : undefined;

    const userData: any = {
      customId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      preferredLanguage: isBangla ? 'bn' : 'en',
      currency: 'BDT',
      monthlyIncome: parsedIncome,
      isEmailVerified: false,
      emailVerificationOtp: code,
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt,
      emailVerificationSentAt: new Date(),
      authProvider: 'local',
      city: 'Dhaka',
      tagline: 'Standard Member',
      memberStatus: 'Standard Member',
      linkedAccounts: [
        { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
        { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
        { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
      ],
      walletAccounts: [],
      recurringObligations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let createdUser: any;
    if (isDbConnected()) {
      createdUser = await UserModel.create(userData);
    } else {
      userData._id = customId;
      userData.id = customId;
      fallbackUsers.set(cleanEmail, userData);
      createdUser = userData;
    }

    // 7. Dispatch verification email
    const emailResult = await emailService.sendVerificationEmail({
      to: cleanEmail,
      name: name.trim(),
      code,
      token,
    });

    return res.status(201).json({
      message: isBangla
        ? 'অ্যাকাউন্ট তৈরি সফল হয়েছে। অনুগ্রহ করে আপনার ইমেইল যাচাই করুন।'
        : 'Registration successful! Please check your email for the 6-digit verification code.',
      requiresVerification: true,
      email: cleanEmail,
      devOtp: emailResult.devCode,
    });
  } catch (error: any) {
    console.error('Error during signup:', error.message);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

/**
 * POST /api/auth/verify-email
 * Verifies email address using 6-digit OTP code or direct URL token.
 * Grants authenticated session upon successful verification.
 */
export async function verifyEmail(req: Request, res: Response) {
  const { email, code, token } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  if (!code && !token) {
    return res.status(400).json({ error: 'Verification code or token is required.' });
  }

  const cleanEmail = normalizeEmail(email).email;

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

    if (user.isEmailVerified) {
      const sessionToken = generateToken(user);
      return res.json({
        message: 'Email is already verified.',
        user: sanitizeUser(user),
        token: sessionToken,
      });
    }

    // Check expiration
    if (user.emailVerificationExpires && new Date(user.emailVerificationExpires).getTime() < Date.now()) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
        expired: true,
      });
    }

    // Verify OTP code or token
    const isCodeMatch = code && typeof code === 'string' && user.emailVerificationOtp && code.trim() === user.emailVerificationOtp.trim();
    const isTokenMatch = token && typeof token === 'string' && user.emailVerificationToken && token.trim() === user.emailVerificationToken.trim();

    if (!isCodeMatch && !isTokenMatch) {
      return res.status(400).json({
        error: 'Invalid verification code. Please check and try again.',
      });
    }

    // Mark verified and clear verification secrets
    user.isEmailVerified = true;
    user.emailVerificationOtp = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.updatedAt = new Date();

    if (isDbConnected()) {
      await user.save();
    } else {
      fallbackUsers.set(cleanEmail, user);
    }

    const sessionToken = generateToken(user);

    return res.json({
      message: 'Email verified successfully! Welcome to ArthoBachao AI.',
      user: sanitizeUser(user),
      token: sessionToken,
    });
  } catch (error: any) {
    console.error('Error during email verification:', error.message);
    return res.status(500).json({ error: 'Internal server error verifying email.' });
  }
}

/**
 * POST /api/auth/resend-verification
 * Resends a fresh 6-digit OTP code with strict 60-second rate-limiting.
 */
export async function resendVerification(req: Request, res: Response) {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const cleanEmail = normalizeEmail(email).email;

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

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified. You can sign in directly.' });
    }

    // Rate limiting check
    const rateCheck = emailService.canResendVerification(user.emailVerificationSentAt);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Please wait ${rateCheck.waitSeconds} seconds before requesting a new code.`,
        retryAfter: rateCheck.waitSeconds,
      });
    }

    const { code, token, expiresAt } = emailService.generateVerificationCredentials();
    user.emailVerificationOtp = code;
    user.emailVerificationToken = token;
    user.emailVerificationExpires = expiresAt;
    user.emailVerificationSentAt = new Date();

    if (isDbConnected()) {
      await user.save();
    } else {
      fallbackUsers.set(cleanEmail, user);
    }

    const emailResult = await emailService.sendVerificationEmail({
      to: cleanEmail,
      name: user.name,
      code,
      token,
    });

    return res.json({
      message: 'A fresh verification code has been sent to your email.',
      email: cleanEmail,
      devOtp: emailResult.devCode,
    });
  } catch (error: any) {
    console.error('Error resending verification code:', error.message);
    return res.status(500).json({ error: 'Internal server error resending verification code.' });
  }
}

/**
 * POST /api/auth/login
 * Authenticates user with email and password.
 * Enforces email verification requirement before granting session access.
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = normalizeEmail(email).email;

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
          preferredLanguage: INITIAL_USER.preferredLanguage,
          currency: INITIAL_USER.currency,
          monthlyIncome: INITIAL_USER.monthlyIncome,
          riskTolerance: INITIAL_USER.riskTolerance,
          tagline: INITIAL_USER.tagline,
          city: INITIAL_USER.city,
          memberStatus: INITIAL_USER.memberStatus,
          primaryGoalId: INITIAL_USER.primaryGoalId,
          linkedAccounts: INITIAL_USER.linkedAccounts,
          isEmailVerified: true,
          authProvider: 'local',
        });
      }
    } else {
      user = fallbackUsers.get(cleanEmail);
    }

    // Verify user exists and has a password
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials.',
      });
    }

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password. Please verify your credentials.',
      });
    }

    // Enforce email verification (preserve existing accounts without explicit false)
    if (user.isEmailVerified === false) {
      return res.status(403).json({
        error: 'Please verify your email address to continue.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = generateToken(user);

    return res.json({
      message: 'Login successful',
      user: sanitizeUser(user),
      token,
    });
  } catch (error: any) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

/**
 * POST /api/auth/google
 * Authenticates user via Google Identity Services ID Token.
 * Verifies token cryptographically with Google, supports new user registration
 * and existing account linking without trusting client assertions.
 */
export async function googleAuth(req: Request, res: Response) {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Google ID token is required.' });
  }

  try {
    // 1. Authoritative backend verification of Google ID token
    const verifiedGoogle = await googleAuthService.verifyIdToken(idToken);
    const googleEmail = verifiedGoogle.email;
    const googleSub = verifiedGoogle.googleId;

    let user: any = null;

    if (isDbConnected()) {
      // Look up by googleId first
      user = await UserModel.findOne({ googleId: googleSub });

      if (!user) {
        // Look up by email for account linking
        user = await UserModel.findOne({ email: googleEmail });

        if (user) {
          // Link existing account to Google
          user.googleId = googleSub;
          user.isEmailVerified = true;
          if (!user.profileImage && verifiedGoogle.picture) {
            user.profileImage = verifiedGoogle.picture;
          }
          await user.save();
        } else {
          // Register new Google-authenticated user
          const customId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          user = await UserModel.create({
            customId,
            name: verifiedGoogle.name,
            email: googleEmail,
            profileImage: verifiedGoogle.picture || '',
            googleId: googleSub,
            authProvider: 'google',
            isEmailVerified: true,
            preferredLanguage: 'en',
            currency: 'BDT',
            city: 'Dhaka',
            tagline: 'Standard Member',
            memberStatus: 'Standard Member',
            linkedAccounts: [
              { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
              { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
              { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
            ],
            walletAccounts: [],
            recurringObligations: [],
          });
        }
      }
    } else {
      // In-memory fallback mode
      user = Array.from(fallbackUsers.values()).find((u) => u.googleId === googleSub) || fallbackUsers.get(googleEmail);

      if (user) {
        user.googleId = googleSub;
        user.isEmailVerified = true;
        if (!user.profileImage && verifiedGoogle.picture) {
          user.profileImage = verifiedGoogle.picture;
        }
        fallbackUsers.set(googleEmail, user);
      } else {
        const customId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        user = {
          _id: customId,
          id: customId,
          customId,
          name: verifiedGoogle.name,
          email: googleEmail,
          profileImage: verifiedGoogle.picture || '',
          googleId: googleSub,
          authProvider: 'google',
          isEmailVerified: true,
          preferredLanguage: 'en',
          currency: 'BDT',
          city: 'Dhaka',
          tagline: 'Standard Member',
          memberStatus: 'Standard Member',
          linkedAccounts: [
            { name: 'bKash', balance: 0, accountNumber: '', type: 'MFS' },
            { name: 'City Bank', balance: 0, accountNumber: '', type: 'Bank Account' },
            { name: 'Nagad', balance: 0, accountNumber: '', type: 'MFS' },
          ],
          walletAccounts: [],
          recurringObligations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        fallbackUsers.set(googleEmail, user);
      }
    }

    const token = generateToken(user);

    return res.json({
      message: 'Google authentication successful',
      user: sanitizeUser(user),
      token,
    });
  } catch (error: any) {
    console.error('Error during Google authentication:', error.message);
    return res.status(401).json({
      error: error.message || 'Google authentication failed. Please verify your Google account.',
    });
  }
}

/**
 * POST /api/auth/logout
 * Terminates user session.
 */
export async function logout(_req: Request, res: Response) {
  return res.json({ message: 'Logged out successfully' });
}

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile.
 */
export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: sanitizeUser(req.user) });
}
