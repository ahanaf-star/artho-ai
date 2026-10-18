import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel, IUser } from '../models/User';
import { isDbConnected } from '../config/database';
import { INITIAL_USER } from '../../src/data/mockUser';

export interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'arthobachao_secure_jwt_secret_key_2026_dev';

/**
 * Middleware that strictly requires a valid JWT authentication token
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; customId?: string; email: string; name?: string };

    if (!isDbConnected()) {
      // In offline fallback mode, mock authenticated user
      req.user = {
        ...INITIAL_USER,
        id: decoded.customId || decoded.id || INITIAL_USER.id,
        name: decoded.name || INITIAL_USER.name,
      };
      req.userId = req.user.id;
      return next();
    }

    // Look up user in MongoDB by _id or customId
    const orConditions: any[] = [];
    if (decoded.id && mongoose.isValidObjectId(decoded.id)) {
      orConditions.push({ _id: decoded.id });
    }
    if (decoded.customId) {
      orConditions.push({ customId: decoded.customId });
    }
    if (decoded.id) {
      orConditions.push({ customId: decoded.id });
    }
    if (decoded.email) {
      orConditions.push({ email: decoded.email.toLowerCase() });
    }

    const user = orConditions.length > 0 ? await UserModel.findOne({ $or: orConditions }) : null;

    if (!user) {
      return res.status(401).json({ error: 'Invalid authentication session. User not found.' });
    }

    req.user = user;
    req.userId = user.customId || user._id.toString();
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Optional authentication middleware: attaches user if token is present and valid,
 * but allows unauthenticated requests to proceed.
 */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; customId?: string; email: string; name?: string };

    if (isDbConnected()) {
      const orConditions: any[] = [];
      if (decoded.id && mongoose.isValidObjectId(decoded.id)) {
        orConditions.push({ _id: decoded.id });
      }
      if (decoded.customId) {
        orConditions.push({ customId: decoded.customId });
      }
      if (decoded.id) {
        orConditions.push({ customId: decoded.id });
      }
      if (decoded.email) {
        orConditions.push({ email: decoded.email.toLowerCase() });
      }

      if (orConditions.length > 0) {
        const user = await UserModel.findOne({ $or: orConditions });
        if (user) {
          req.user = user;
          req.userId = user.customId || user._id.toString();
        } else if (decoded.name) {
          req.user = { name: decoded.name, email: decoded.email, id: decoded.customId || decoded.id };
          req.userId = decoded.customId || decoded.id;
        }
      }
    } else {
      req.user = {
        ...INITIAL_USER,
        id: decoded.customId || decoded.id || INITIAL_USER.id,
        name: decoded.name || INITIAL_USER.name,
      };
      req.userId = req.user.id;
    }
  } catch (e) {
    // Ignore invalid tokens in optional auth
  }

  next();
}
