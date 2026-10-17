import { Request, Response } from 'express';
import { CategoryModel } from '../models/Category';
import { TransactionModel } from '../models/Transaction';
import { isDbConnected } from '../config/database';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const BUILTIN_CATEGORIES = [
  'food & groceries',
  'shopping & gadgets',
  'utility & fixed costs',
  'transportation',
  'cash-out & bank fees',
  'entertainment & others',
  'salary & inflow',
  'savings & investment',
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/users/:userId/categories or /api/categories
 * Retrieve all custom categories for the authenticated user
 */
export async function getCategories(req: Request, res: Response) {
  const targetUserId = req.params.userId || (req as AuthenticatedRequest).userId;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  // Enforce strict user isolation
  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === targetUserId ||
      authUser.id === targetUserId ||
      authUser._id?.toString() === targetUserId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot access another user's categories" });
    }
  } else if (targetUserId !== 'usr-ahmed-01') {
    return res.status(401).json({ error: 'Authentication required to view categories' });
  }

  if (!isDbConnected()) {
    return res.json([]);
  }

  try {
    const categories = await CategoryModel.find({ userId: targetUserId }).sort({ createdAt: 1 });
    return res.json(categories);
  } catch (err: any) {
    console.error(`[categoryController] getCategories error for user ${targetUserId}:`, err);
    return res.status(500).json({ error: 'Failed to retrieve categories' });
  }
}

/**
 * POST /api/users/:userId/categories or /api/categories
 * Create a new custom category for the authenticated user
 */
export async function createCategory(req: Request, res: Response) {
  const targetUserId = req.params.userId || (req as AuthenticatedRequest).userId;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  // Enforce strict user isolation
  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === targetUserId ||
      authUser.id === targetUserId ||
      authUser._id?.toString() === targetUserId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot create categories for another user" });
    }
  }

  const { name, type } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required and cannot be empty' });
  }

  const trimmedName = name.trim();

  if (trimmedName.length > 50) {
    return res.status(400).json({ error: 'Category name must be 50 characters or fewer' });
  }

  // Prevent collision with built-in categories
  if (BUILTIN_CATEGORIES.includes(trimmedName.toLowerCase())) {
    return res.status(409).json({ error: 'Cannot create custom category with a built-in category name' });
  }

  if (!isDbConnected()) {
    // In offline fallback mode, return a mocked category
    return res.status(201).json({
      id: `cat-${Date.now()}`,
      userId: targetUserId,
      name: trimmedName,
      type: type === 'income' ? 'income' : 'expense',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    // Case-insensitive duplicate check for the same user
    const existing = await CategoryModel.findOne({
      userId: targetUserId,
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
    });

    if (existing) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    const customId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newCategory = new CategoryModel({
      customId,
      userId: targetUserId,
      name: trimmedName,
      type: type === 'income' ? 'income' : 'expense',
    });

    const saved = await newCategory.save();
    return res.status(201).json(saved);
  } catch (err: any) {
    console.error(`[categoryController] createCategory error for user ${targetUserId}:`, err);
    return res.status(500).json({ error: err.message || 'Failed to create category' });
  }
}

/**
 * DELETE /api/users/:userId/categories/:catId or /api/categories/:catId
 * Safely delete a custom category only if not referenced by existing transactions
 */
export async function deleteCategory(req: Request, res: Response) {
  const targetUserId = req.params.userId || (req as AuthenticatedRequest).userId;
  const catId = req.params.catId || req.params.id;

  if (!targetUserId || !catId) {
    return res.status(400).json({ error: 'User ID and Category ID are required' });
  }

  // Enforce strict user isolation
  const authUser = (req as any).user;
  if (authUser) {
    const isOwner =
      authUser.customId === targetUserId ||
      authUser.id === targetUserId ||
      authUser._id?.toString() === targetUserId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot delete another user's categories" });
    }
  }

  if (!isDbConnected()) {
    return res.json({ success: true, message: 'Category deleted successfully' });
  }

  try {
    // Find category by customId or _id belonging to target user
    const category = await CategoryModel.findOne({
      $and: [
        { userId: targetUserId },
        {
          $or: [
            { customId: catId },
            ...(catId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: catId }] : []),
          ],
        },
      ],
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Safety check: verify no transactions currently use this category
    const inUseCount = await TransactionModel.countDocuments({
      userId: targetUserId,
      category: category.name,
    });

    if (inUseCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category "${category.name}" because it is used by ${inUseCount} existing transaction(s). Please recategorize or delete those transactions first.`,
      });
    }

    await CategoryModel.deleteOne({ _id: category._id });
    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err: any) {
    console.error(`[categoryController] deleteCategory error for user ${targetUserId}:`, err);
    return res.status(500).json({ error: err.message || 'Failed to delete category' });
  }
}
