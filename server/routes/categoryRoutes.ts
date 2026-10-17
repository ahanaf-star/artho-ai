import { Router } from 'express';
import {
  getCategories,
  createCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { optionalAuth, requireAuth } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

router.get('/:userId/categories', optionalAuth, getCategories);
router.post('/:userId/categories', requireAuth, createCategory);
router.delete('/:userId/categories/:catId', requireAuth, deleteCategory);

router.get('/categories', requireAuth, getCategories);
router.post('/categories', requireAuth, createCategory);
router.delete('/categories/:id', requireAuth, deleteCategory);

export default router;
