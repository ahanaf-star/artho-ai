import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { SavingsGoalModel } from '../models/SavingsGoal';
import { UserModel } from '../models/User';
import { isDbConnected } from '../config/database';
import { INITIAL_SAVINGS_GOALS } from '../../src/data/mockGoals';

/**
 * GET /api/users/:userId/goals
 * Retrieve all savings goals for a user
 */
export async function getGoals(req: Request, res: Response) {
  const authUser = (req as any).user;
  const userId =
    req.params.userId ||
    (req.query?.userId as string) ||
    authUser?.customId ||
    authUser?.id ||
    authUser?._id?.toString();

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  if (authUser) {
    const isOwner =
      authUser.customId === userId ||
      authUser.id === userId ||
      authUser._id?.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot access another user's goals" });
    }
  } else if (userId !== 'usr-ahmed-01') {
    return res.status(401).json({ error: 'Authentication required to view goals' });
  }

  if (!isDbConnected()) {
    if (userId === 'usr-ahmed-01') {
      return res.json(INITIAL_SAVINGS_GOALS);
    }
    return res.status(503).json({
      error: 'Database is currently offline. Running in standalone fallback mode.',
    });
  }

  try {
    let goals = await SavingsGoalModel.find({ userId }).sort({ createdAt: -1 });

    // Auto-seed initial goals if demo user has no records in MongoDB and has not previously seeded/deleted
    if (goals.length === 0 && userId === 'usr-ahmed-01') {
      const isObjectId = mongoose.Types.ObjectId.isValid(userId);
      const user = await UserModel.findOne({
        $or: [
          ...(isObjectId ? [{ _id: userId }] : []),
          { customId: userId },
        ],
      });

      if (!user?.hasSeededGoals) {
        const seedData = INITIAL_SAVINGS_GOALS.map((g) => ({
          customId: g.id,
          userId: 'usr-ahmed-01',
          name: g.title,
          title: g.title,
          category: g.category,
          icon: g.icon,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          deadline: g.deadline,
          monthlyPace: g.monthlyPace,
          accountVault: g.accountVault,
          status: g.status,
          color: g.color || '#006c49',
          notes: g.notes || '',
          milestones: g.milestones || [],
        }));

        await SavingsGoalModel.insertMany(seedData);
        if (user) {
          user.hasSeededGoals = true;
          await user.save().catch(() => {});
        }
        goals = await SavingsGoalModel.find({ userId }).sort({ createdAt: -1 });
      }
    }

    return res.json(goals);
  } catch (error: any) {
    console.error('Error fetching savings goals:', error.message);
    return res.status(500).json({ error: 'Internal server error fetching savings goals' });
  }
}

/**
 * POST /api/users/:userId/goals
 * Create a new savings goal for a user
 */
export async function createGoal(req: Request, res: Response) {
  const authUser = (req as any).user;
  const userId =
    req.params.userId ||
    req.body.userId ||
    authUser?.customId ||
    authUser?.id ||
    authUser?._id?.toString();

  const {
    id,
    name,
    title,
    category,
    icon,
    targetAmount,
    currentAmount,
    deadline,
    monthlyPace,
    accountVault,
    status,
    color,
    notes,
    milestones,
  } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  if (authUser) {
    const isOwner =
      authUser.customId === userId ||
      authUser.id === userId ||
      authUser._id?.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access forbidden: You cannot create goals for another user" });
    }
  } else if (userId !== 'usr-ahmed-01') {
    return res.status(401).json({ error: 'Authentication required to create goals' });
  }

  const goalName = (name || title || '').trim();
  if (!goalName) {
    return res.status(400).json({ error: 'Goal name or title is required' });
  }

  const parsedTarget = typeof targetAmount === 'number' ? targetAmount : parseFloat(targetAmount);
  if (isNaN(parsedTarget) || parsedTarget <= 0) {
    return res.status(400).json({ error: 'Target amount must be a positive number greater than zero' });
  }

  const parsedCurrent = currentAmount !== undefined ? (typeof currentAmount === 'number' ? currentAmount : parseFloat(currentAmount)) : 0;
  if (isNaN(parsedCurrent) || parsedCurrent < 0) {
    return res.status(400).json({ error: 'Current amount cannot be negative' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!deadline || !dateRegex.test(deadline)) {
    return res.status(400).json({ error: 'Deadline date is required in YYYY-MM-DD format' });
  }

  if (!isDbConnected()) {
    const fallbackGoal = {
      id: id || `goal-${Date.now()}`,
      userId,
      name: goalName,
      title: goalName,
      category: category || 'General Savings',
      icon: icon || '🎯',
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      deadline,
      monthlyPace: monthlyPace ? Number(monthlyPace) : 0,
      accountVault: accountVault || 'bKash Liquid Vault',
      status: status || 'On Track',
      color: color || '#006c49',
      notes: notes || '',
      milestones: milestones || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return res.status(201).json(fallbackGoal);
  }

  try {
    const newGoal = await SavingsGoalModel.create({
      customId: id || `goal-${Date.now()}`,
      userId,
      name: goalName,
      title: goalName,
      category: category || 'General Savings',
      icon: icon || '🎯',
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      deadline,
      monthlyPace: monthlyPace ? Number(monthlyPace) : 0,
      accountVault: accountVault || 'bKash Liquid Vault',
      status: status || 'On Track',
      color: color || '#006c49',
      notes: notes || '',
      milestones: milestones || [],
    });

    return res.status(201).json(newGoal);
  } catch (error: any) {
    console.error('Error creating savings goal:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error creating savings goal' });
  }
}

/**
 * PUT /api/goals/:id
 * Update an existing savings goal
 */
export async function updateGoal(req: Request, res: Response) {
  const { id } = req.params;
  const updates = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid goal ID is required' });
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Update payload must be an object' });
  }

  delete updates._id;
  delete updates.createdAt;

  if (updates.name && !updates.title) updates.title = updates.name;
  if (updates.title && !updates.name) updates.name = updates.title;

  if (!isDbConnected()) {
    return res.json({
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
      ],
    };

    const existingGoal = await SavingsGoalModel.findOne(query);
    if (!existingGoal) {
      return res.status(404).json({ error: 'Savings goal not found' });
    }

    const authUser = (req as any).user;
    if (authUser) {
      const isOwner =
        authUser.customId === existingGoal.userId ||
        authUser.id === existingGoal.userId ||
        authUser._id?.toString() === existingGoal.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Access forbidden: You cannot modify another user's goal" });
      }
    } else if (existingGoal.userId !== 'usr-ahmed-01') {
      return res.status(401).json({ error: 'Authentication required to update this goal' });
    }

    Object.assign(existingGoal, updates);
    const updatedGoal = await existingGoal.save();

    return res.json(updatedGoal);
  } catch (error: any) {
    console.error('Error updating savings goal:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error updating savings goal' });
  }
}

/**
 * DELETE /api/goals/:id or DELETE /api/users/:userId/goals/:id
 * Delete a savings goal
 */
export async function deleteGoal(req: Request, res: Response) {
  const { id } = req.params;
  const urlUserId = req.params.userId;
  const authUser = (req as any).user;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid goal ID is required' });
  }

  if (urlUserId && authUser) {
    const isOwnerOfUrl =
      authUser.customId === urlUserId ||
      authUser.id === urlUserId ||
      authUser._id?.toString() === urlUserId;
    if (!isOwnerOfUrl) {
      return res.status(403).json({ error: "Access forbidden: You cannot delete another user's goal" });
    }
  }

  if (!isDbConnected()) {
    const idx = INITIAL_SAVINGS_GOALS.findIndex((g) => g.id === id);
    if (idx !== -1) {
      INITIAL_SAVINGS_GOALS.splice(idx, 1);
    }
    return res.json({ message: 'Goal removed successfully (in-memory mode)', id });
  }

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = {
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { customId: id },
      ],
    };

    const existingGoal = await SavingsGoalModel.findOne(query);
    if (!existingGoal) {
      return res.status(404).json({ error: 'Savings goal not found' });
    }

    if (authUser) {
      const isOwner =
        authUser.customId === existingGoal.userId ||
        authUser.id === existingGoal.userId ||
        authUser._id?.toString() === existingGoal.userId;
      if (!isOwner) {
        return res.status(403).json({ error: "Access forbidden: You cannot delete another user's goal" });
      }
    } else if (existingGoal.userId !== 'usr-ahmed-01') {
      return res.status(401).json({ error: 'Authentication required to delete this goal' });
    }

    const targetUserId = existingGoal.userId;
    await existingGoal.deleteOne();

    // Prevent demo user initial goals from resurrecting if all goals are deleted
    if (targetUserId === 'usr-ahmed-01') {
      await UserModel.updateOne(
        { customId: 'usr-ahmed-01' },
        { $set: { hasSeededGoals: true } }
      ).catch(() => {});
    }

    // Clean up primaryGoalId reference on UserModel if it pointed to this goal
    try {
      const isUserObjId = mongoose.Types.ObjectId.isValid(targetUserId);
      await UserModel.updateOne(
        {
          $or: [
            ...(isUserObjId ? [{ _id: targetUserId }] : []),
            { customId: targetUserId },
          ],
          primaryGoalId: { $in: [id, existingGoal.customId, existingGoal._id.toString()] },
        },
        { $unset: { primaryGoalId: 1 } }
      );
    } catch (e) {
      // Non-fatal
    }

    return res.json({ message: 'Goal deleted successfully', id });
  } catch (error: any) {
    console.error('Error deleting savings goal:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error deleting savings goal' });
  }
}
