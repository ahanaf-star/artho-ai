/**
 * Artho AI Email & Verification Service
 * Unified facade re-exporting decoupled OTP Core logic and modular Email Delivery Providers.
 */

// 1. Pure OTP Core (decoupled from all email providers)
export type {
  VerificationCredentials,
  StoredCredential,
} from './otp/otpCoreService';

export {
  OTP_EXPIRATION_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFICATION_ATTEMPTS,
  hashVerificationSecret,
  verifySecretHash,
  generateVerificationCredentials,
  checkResendCooldown,
  isOtpExpired,
  storeVerificationCredentials,
  getStoredVerificationCredentials,
  clearStoredVerificationCredentials,
  getTestVerificationCode,
  setTestVerificationCode,
  isEmailOtpEnabled,
} from './otp/otpCoreService';

// 2. Email Provider Interface & Types
export type {
  EmailProviderType,
  SendVerificationEmailParams,
  SendEmailResult,
  EmailProviderStatusDetails,
  EmailProvider,
} from './email/emailProvider.interface';

// 3. Email Templates
export {
  buildVerificationHtml,
  buildVerificationText,
  escapeHtml,
} from './email/emailTemplate';

// 4. Provider Utilities
export {
  cleanEnvValue,
  parseSenderAddress,
  sanitizeEmailError,
} from './email/providers/providerUtils';

// 5. Email Provider Registry & Dispatcher
export type {
  EmailDispatchHandler,
} from './email/emailProviderRegistry';

export {
  setCustomEmailDispatcher,
  getActiveEmailProvider,
  getProvider,
  getSmtpProvider,
  sendVerificationEmail,
  getEmailServiceStatus,
} from './email/emailProviderRegistry';

import { getSmtpProvider } from './email/emailProviderRegistry';
import type { Transporter } from 'nodemailer';

/**
 * Backward-compatible helper returning the active SMTP transporter.
 */
export function getSmtpTransporter(): Transporter {
  return getSmtpProvider().getTransporter();
}

/**
 * Backward-compatible helper resetting the active SMTP transporter.
 */
export function resetSmtpTransporter(): void {
  getSmtpProvider().resetTransporter();
}

/**
 * Backward-compatible helper verifying SMTP connection.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  return getSmtpProvider().verifyConnection();
}
