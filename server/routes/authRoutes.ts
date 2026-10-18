import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  getTestVerificationCodeEndpoint,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.get('/test-verification-code', getTestVerificationCodeEndpoint);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export default router;
