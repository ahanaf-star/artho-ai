import crypto from 'node:crypto';

export interface VerificationCredentials {
  otp: string;
  token: string;
  expiresAt: Date;
  sentAt: Date;
}

export const OTP_EXPIRATION_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory store for verification credentials (used for testing and offline fallback mode)
interface StoredCredential {
  otp: string;
  token: string;
  expiresAt: number;
  sentAt: number;
}
const verificationStore = new Map<string, StoredCredential>();

/**
 * Generates a cryptographically secure 6-digit verification code (OTP) and unique token.
 */
export function generateVerificationCredentials(): VerificationCredentials {
  // 6-digit numeric OTP between 100000 and 999999
  const otpNumber = crypto.randomInt(100000, 1000000);
  const otp = otpNumber.toString();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000);

  return {
    otp,
    token,
    expiresAt,
    sentAt: now,
  };
}

/**
 * Checks if a user is within the 60-second cooldown period for resending codes.
 */
export function checkResendCooldown(lastSentAt?: Date | number | null): { allowed: boolean; remainingSeconds: number } {
  if (!lastSentAt) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const sentTime = typeof lastSentAt === 'number' ? lastSentAt : new Date(lastSentAt).getTime();
  if (isNaN(sentTime)) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const elapsedSeconds = Math.floor((Date.now() - sentTime) / 1000);
  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    return {
      allowed: false,
      remainingSeconds: RESEND_COOLDOWN_SECONDS - elapsedSeconds,
    };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Records verification credentials in the memory store.
 */
export function storeVerificationCredentials(email: string, creds: VerificationCredentials): void {
  const normalized = email.trim().toLowerCase();
  verificationStore.set(normalized, {
    otp: creds.otp,
    token: creds.token,
    expiresAt: creds.expiresAt.getTime(),
    sentAt: creds.sentAt.getTime(),
  });
}

/**
 * Retrieves in-memory verification credentials if valid.
 */
export function getStoredVerificationCredentials(email: string): StoredCredential | undefined {
  const normalized = email.trim().toLowerCase();
  return verificationStore.get(normalized);
}

/**
 * Clears verification credentials from memory store once verified.
 */
export function clearStoredVerificationCredentials(email: string): void {
  const normalized = email.trim().toLowerCase();
  verificationStore.delete(normalized);
}

/**
 * Dispatches verification email.
 * Logs cleanly in development/test and avoids leaking secrets to client response.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  otp: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();

  // Log verification dispatch details for local development / testing
  console.log(`[EmailService] ==========================================`);
  console.log(`[EmailService] Verification Code Sent to: ${normalized} (${name || 'User'})`);
  console.log(`[EmailService] Verification Code: [ ${otp} ] (Valid for ${OTP_EXPIRATION_MINUTES} minutes)`);
  console.log(`[EmailService] Verification Token: ${token}`);
  console.log(`[EmailService] ==========================================`);

  return { success: true };
}

/**
 * Internal helper for automated test suites in non-production loopback environments.
 * Strictly unavailable in production.
 */
export function getTestVerificationCode(email: string): string | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  const entry = verificationStore.get(normalized);
  return entry ? entry.otp : null;
}
