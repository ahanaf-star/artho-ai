import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  googleAuth,
  getTestVerificationCode,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/google', googleAuth);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

// Strictly internal local test helper route (disabled in production and restricted to loopback)
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-verification-code', getTestVerificationCode);
}

export default router;
