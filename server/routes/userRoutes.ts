import { Router } from 'express';
import {
  getUser,
  updateUser,
  createUser,
  getWalletAccounts,
  addWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
} from '../controllers/userController';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(optionalAuth);
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);

// Wallets & Banking Accounts endpoints
router.get('/:id/wallets', getWalletAccounts);
router.post('/:id/wallets', addWalletAccount);
router.put('/:id/wallets/:accountId', updateWalletAccount);
router.delete('/:id/wallets/:accountId', deleteWalletAccount);

export default router;

