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

// Strictly restrict test verification code retrieval to test environments
router.get('/test-verification-code', (req, res) => {
  if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_TEST_AUTH_ENDPOINTS !== 'true') {
    return res.status(404).json({ error: 'Not Found' });
  }
  return getTestVerificationCodeEndpoint(req, res);
});

router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export default router;
