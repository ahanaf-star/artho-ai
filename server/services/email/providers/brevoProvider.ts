import {
  EmailProvider,
  EmailProviderStatusDetails,
  SendVerificationEmailParams,
  SendEmailResult,
} from '../emailProvider.interface';
import { buildVerificationHtml, buildVerificationText } from '../emailTemplate';
import { cleanEnvValue, parseSenderAddress, sanitizeEmailError } from './providerUtils';

export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo';

  getApiKey(): string {
    return cleanEnvValue(process.env.BREVO_API_KEY) || cleanEnvValue(process.env.SENDINBLUE_API_KEY);
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getEmailFrom(): string {
    return cleanEnvValue(process.env.EMAIL_FROM) || 'Artho AI <noreply@arthoai.com>';
  }

  getStatus(): EmailProviderStatusDetails {
    const configured = this.isConfigured();
    const emailFrom = this.getEmailFrom();
    return {
      provider: 'brevo',
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
      console.error('[EmailService:Brevo] BREVO_API_KEY is not configured.');
      return {
        success: false,
        error: 'Brevo email service is selected but BREVO_API_KEY is missing.',
        provider: 'brevo',
      };
    }

    const normalizedTo = params.email.trim().toLowerCase();
    const sender = parseSenderAddress(this.getEmailFrom());
    const htmlContent = buildVerificationHtml(params.name, params.otp);
    const textContent = buildVerificationText(params.name, params.otp);

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: sender.name,
            email: sender.email,
          },
          to: [
            {
              email: normalizedTo,
              name: params.name || 'User',
            },
          ],
          subject: 'Verify your Artho AI account',
          htmlContent,
          textContent,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const rawError = data?.message || `Brevo API rejected with HTTP ${response.status}`;
        const sanitized = sanitizeEmailError(rawError);
        console.error(`[EmailService:Brevo] API Error (${response.status}):`, sanitized);
        return {
          success: false,
          error: sanitized,
          provider: 'brevo',
        };
      }

      const messageId = data?.messageId;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EmailService:Brevo] Verification email sent to ${normalizedTo}. Message ID: ${messageId}`);
      } else {
        console.log('[EmailService:Brevo] Verification email dispatched successfully via Brevo.');
      }

      return {
        success: true,
        messageId,
        provider: 'brevo',
      };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'Network exception communicating with Brevo');
      console.error('[EmailService:Brevo] Network exception:', sanitized);
      return {
        success: false,
        error: 'Network failure communicating with email delivery service.',
        provider: 'brevo',
      };
    }
  }
}

