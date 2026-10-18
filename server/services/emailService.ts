import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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
interface StoredCredential {
  otpHashed: string;
  tokenHashed: string;
  expiresAt: number;
  sentAt: number;
}
const verificationStore = new Map<string, StoredCredential>();

// Dedicated isolated store strictly for non-production automated testing
const testOtpStore = new Map<string, string>();

export type EmailDispatchHandler = (
  email: string,
  name: string,
  otp: string,
  token: string
) => Promise<{ success: boolean; error?: string }>;

let customEmailDispatcher: EmailDispatchHandler | null = null;

/**
 * Configure a custom email dispatcher (e.g. for testing without real network calls).
 */
export function setCustomEmailDispatcher(handler: EmailDispatchHandler | null): void {
  customEmailDispatcher = handler;
}

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
 * Records verification credentials in memory.
 * Stores only hashed secrets to prevent memory inspection leaks.
 */
export function storeVerificationCredentials(email: string, creds: VerificationCredentials): void {
  const normalized = email.trim().toLowerCase();
  verificationStore.set(normalized, {
    otpHashed: creds.otpHashed,
    tokenHashed: creds.tokenHashed,
    expiresAt: creds.expiresAt.getTime(),
    sentAt: creds.sentAt.getTime(),
  });

  // Keep test store updated only when in test mode
  if (process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_AUTH_ENDPOINTS === 'true') {
    testOtpStore.set(normalized, creds.otp);
  }
}

/**
 * Retrieves in-memory verification credentials (hashes only).
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
  testOtpStore.delete(normalized);
}

/**
 * Basic HTML escaping helper for safe rendering in email templates.
 */
function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds the branded HTML email template for account verification.
 */
function buildVerificationHtml(name: string, otp: string): string {
  const safeName = escapeHtml(name || 'Valued User');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Artho AI account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5fbf7; margin: 0; padding: 24px; color: #1a1c1b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e0ede6; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 82, 54, 0.05);">
    <tr>
      <td style="padding: 32px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #e8f8f0 0%, #ffffff 100%);">
        <h1 style="color: #005236; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Artho AI</h1>
        <p style="color: #4b6357; font-size: 14px; margin: 6px 0 0 0; font-weight: 500;">Smart Wealth &amp; Financial Security</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px 32px 32px;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${safeName}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #3b423e;">
          Thank you for joining Artho AI. To complete your registration and secure your personal finance dashboard, please enter the 6-digit verification code below:
        </p>

        <div style="background: #e8f8f0; border: 1px solid #b8e6d0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #005236; display: inline-block;">${otp}</span>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #63756d; margin: 0 0 16px 0;">
          ⏳ This verification code will expire in <strong>${OTP_EXPIRATION_MINUTES} minutes</strong>. For your security, never share this code with anyone.
        </p>
        <p style="font-size: 13px; line-height: 1.5; color: #63756d; margin: 0 0 24px 0;">
          If you did not attempt to register or sign in to Artho AI, you can safely disregard this email.
        </p>

        <hr style="border: none; border-top: 1px solid #eef3f0; margin: 0 0 20px 0;">
        <p style="font-size: 11px; color: #8fa399; margin: 0; text-align: center;">
          &copy; ${new Date().getFullYear()} Artho AI &bull; Intelligent Personal Wealth &amp; Savings Engine
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds plain-text email version.
 */
function buildVerificationText(name: string, otp: string): string {
  return `Hello ${name || 'User'},\n\n` +
    `Your Artho AI 6-digit verification code is:\n\n` +
    `   ${otp}\n\n` +
    `This code will expire in ${OTP_EXPIRATION_MINUTES} minutes.\n` +
    `For your security, never share this code with anyone.\n\n` +
    `If you did not request this verification code, you can safely ignore this email.\n\n` +
    `Artho AI Team`;
}

export type EmailProviderType = 'smtp' | 'resend' | 'custom' | 'dev_simulation';

let cachedSmtpTransporter: Transporter | null = null;

/**
 * Sanitizes error messages by stripping secrets, tokens, or app passwords.
 */
function sanitizeEmailError(errorStr: string): string {
  if (!errorStr) return 'Unknown email dispatch error';
  return errorStr
    .replace(/[a-zA-Z0-9]{16}/g, '****')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ****');
}

/**
 * Returns the currently active email provider based on configuration.
 * Prioritizes SMTP (Gmail) if configured, unless explicitly overridden.
 * Never silently switches providers if an explicitly requested provider is incomplete.
 */
export function getActiveEmailProvider(): EmailProviderType {
  if (customEmailDispatcher) return 'custom';

  const explicit = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();

  // 1. Explicit provider selection takes strict precedence
  if (explicit === 'smtp') {
    return 'smtp';
  }
  if (explicit === 'resend') {
    return 'resend';
  }

  // 2. Implicit auto-selection when EMAIL_PROVIDER is not explicitly specified:
  // If SMTP_USER is configured, prioritize SMTP so that missing credentials trigger
  // a clear SMTP configuration error rather than silently falling back to Resend.
  const hasSmtpUser = Boolean(process.env.SMTP_USER);
  if (hasSmtpUser) {
    return 'smtp';
  }

  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (hasResend) {
    return 'resend';
  }

  return 'dev_simulation';
}

/**
 * Configures and returns a Nodemailer SMTP transporter.
 * Validates required configuration and port numbers safely.
 */
export function getSmtpTransporter(): Transporter {
  if (cachedSmtpTransporter) {
    return cachedSmtpTransporter;
  }

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const rawPort = (process.env.SMTP_PORT || '465').trim();
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid SMTP_PORT: "${rawPort}". Expected a valid TCP port number (e.g. 465 or 587).`);
  }
  const isSecure = port === 465;

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!user || !pass) {
    const missing: string[] = [];
    if (!user) missing.push('SMTP_USER');
    if (!pass) missing.push('SMTP_PASS');
    throw new Error(`SMTP configuration incomplete: ${missing.join(', ')} required for SMTP delivery.`);
  }

  cachedSmtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });

  return cachedSmtpTransporter;
}

/**
 * Reset cached SMTP transporter instance.
 */
export function resetSmtpTransporter(): void {
  if (cachedSmtpTransporter) {
    cachedSmtpTransporter.close();
    cachedSmtpTransporter = null;
  }
}

/**
 * Verifies SMTP connection and authentication without sending an email.
 * Never prints or leaks credentials.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getSmtpTransporter();
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    const sanitized = sanitizeEmailError(err?.message || 'SMTP verification failed');
    return { success: false, error: sanitized };
  }
}

/**
 * Returns safe status information about email provider configuration without exposing secrets.
 */
export function getEmailServiceStatus(): {
  provider: EmailProviderType;
  configured: boolean;
  emailFrom: string;
  smtpConfigured: boolean;
  resendConfigured: boolean;
} {
  const provider = getActiveEmailProvider();
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const emailFrom =
    process.env.EMAIL_FROM ||
    (smtpConfigured
      ? `Artho AI <${process.env.SMTP_USER}>`
      : 'Artho AI <onboarding@resend.dev>');

  let configured = false;
  if (provider === 'smtp') {
    configured = smtpConfigured;
  } else if (provider === 'resend') {
    configured = resendConfigured;
  } else if (provider === 'custom') {
    configured = true;
  } else {
    configured = smtpConfigured || resendConfigured;
  }

  return {
    provider,
    configured,
    emailFrom,
    smtpConfigured,
    resendConfigured,
  };
}

/**
 * Dispatches verification email.
 * Uses Gmail SMTP if configured, delegates to customDispatcher if set,
 * falls back to Resend if configured, or handles dev/test environments safely.
 * Never leaks secrets or credentials in logs.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  otp: string,
  token: string
): Promise<{ success: boolean; error?: string; messageId?: string; provider?: EmailProviderType }> {
  const normalized = email.trim().toLowerCase();

  // 1. Delegated custom dispatcher (used for automated unit/integration tests)
  if (customEmailDispatcher) {
    try {
      const res = await customEmailDispatcher(normalized, name, otp, token);
      return { ...res, provider: 'custom' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Custom dispatcher failed', provider: 'custom' };
    }
  }

  const provider = getActiveEmailProvider();
  const htmlContent = buildVerificationHtml(name, otp);
  const textContent = buildVerificationText(name, otp);

  // 2. Primary: Gmail SMTP transport
  if (provider === 'smtp') {
    try {
      const transporter = getSmtpTransporter();
      const emailFrom = process.env.EMAIL_FROM || `Artho AI <${process.env.SMTP_USER}>`;

      const info = await transporter.sendMail({
        from: emailFrom,
        to: normalized,
        subject: 'Verify your Artho AI account',
        html: htmlContent,
        text: textContent,
      });

      const accepted = Array.isArray(info.accepted) && info.accepted.length > 0;
      if (!accepted && (!info.messageId || (info.rejected && info.rejected.length > 0))) {
        console.error('[EmailService] SMTP recipient was rejected by server.');
        return {
          success: false,
          error: 'Email provider could not deliver to this address.',
          provider: 'smtp',
        };
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EmailService] Verification email sent to ${normalized} via SMTP. Message ID: ${info.messageId}`);
      } else {
        console.log('[EmailService] Verification email dispatched successfully via SMTP.');
      }

      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'SMTP transmission failure');
      console.error('[EmailService] SMTP failure:', sanitized);
      const isConfigError = sanitized.includes('SMTP configuration incomplete') || sanitized.includes('Invalid SMTP_PORT');
      return {
        success: false,
        error: isConfigError
          ? sanitized
          : 'Failed to deliver verification email via SMTP. Please check your email configuration or try again later.',
        provider: 'smtp',
      };
    }
  }

  // 3. Secondary: Resend REST API transport
  if (provider === 'resend') {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[EmailService] RESEND_API_KEY is not configured for Resend provider.');
      return {
        success: false,
        error: 'RESEND_API_KEY is required for Resend email delivery.',
        provider: 'resend',
      };
    }
    const emailFrom = process.env.EMAIL_FROM || 'Artho AI <onboarding@resend.dev>';

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [normalized],
          subject: 'Verify your Artho AI account',
          html: htmlContent,
          text: textContent,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data?.message || `Resend API rejected with HTTP ${res.status}`;
        console.error(`[EmailService] Resend API error (${res.status}):`, errorMsg);
        return { success: false, error: errorMsg, provider: 'resend' };
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EmailService] Verification email sent to ${normalized} via Resend. Message ID: ${data?.id}`);
      } else {
        console.log(`[EmailService] Verification email dispatched successfully via Resend.`);
      }

      return { success: true, messageId: data?.id, provider: 'resend' };
    } catch (err: any) {
      console.error('[EmailService] Network exception contacting email provider:', err?.message || err);
      return { success: false, error: 'Network failure communicating with email service.', provider: 'resend' };
    }
  }

  // 4. Production guard when no real email transport is configured
  if (process.env.NODE_ENV === 'production') {
    console.error('[EmailService] Critical: Neither SMTP nor Resend is configured in production environment.');
    return {
      success: false,
      error: 'Transactional email service is not configured on the server. Please contact support.',
      provider: 'dev_simulation',
    };
  }

  // 5. Non-production development/test fallback simulation
  console.log(`[EmailService] [Dev/Test Mode] Verification Code generated for: ${normalized}`);
  return { success: true, provider: 'dev_simulation' };
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
