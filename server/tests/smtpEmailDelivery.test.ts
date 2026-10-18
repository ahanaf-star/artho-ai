import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  getActiveEmailProvider,
  getSmtpTransporter,
  resetSmtpTransporter,
  getEmailServiceStatus,
  sendVerificationEmail,
  setCustomEmailDispatcher,
  generateVerificationCredentials,
  verifySecretHash,
  checkResendCooldown,
  cleanEnvValue,
} from '../services/emailService';
import { signup, fallbackUsers } from '../controllers/authController';

function createMockReqRes(body: any = {}, headers: any = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req: any = {
    body,
    headers,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

describe('SMTP & Multi-Provider Email Delivery Test Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    setCustomEmailDispatcher(null);
    resetSmtpTransporter();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    setCustomEmailDispatcher(null);
    resetSmtpTransporter();
    process.env = { ...originalEnv };
  });

  it('1. Provider Detection: Detects Gmail SMTP as primary when SMTP_USER and SMTP_PASS are set', () => {
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;

    const provider = getActiveEmailProvider();
    assert.strictEqual(provider, 'smtp');

    const status = getEmailServiceStatus();
    assert.strictEqual(status.provider, 'smtp');
    assert.strictEqual(status.smtpConfigured, true);
    assert.strictEqual(status.resendConfigured, false);
    assert.ok(status.emailFrom.includes('test@gmail.com'));
  });

  it('2. Provider Detection: Falls back to Resend when SMTP is not configured but RESEND_API_KEY is present', () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.RESEND_API_KEY = 're_test_key_123';
    delete process.env.EMAIL_PROVIDER;

    const provider = getActiveEmailProvider();
    assert.strictEqual(provider, 'resend');

    const status = getEmailServiceStatus();
    assert.strictEqual(status.provider, 'resend');
    assert.strictEqual(status.smtpConfigured, false);
    assert.strictEqual(status.resendConfigured, true);
  });

  it('3. Provider Detection: Explicit EMAIL_PROVIDER=resend selects Resend when configured', () => {
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.EMAIL_PROVIDER = 'resend';

    const provider = getActiveEmailProvider();
    assert.strictEqual(provider, 'resend');
  });

  it('3b. Provider Detection: Explicit EMAIL_PROVIDER=smtp selects SMTP even if RESEND_API_KEY exists', () => {
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.EMAIL_PROVIDER = 'smtp';

    const provider = getActiveEmailProvider();
    assert.strictEqual(provider, 'smtp');
  });

  it('3c. Provider Detection: Explicit EMAIL_PROVIDER=smtp with missing credentials strictly selects SMTP and never falls back to Resend', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.EMAIL_PROVIDER = 'smtp';

    const provider = getActiveEmailProvider();
    // Must strictly select smtp so the error is reported as an SMTP configuration error
    assert.strictEqual(provider, 'smtp');

    // Attempting send must fail with SMTP error and never invoke Resend
    const result = await sendVerificationEmail('test@example.com', 'Test User', '123456', 'tok123');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.provider, 'smtp');
    assert.ok(result.error?.includes('SMTP configuration incomplete'));
  });

  it('4. Provider Detection: Non-production dev simulation when no provider credentials exist', () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_PROVIDER;

    const provider = getActiveEmailProvider();
    assert.strictEqual(provider, 'dev_simulation');
  });

  it('5. Configuration Validation: getSmtpTransporter throws clear error if SMTP_PASS is missing', () => {
    process.env.SMTP_USER = 'test@gmail.com';
    delete process.env.SMTP_PASS;

    assert.throws(
      () => getSmtpTransporter(),
      /SMTP configuration incomplete.*SMTP_PASS/
    );
  });

  it('5b. Configuration Validation: getSmtpTransporter throws clear error if SMTP_PORT is invalid', () => {
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'valid_app_password';
    process.env.SMTP_PORT = 'not-a-port';

    assert.throws(
      () => getSmtpTransporter(),
      /Invalid SMTP_PORT/
    );
  });

  it('6. Error Handling: Registration safely fails with HTTP 502 when email dispatch fails without silent fallback', async () => {
    // Configure mock dispatcher that simulates SMTP failure
    setCustomEmailDispatcher(async () => {
      return { success: false, error: 'SMTP connection timed out' };
    });

    const failedEmail = `failing.signup.${Date.now()}@example.com`;
    const { req, res, getStatus, getData } = createMockReqRes({
      name: 'Fail User',
      email: failedEmail,
      password: 'SecurePassword123!',
      preferredLanguage: 'en',
    });

    await signup(req, res);
    assert.strictEqual(getStatus(), 502, 'Must return 502 Bad Gateway on delivery failure');
    const data = getData();
    assert.ok(data.error.includes('SMTP connection timed out'));

    // Verify unverified ghost user was cleaned up
    assert.strictEqual(fallbackUsers.has(failedEmail), false, 'Failed user record must not be persisted');
  });

  it('6b. Resilience: SMTP send failures strictly return an SMTP error and never silently trigger Resend', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'mock_app_pass';
    process.env.RESEND_API_KEY = 're_test_key_123';

    // Mock sendMail rejection directly on transporter
    resetSmtpTransporter();
    const transporter = getSmtpTransporter();
    transporter.sendMail = (async () => {
      throw new Error('ETIMEDOUT: Connection to smtp.gmail.com:465 timed out');
    }) as any;

    const result = await sendVerificationEmail('test@example.com', 'Test User', '123456', 'tok123');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.provider, 'smtp');
    assert.ok(result.error?.includes('Failed to deliver verification email via SMTP'));
  });

  it('7. Security: OTP credentials are generated with SHA-256 hashes and timing-safe verification', () => {
    const creds = generateVerificationCredentials();
    assert.strictEqual(creds.otp.length, 6);
    assert.strictEqual(/^\d{6}$/.test(creds.otp), true);
    assert.strictEqual(creds.otpHashed.length, 64);
    assert.notStrictEqual(creds.otp, creds.otpHashed);

    // Matching check
    const isCorrect = verifySecretHash(creds.otp, creds.otpHashed);
    assert.strictEqual(isCorrect, true);

    // Incorrect check
    const isWrong = verifySecretHash('000000', creds.otpHashed);
    assert.strictEqual(isWrong, false);
  });

  it('8. Security: Resend cooldown is strictly enforced (60s)', () => {
    const now = new Date();
    const coolCheck = checkResendCooldown(now);
    assert.strictEqual(coolCheck.allowed, false);
    assert.ok(coolCheck.remainingSeconds > 0 && coolCheck.remainingSeconds <= 60);

    const past = new Date(Date.now() - 65 * 1000);
    const passCheck = checkResendCooldown(past);
    assert.strictEqual(passCheck.allowed, true);
    assert.strictEqual(passCheck.remainingSeconds, 0);
  });

  it('9. Safe status reporting never exposes secrets', () => {
    process.env.SMTP_USER = 'sender@gmail.com';
    process.env.SMTP_PASS = 'super_secret_password_123';
    process.env.RESEND_API_KEY = 're_super_secret_token_456';

    const status = getEmailServiceStatus();
    const serialized = JSON.stringify(status);
    assert.strictEqual(serialized.includes('super_secret_password_123'), false, 'Password must not be in status');
    assert.strictEqual(serialized.includes('re_super_secret_token_456'), false, 'API key must not be in status');
  });

  it('10. Environment Sanitization: cleanEnvValue handles whitespace and surrounding quotes safely', () => {
    assert.strictEqual(cleanEnvValue(''), '');
    assert.strictEqual(cleanEnvValue(undefined), '');
    assert.strictEqual(cleanEnvValue(null), '');
    assert.strictEqual(cleanEnvValue('   smtp   '), 'smtp');
    assert.strictEqual(cleanEnvValue('"smtp"'), 'smtp');
    assert.strictEqual(cleanEnvValue("'smtp'"), 'smtp');
    assert.strictEqual(cleanEnvValue('  "smtp"  '), 'smtp');
    assert.strictEqual(cleanEnvValue('""smtp""'), 'smtp');
    assert.strictEqual(cleanEnvValue('"user@gmail.com"'), 'user@gmail.com');
  });

  it('11. Provider Detection: Handles quoted and aliased EMAIL_PROVIDER values gracefully', () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    // Double quoted
    process.env.EMAIL_PROVIDER = '"smtp"';
    assert.strictEqual(getActiveEmailProvider(), 'smtp');

    // Single quoted
    process.env.EMAIL_PROVIDER = "'smtp'";
    assert.strictEqual(getActiveEmailProvider(), 'smtp');

    // Gmail alias
    process.env.EMAIL_PROVIDER = 'gmail';
    assert.strictEqual(getActiveEmailProvider(), 'smtp');

    // Nodemailer alias
    process.env.EMAIL_PROVIDER = 'nodemailer';
    assert.strictEqual(getActiveEmailProvider(), 'smtp');

    // Quoted resend
    process.env.EMAIL_PROVIDER = '"resend"';
    assert.strictEqual(getActiveEmailProvider(), 'resend');
  });

  it('12. Configuration Validation: Strips surrounding quotes from credentials in getSmtpTransporter', () => {
    process.env.SMTP_HOST = '"smtp.gmail.com"';
    process.env.SMTP_PORT = '"465"';
    process.env.SMTP_USER = '"quoted_user@gmail.com"';
    process.env.SMTP_PASS = '"quoted_app_pass"';

    const transporter = getSmtpTransporter();
    const options = transporter.options as any;
    assert.strictEqual(options.host, 'smtp.gmail.com');
    assert.strictEqual(options.port, 465);
    assert.strictEqual(options.auth?.user, 'quoted_user@gmail.com');
    assert.strictEqual(options.auth?.pass, 'quoted_app_pass');
  });

  it('13. Status Reporting: Exposes safe presence booleans for /api/health', () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'sender@gmail.com';
    process.env.SMTP_PASS = 'mock_pass';
    process.env.EMAIL_FROM = 'Artho AI <custom@gmail.com>';
    delete process.env.RESEND_API_KEY;

    const status = getEmailServiceStatus();
    assert.strictEqual(status.provider, 'smtp');
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.smtpConfigured, true);
    assert.strictEqual(status.resendConfigured, false);
    assert.strictEqual(status.hasSmtpHost, true);
    assert.strictEqual(status.hasSmtpPort, true);
    assert.strictEqual(status.hasSmtpUser, true);
    assert.strictEqual(status.hasSmtpPass, true);
    assert.strictEqual(status.hasEmailFrom, true);
    assert.strictEqual(status.hasResendApiKey, false);
  });

  it('14. Auto-Selection: Prioritizes SMTP when SMTP_PASS is provided even if SMTP_USER is missing', () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SMTP_USER;
    process.env.SMTP_PASS = 'some_pass';
    delete process.env.RESEND_API_KEY;

    assert.strictEqual(getActiveEmailProvider(), 'smtp');
  });
});

