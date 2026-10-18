import { Router } from 'express';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../controllers/goalController';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(optionalAuth);
router.get('/users/:userId/goals', getGoals);
router.post('/users/:userId/goals', createGoal);
router.put('/users/:userId/goals/:id', updateGoal);
router.delete('/users/:userId/goals/:id', deleteGoal);
router.get('/goals', getGoals);
router.post('/goals', createGoal);
router.put('/goals/:id', updateGoal);
router.delete('/goals/:id', deleteGoal);

export default router;
