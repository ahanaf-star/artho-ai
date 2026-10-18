import crypto from 'node:crypto';

export interface VerificationCredentials {
  otp: string;          // Plaintext OTP (ephemeral, used only during email dispatch)
  token: string;        // Plaintext token (ephemeral, used only during email dispatch)
  otpHashed: string;    // SHA-256 hash for secure persistence
  tokenHashed: string;  // SHA-256 hash for secure persistence
  expiresAt: Date;
  sentAt: Date;
}

export const OTP_EXPIRATION_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory store for verification credentials (stores hashes only, never plaintext secrets)
export interface StoredCredential {
  otpHashed: string;
  tokenHashed: string;
  expiresAt: number;
  sentAt: number;
}

const verificationStore = new Map<string, StoredCredential>();

// Dedicated isolated store strictly for non-production automated testing
const testOtpStore = new Map<string, string>();

/**
 * Hashes verification secret (OTP or token) with SHA-256.
 */
export function hashVerificationSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret.trim()).digest('hex');
}

/**
 * Timing-safe comparison of submitted secret against stored SHA-256 hash.
 * Also supports legacy plaintext values if encountered during transition.
 */
export function verifySecretHash(submitted: string, storedHashOrPlaintext?: string | null): boolean {
  if (!submitted || !storedHashOrPlaintext) return false;
  const cleanSubmitted = submitted.trim();
  const cleanStored = storedHashOrPlaintext.trim();

  // If stored value is already a 64-char hex string (SHA-256 hash)
  if (/^[0-9a-fA-F]{64}$/.test(cleanStored)) {
    const computedHash = hashVerificationSecret(cleanSubmitted);
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(cleanStored, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // Backward compatibility fallback for legacy plaintext stored values
  try {
    const bufA = Buffer.from(cleanSubmitted, 'utf8');
    const bufB = Buffer.from(cleanStored, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure 6-digit verification code (OTP) and unique token.
 * Returns both raw values (for email body) and SHA-256 hashes (for storage).
 */
export function generateVerificationCredentials(): VerificationCredentials {
  // 6-digit numeric OTP between 100000 and 999999
  const otpNumber = crypto.randomInt(100000, 1000000);
  const otp = otpNumber.toString();
  const token = crypto.randomBytes(32).toString('hex');
  const otpHashed = hashVerificationSecret(otp);
  const tokenHashed = hashVerificationSecret(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000);

  return {
    otp,
    token,
    otpHashed,
    tokenHashed,
    expiresAt,
    sentAt: now,
  };
}

/**
 * Checks whether the resend cooldown (60 seconds) has elapsed since sentAt.
 */
export function checkResendCooldown(sentAt?: Date | null): { allowed: boolean; remainingSeconds: number } {
  if (!sentAt) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const sentTime = new Date(sentAt).getTime();
  if (isNaN(sentTime)) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - sentTime) / 1000);

  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    return {
      allowed: false,
      remainingSeconds: Math.max(1, RESEND_COOLDOWN_SECONDS - elapsedSeconds),
    };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Checks whether an OTP expiration date has passed.
 */
export function isOtpExpired(expiresAt?: Date | number | null): boolean {
  if (!expiresAt) return true;
  const time = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
  if (isNaN(time)) return true;
  return Date.now() > time;
}

/**
 * Persists hashed verification credentials in memory store.
 */
export function storeVerificationCredentials(email: string, creds: VerificationCredentials): void {
  const normalized = email.trim().toLowerCase();
  verificationStore.set(normalized, {
    otpHashed: creds.otpHashed,
    tokenHashed: creds.tokenHashed,
    expiresAt: creds.expiresAt.getTime(),
    sentAt: creds.sentAt.getTime(),
  });

  // If in non-production environment, also populate loopback test store
  if (process.env.NODE_ENV !== 'production') {
    testOtpStore.set(normalized, creds.otp);
  }
}

/**
 * Retrieves in-memory credential record for an email.
 */
export function getStoredVerificationCredentials(email: string): StoredCredential | undefined {
  return verificationStore.get(email.trim().toLowerCase());
}

/**
 * Clears stored credentials upon successful verification or invalidation.
 */
export function clearStoredVerificationCredentials(email: string): void {
  const normalized = email.trim().toLowerCase();
  verificationStore.delete(normalized);
  testOtpStore.delete(normalized);
}

/**
 * Internal helper strictly for non-production loopback test environments.
 * Strictly disabled in production.
 */
export function getTestVerificationCode(email: string): string | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  return testOtpStore.get(normalized) || null;
}

/**
 * Helper to manually set test OTP for automated unit tests.
 */
export function setTestVerificationCode(email: string, otp: string): void {
  if (process.env.NODE_ENV !== 'production') {
    testOtpStore.set(email.trim().toLowerCase(), otp);
  }
}

/**
 * Checks whether email OTP verification is active.
 * Controlled by the EMAIL_OTP_ENABLED environment variable.
 * Defaults to true if unspecified. Set EMAIL_OTP_ENABLED=false, '0', 'disabled', or 'off' to temporarily bypass OTP.
 */
export function isEmailOtpEnabled(): boolean {
  const raw = (process.env.EMAIL_OTP_ENABLED ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'disabled' || raw === 'off') {
    return false;
  }
  return true;
}


