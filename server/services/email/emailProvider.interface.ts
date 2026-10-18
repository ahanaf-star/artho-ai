export type EmailProviderType = 'smtp' | 'resend' | 'brevo' | 'custom' | 'dev_simulation';

export interface SendVerificationEmailParams {
  email: string;
  name: string;
  otp: string;
  token: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: EmailProviderType;
}

export interface EmailProviderStatusDetails {
  provider: EmailProviderType;
  configured: boolean;
  emailFrom: string;
  details?: Record<string, boolean | string>;
}

export interface EmailProvider {
  readonly name: EmailProviderType;
  isConfigured(): boolean;
  sendVerificationEmail(params: SendVerificationEmailParams): Promise<SendEmailResult>;
  getStatus(): EmailProviderStatusDetails;
}

