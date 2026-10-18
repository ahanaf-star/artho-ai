import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  EmailProvider,
  EmailProviderStatusDetails,
  SendVerificationEmailParams,
  SendEmailResult,
} from '../emailProvider.interface';
import { buildVerificationHtml, buildVerificationText } from '../emailTemplate';
import { cleanEnvValue, sanitizeEmailError } from './providerUtils';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private cachedTransporter: Transporter | null = null;

  isConfigured(): boolean {
    const user = cleanEnvValue(process.env.SMTP_USER);
    const pass = cleanEnvValue(process.env.SMTP_PASS);
    return Boolean(user && pass);
  }

  getEmailFrom(): string {
    const fromEnv = cleanEnvValue(process.env.EMAIL_FROM);
    const user = cleanEnvValue(process.env.SMTP_USER);
    return fromEnv || (user ? `Artho AI <${user}>` : 'Artho AI <support@arthoai.com>');
  }

  getStatus(): EmailProviderStatusDetails {
    const configured = this.isConfigured();
    const emailFrom = this.getEmailFrom();
    return {
      provider: 'smtp',
      configured,
      emailFrom,
      details: {
        hasSmtpHost: Boolean(cleanEnvValue(process.env.SMTP_HOST)),
        hasSmtpPort: Boolean(cleanEnvValue(process.env.SMTP_PORT)),
        hasSmtpUser: Boolean(cleanEnvValue(process.env.SMTP_USER)),
        hasSmtpPass: Boolean(cleanEnvValue(process.env.SMTP_PASS)),
        hasEmailFrom: Boolean(cleanEnvValue(process.env.EMAIL_FROM)),
      },
    };
  }

  getTransporter(): Transporter {
    if (this.cachedTransporter) {
      return this.cachedTransporter;
    }

    const host = cleanEnvValue(process.env.SMTP_HOST) || 'smtp.gmail.com';
    const rawPort = cleanEnvValue(process.env.SMTP_PORT) || '465';
    const port = parseInt(rawPort, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error(`Invalid SMTP_PORT: "${rawPort}". Expected a valid TCP port number (e.g. 465 or 587).`);
    }
    const isSecure = port === 465;

    const user = cleanEnvValue(process.env.SMTP_USER);
    const pass = cleanEnvValue(process.env.SMTP_PASS);

    if (!user || !pass) {
      const missing: string[] = [];
      if (!user) missing.push('SMTP_USER');
      if (!pass) missing.push('SMTP_PASS');
      throw new Error(`SMTP configuration incomplete: ${missing.join(', ')} required for SMTP delivery.`);
    }

    this.cachedTransporter = nodemailer.createTransport({
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

    return this.cachedTransporter;
  }

  resetTransporter(): void {
    if (this.cachedTransporter) {
      this.cachedTransporter.close();
      this.cachedTransporter = null;
    }
  }

  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'SMTP verification failed');
      return { success: false, error: sanitized };
    }
  }

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<SendEmailResult> {
    const normalizedTo = params.email.trim().toLowerCase();
    const emailFrom = this.getEmailFrom();
    const htmlContent = buildVerificationHtml(params.name, params.otp);
    const textContent = buildVerificationText(params.name, params.otp);

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: emailFrom,
        to: normalizedTo,
        subject: 'Verify your Artho AI account',
        html: htmlContent,
        text: textContent,
      });

      const accepted = Array.isArray(info.accepted) && info.accepted.length > 0;
      if (!accepted && (!info.messageId || (info.rejected && info.rejected.length > 0))) {
        console.error('[EmailService:SMTP] Recipient was rejected by SMTP server.');
        return {
          success: false,
          error: 'Email provider could not deliver to this address.',
          provider: 'smtp',
        };
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EmailService:SMTP] Verification email sent to ${normalizedTo}. Message ID: ${info.messageId}`);
      } else {
        console.log('[EmailService:SMTP] Verification email dispatched successfully via SMTP.');
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
      };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'SMTP transmission failure');
      console.error('[EmailService:SMTP] SMTP failure:', sanitized);
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
}

