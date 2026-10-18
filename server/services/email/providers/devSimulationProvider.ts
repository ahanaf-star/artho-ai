import {
  EmailProvider,
  EmailProviderStatusDetails,
  SendVerificationEmailParams,
  SendEmailResult,
} from '../emailProvider.interface';
import { cleanEnvValue } from './providerUtils';

export class DevSimulationEmailProvider implements EmailProvider {
  readonly name = 'dev_simulation';

  isConfigured(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  getEmailFrom(): string {
    return cleanEnvValue(process.env.EMAIL_FROM) || 'Artho AI Dev <dev@arthoai.local>';
  }

  getStatus(): EmailProviderStatusDetails {
    return {
      provider: 'dev_simulation',
      configured: this.isConfigured(),
      emailFrom: this.getEmailFrom(),
      details: {
        isProduction: process.env.NODE_ENV === 'production',
      },
    };
  }

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<SendEmailResult> {
    const normalized = params.email.trim().toLowerCase();

    // Strictly blocked in production environment
    if (process.env.NODE_ENV === 'production') {
      const rawProvider = cleanEnvValue(process.env.EMAIL_PROVIDER);
      const hasSmtpUser = Boolean(cleanEnvValue(process.env.SMTP_USER));
      const hasSmtpPass = Boolean(cleanEnvValue(process.env.SMTP_PASS));
      const hasResend = Boolean(cleanEnvValue(process.env.RESEND_API_KEY));
      const hasBrevo = Boolean(cleanEnvValue(process.env.BREVO_API_KEY) || cleanEnvValue(process.env.SENDINBLUE_API_KEY));

      console.error(
        `[EmailService] Critical: No email provider is configured in production environment. ` +
        `(EMAIL_PROVIDER=${rawProvider || 'unset'}, hasBrevo=${hasBrevo}, hasSmtpUser=${hasSmtpUser}, hasSmtpPass=${hasSmtpPass}, hasResend=${hasResend})`
      );

      return {
        success: false,
        error: 'Transactional email service is not configured on the server. Please contact support.',
        provider: 'dev_simulation',
      };
    }

    // Non-production development/test loopback simulation
    console.log(`[EmailService] [Dev/Test Mode] Verification Code generated for: ${normalized}`);
    return {
      success: true,
      provider: 'dev_simulation',
    };
  }
}

