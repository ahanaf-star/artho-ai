import {
  EmailProvider,
  EmailProviderType,
  SendVerificationEmailParams,
  SendEmailResult,
} from './emailProvider.interface';
import { BrevoEmailProvider } from './providers/brevoProvider';
import { ResendEmailProvider } from './providers/resendProvider';
import { SmtpEmailProvider } from './providers/smtpProvider';
import { DevSimulationEmailProvider } from './providers/devSimulationProvider';
import { cleanEnvValue } from './providers/providerUtils';

export type EmailDispatchHandler = (
  email: string,
  name: string,
  otp: string,
  token: string
) => Promise<{ success: boolean; error?: string }>;

let customEmailDispatcher: EmailDispatchHandler | null = null;

const brevoProvider = new BrevoEmailProvider();
const resendProvider = new ResendEmailProvider();
const smtpProvider = new SmtpEmailProvider();
const devSimulationProvider = new DevSimulationEmailProvider();

/**
 * Configure a custom email dispatcher (e.g. for testing without real network calls).
 */
export function setCustomEmailDispatcher(handler: EmailDispatchHandler | null): void {
  customEmailDispatcher = handler;
}

/**
 * Returns the currently active email provider based on configuration.
 * Explicit EMAIL_PROVIDER takes strict precedence.
 * Implicit auto-selection checks configured credentials (Brevo -> SMTP -> Resend -> DevSimulation).
 */
export function getActiveEmailProvider(): EmailProviderType {
  if (customEmailDispatcher) return 'custom';

  const explicit = cleanEnvValue(process.env.EMAIL_PROVIDER).toLowerCase();

  // 1. Explicit provider selection
  if (explicit === 'brevo' || explicit === 'sendinblue') {
    return 'brevo';
  }
  if (explicit === 'resend') {
    return 'resend';
  }
  if (explicit === 'smtp' || explicit === 'gmail' || explicit === 'nodemailer') {
    return 'smtp';
  }

  // 2. Implicit auto-selection when EMAIL_PROVIDER is not explicitly specified:
  const hasBrevo = Boolean(cleanEnvValue(process.env.BREVO_API_KEY) || cleanEnvValue(process.env.SENDINBLUE_API_KEY));
  if (hasBrevo) {
    return 'brevo';
  }

  const hasSmtpUser = Boolean(cleanEnvValue(process.env.SMTP_USER));
  const hasSmtpPass = Boolean(cleanEnvValue(process.env.SMTP_PASS));
  if (hasSmtpUser || hasSmtpPass) {
    return 'smtp';
  }

  const hasResend = Boolean(cleanEnvValue(process.env.RESEND_API_KEY));
  if (hasResend) {
    return 'resend';
  }

  return 'dev_simulation';
}

/**
 * Returns the corresponding provider instance.
 */
export function getProvider(type?: EmailProviderType): EmailProvider {
  const activeType = type || getActiveEmailProvider();
  switch (activeType) {
    case 'brevo':
      return brevoProvider;
    case 'resend':
      return resendProvider;
    case 'smtp':
      return smtpProvider;
    case 'dev_simulation':
    default:
      return devSimulationProvider;
  }
}

/**
 * Direct access to SMTP provider for transporter management and connection verification.
 */
export function getSmtpProvider(): SmtpEmailProvider {
  return smtpProvider;
}

/**
 * Dispatches verification email using the currently configured or delegated provider.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  otp: string,
  token: string
): Promise<SendEmailResult> {
  const normalized = email.trim().toLowerCase();

  // 1. Custom mock/testing dispatcher
  if (customEmailDispatcher) {
    try {
      const res = await customEmailDispatcher(normalized, name, otp, token);
      return { ...res, provider: 'custom' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Custom dispatcher failed', provider: 'custom' };
    }
  }

  const activeProviderType = getActiveEmailProvider();
  const provider = getProvider(activeProviderType);

  return provider.sendVerificationEmail({
    email: normalized,
    name,
    otp,
    token,
  });
}

/**
 * Comprehensive, safe status information about email provider configuration without exposing secrets.
 */
export function getEmailServiceStatus(): {
  provider: EmailProviderType;
  configured: boolean;
  emailFrom: string;
  brevoConfigured: boolean;
  resendConfigured: boolean;
  smtpConfigured: boolean;
  hasBrevoApiKey: boolean;
  hasResendApiKey: boolean;
  hasSmtpHost: boolean;
  hasSmtpPort: boolean;
  hasSmtpUser: boolean;
  hasSmtpPass: boolean;
  hasEmailFrom: boolean;
} {
  const provider = getActiveEmailProvider();
  const activeInstance = getProvider(provider);

  const hasBrevoApiKey = brevoProvider.isConfigured();
  const hasResendApiKey = resendProvider.isConfigured();
  const hasSmtpUser = Boolean(cleanEnvValue(process.env.SMTP_USER));
  const hasSmtpPass = Boolean(cleanEnvValue(process.env.SMTP_PASS));
  const hasSmtpHost = Boolean(cleanEnvValue(process.env.SMTP_HOST));
  const hasSmtpPort = Boolean(cleanEnvValue(process.env.SMTP_PORT));
  const hasEmailFrom = Boolean(cleanEnvValue(process.env.EMAIL_FROM));

  const brevoConfigured = hasBrevoApiKey;
  const resendConfigured = hasResendApiKey;
  const smtpConfigured = hasSmtpUser && hasSmtpPass;

  let configured = false;
  if (provider === 'brevo') {
    configured = brevoConfigured;
  } else if (provider === 'resend') {
    configured = resendConfigured;
  } else if (provider === 'smtp') {
    configured = smtpConfigured;
  } else if (provider === 'custom') {
    configured = true;
  } else {
    configured = brevoConfigured || resendConfigured || smtpConfigured;
  }

  return {
    provider,
    configured,
    emailFrom: activeInstance.getStatus().emailFrom,
    brevoConfigured,
    resendConfigured,
    smtpConfigured,
    hasBrevoApiKey,
    hasResendApiKey,
    hasSmtpHost,
    hasSmtpPort,
    hasSmtpUser,
    hasSmtpPass,
    hasEmailFrom,
  };
}

