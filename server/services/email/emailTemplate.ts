import { OTP_EXPIRATION_MINUTES } from '../otp/otpCoreService';

/**
 * Escapes HTML characters to prevent XSS in email clients.
 */
export function escapeHtml(str: string): string {
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
export function buildVerificationHtml(name: string, otp: string): string {
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
export function buildVerificationText(name: string, otp: string): string {
  return `Hello ${name || 'User'},\n\n` +
    `Your Artho AI 6-digit verification code is:\n\n` +
    `   ${otp}\n\n` +
    `This code will expire in ${OTP_EXPIRATION_MINUTES} minutes.\n` +
    `For your security, never share this code with anyone.\n\n` +
    `If you did not request this verification code, you can safely ignore this email.\n\n` +
    `Artho AI Team`;
}

