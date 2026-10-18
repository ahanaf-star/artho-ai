import {
  EmailProvider,
  EmailProviderStatusDetails,
  SendVerificationEmailParams,
  SendEmailResult,
} from '../emailProvider.interface';
import { buildVerificationHtml, buildVerificationText } from '../emailTemplate';
import { cleanEnvValue, sanitizeEmailError } from './providerUtils';

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  getApiKey(): string {
    return cleanEnvValue(process.env.RESEND_API_KEY);
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getEmailFrom(): string {
    return cleanEnvValue(process.env.EMAIL_FROM) || 'Artho AI <onboarding@resend.dev>';
  }

  getStatus(): EmailProviderStatusDetails {
    const configured = this.isConfigured();
    const emailFrom = this.getEmailFrom();
    return {
      provider: 'resend',
      configured,
      emailFrom,
      details: {
        hasApiKey: configured,
        hasEmailFrom: Boolean(cleanEnvValue(process.env.EMAIL_FROM)),
      },
    };
  }

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<SendEmailResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.error('[EmailService:Resend] RESEND_API_KEY is not configured.');
      return {
        success: false,
        error: 'Resend email service is selected but RESEND_API_KEY is missing.',
        provider: 'resend',
      };
    }

    const normalizedTo = params.email.trim().toLowerCase();
    const emailFrom = this.getEmailFrom();
    const htmlContent = buildVerificationHtml(params.name, params.otp);
    const textContent = buildVerificationText(params.name, params.otp);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [normalizedTo],
          subject: 'Verify your Artho AI account',
          html: htmlContent,
          text: textContent,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const rawError = data?.message || `Resend API rejected with HTTP ${response.status}`;
        const sanitized = sanitizeEmailError(rawError);
        console.error(`[EmailService:Resend] API Error (${response.status}):`, sanitized);
        return {
          success: false,
          error: sanitized,
          provider: 'resend',
        };
      }

      const messageId = data?.id;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EmailService:Resend] Verification email sent to ${normalizedTo}. Message ID: ${messageId}`);
      } else {
        console.log('[EmailService:Resend] Verification email dispatched successfully via Resend.');
      }

      return {
        success: true,
        messageId,
        provider: 'resend',
      };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'Network exception communicating with Resend');
      console.error('[EmailService:Resend] Network exception:', sanitized);
      return {
        success: false,
        error: 'Network failure communicating with email delivery service.',
        provider: 'resend',
      };
    }
  }
}

