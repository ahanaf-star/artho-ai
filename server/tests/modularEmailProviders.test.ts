import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  generateVerificationCredentials,
  hashVerificationSecret,
  verifySecretHash,
  checkResendCooldown,
  isOtpExpired,
  storeVerificationCredentials,
  getStoredVerificationCredentials,
  clearStoredVerificationCredentials,
  getTestVerificationCode,
  OTP_EXPIRATION_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFICATION_ATTEMPTS,
} from '../services/otp/otpCoreService';
import {
  getActiveEmailProvider,
  getEmailServiceStatus,
  getProvider,
  sendVerificationEmail,
  setCustomEmailDispatcher,
} from '../services/email/emailProviderRegistry';
import { BrevoEmailProvider } from '../services/email/providers/brevoProvider';
import { ResendEmailProvider } from '../services/email/providers/resendProvider';
import { SmtpEmailProvider } from '../services/email/providers/smtpProvider';
import { DevSimulationEmailProvider } from '../services/email/providers/devSimulationProvider';
import {
  cleanEnvValue,
  parseSenderAddress,
  sanitizeEmailError,
} from '../services/email/providers/providerUtils';

describe('Modular Email & OTP Architecture Test Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    setCustomEmailDispatcher(null);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    setCustomEmailDispatcher(null);
    process.env = { ...originalEnv };
  });

  // ==========================================
  // SECTION 1: PURE OTP CORE (DECOUPLED LOGIC)
  // ==========================================
  describe('1. Pure OTP Core Lifecycle & Cryptography', () => {
    it('1.1 Generates secure 6-digit numeric OTP and 64-char SHA-256 hashes', () => {
      const creds = generateVerificationCredentials();
      assert.strictEqual(creds.otp.length, 6);
      assert.strictEqual(/^\d{6}$/.test(creds.otp), true, 'OTP must be 6 numeric digits');
      assert.strictEqual(creds.token.length, 64, 'Token must be 64-char hex string');
      assert.strictEqual(creds.otpHashed.length, 64, 'Hashed OTP must be SHA-256 (64 hex chars)');
      assert.strictEqual(creds.tokenHashed.length, 64, 'Hashed token must be SHA-256 (64 hex chars)');
      assert.notStrictEqual(creds.otp, creds.otpHashed, 'Plaintext OTP must not match hash');
      assert.strictEqual(creds.otpHashed, hashVerificationSecret(creds.otp));
    });

    it('1.2 Timing-safe verification validates correct secret and rejects incorrect secret', () => {
      const creds = generateVerificationCredentials();
      assert.strictEqual(verifySecretHash(creds.otp, creds.otpHashed), true);
      assert.strictEqual(verifySecretHash('000000', creds.otpHashed), false);
      assert.strictEqual(verifySecretHash('', creds.otpHashed), false);
      assert.strictEqual(verifySecretHash(creds.otp, null), false);
    });

    it('1.3 Expiration logic enforces 15-minute validity window', () => {
      assert.strictEqual(OTP_EXPIRATION_MINUTES, 15);
      const now = new Date();
      const future = new Date(now.getTime() + 15 * 60 * 1000);
      const past = new Date(now.getTime() - 1000);

      assert.strictEqual(isOtpExpired(future), false, 'Future expiry must not be expired');
      assert.strictEqual(isOtpExpired(past), true, 'Past expiry must be expired');
      assert.strictEqual(isOtpExpired(null), true, 'Missing expiry must be treated as expired');
    });

    it('1.4 Cooldown rate-limiting enforces 60-second wait between resend attempts', () => {
      assert.strictEqual(RESEND_COOLDOWN_SECONDS, 60);
      assert.strictEqual(MAX_VERIFICATION_ATTEMPTS, 5);

      const justNow = new Date();
      const coolCheck = checkResendCooldown(justNow);
      assert.strictEqual(coolCheck.allowed, false);
      assert.ok(coolCheck.remainingSeconds > 0 && coolCheck.remainingSeconds <= 60);

      const sixtyFiveSecsAgo = new Date(Date.now() - 65 * 1000);
      const passCheck = checkResendCooldown(sixtyFiveSecsAgo);
      assert.strictEqual(passCheck.allowed, true);
      assert.strictEqual(passCheck.remainingSeconds, 0);

      const nullCheck = checkResendCooldown(null);
      assert.strictEqual(nullCheck.allowed, true);
    });

    it('1.5 In-memory store safely tracks and purges credentials', () => {
      const email = 'user.lifecycle@example.com';
      const creds = generateVerificationCredentials();

      storeVerificationCredentials(email, creds);
      const stored = getStoredVerificationCredentials(email);
      assert.ok(stored);
      assert.strictEqual(stored.otpHashed, creds.otpHashed);

      clearStoredVerificationCredentials(email);
      assert.strictEqual(getStoredVerificationCredentials(email), undefined);
    });
  });

  // ==========================================
  // SECTION 2: UTILITIES & PARSING
  // ==========================================
  describe('2. Provider Utilities & Redaction', () => {
    it('2.1 cleanEnvValue removes surrounding double and single quotes and whitespace', () => {
      assert.strictEqual(cleanEnvValue(''), '');
      assert.strictEqual(cleanEnvValue('   brevo   '), 'brevo');
      assert.strictEqual(cleanEnvValue('"brevo"'), 'brevo');
      assert.strictEqual(cleanEnvValue("'brevo'"), 'brevo');
      assert.strictEqual(cleanEnvValue('  "support@arthoai.com"  '), 'support@arthoai.com');
    });

    it('2.2 parseSenderAddress parses display name and email address safely', () => {
      const parsed1 = parseSenderAddress('Artho AI <support@arthoai.com>');
      assert.strictEqual(parsed1.name, 'Artho AI');
      assert.strictEqual(parsed1.email, 'support@arthoai.com');

      const parsed2 = parseSenderAddress('support@arthoai.com');
      assert.strictEqual(parsed2.name, 'Artho AI');
      assert.strictEqual(parsed2.email, 'support@arthoai.com');

      const parsed3 = parseSenderAddress('"Custom Team" <team@customdomain.org>');
      assert.strictEqual(parsed3.name, 'Custom Team');
      assert.strictEqual(parsed3.email, 'team@customdomain.org');
    });

    it('2.3 sanitizeEmailError strips API keys, tokens, and app passwords', () => {
      const error1 = 'Failed with xkeysib-1234567890abcdef-secret';
      assert.strictEqual(sanitizeEmailError(error1).includes('1234567890abcdef'), false);

      const error2 = 'Authorization header: Bearer re_abcdef123456';
      assert.strictEqual(sanitizeEmailError(error2).includes('re_abcdef123456'), false);
    });
  });

  // ==========================================
  // SECTION 3: BREVO HTTPS REST PROVIDER
  // ==========================================
  describe('3. Brevo HTTPS Provider (Port 443 - Render Free Compatible)', () => {
    it('3.1 Detects configuration when BREVO_API_KEY is present', () => {
      const brevo = new BrevoEmailProvider();
      delete process.env.BREVO_API_KEY;
      delete process.env.SENDINBLUE_API_KEY;
      assert.strictEqual(brevo.isConfigured(), false);

      process.env.BREVO_API_KEY = 'xkeysib-mock-api-key-12345';
      assert.strictEqual(brevo.isConfigured(), true);
      assert.strictEqual(brevo.getStatus().configured, true);
    });

    it('3.2 Also supports SENDINBLUE_API_KEY legacy alias', () => {
      const brevo = new BrevoEmailProvider();
      delete process.env.BREVO_API_KEY;
      process.env.SENDINBLUE_API_KEY = 'xkeysib-legacy-key';
      assert.strictEqual(brevo.isConfigured(), true);
    });

    it('3.3 Returns clear configuration error if dispatched without API key', async () => {
      const brevo = new BrevoEmailProvider();
      delete process.env.BREVO_API_KEY;
      delete process.env.SENDINBLUE_API_KEY;

      const result = await brevo.sendVerificationEmail({
        email: 'user@example.com',
        name: 'User',
        otp: '123456',
        token: 'tok123',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.provider, 'brevo');
      assert.ok(result.error?.includes('BREVO_API_KEY is missing'));
    });

    it('3.4 Correctly constructs Brevo payload and sends via HTTPS REST API', async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl = '';
      let capturedHeaders: any = {};
      let capturedBody: any = {};

      globalThis.fetch = (async (url: any, opts: any) => {
        capturedUrl = url.toString();
        capturedHeaders = opts.headers;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<brevo-msg-id-789@smtp-relay.mailin.fr>' }),
        } as any;
      }) as any;

      try {
        process.env.BREVO_API_KEY = 'xkeysib-live-key';
        process.env.EMAIL_FROM = 'Artho AI <ahanaflaptop@gmail.com>';

        const brevo = new BrevoEmailProvider();
        const result = await brevo.sendVerificationEmail({
          email: 'recipient@gmail.com',
          name: 'Ahmed',
          otp: '654321',
          token: 'token999',
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.messageId, '<brevo-msg-id-789@smtp-relay.mailin.fr>');
        assert.strictEqual(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
        assert.strictEqual(capturedHeaders['api-key'], 'xkeysib-live-key');
        assert.strictEqual(capturedBody.sender.email, 'ahanaflaptop@gmail.com');
        assert.strictEqual(capturedBody.to[0].email, 'recipient@gmail.com');
        assert.ok(capturedBody.htmlContent.includes('654321'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ==========================================
  // SECTION 4: RESEND HTTPS REST PROVIDER
  // ==========================================
  describe('4. Resend HTTPS Provider', () => {
    it('4.1 Detects configuration and reports clear error if RESEND_API_KEY missing', async () => {
      const resend = new ResendEmailProvider();
      delete process.env.RESEND_API_KEY;
      assert.strictEqual(resend.isConfigured(), false);

      const result = await resend.sendVerificationEmail({
        email: 'user@example.com',
        name: 'User',
        otp: '123456',
        token: 'tok123',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.provider, 'resend');
      assert.ok(result.error?.includes('RESEND_API_KEY is missing'));
    });
  });

  // ==========================================
  // SECTION 5: SMTP PROVIDER (NODEMAILER)
  // ==========================================
  describe('5. SMTP Nodemailer Provider', () => {
    it('5.1 Detects configuration when SMTP_USER and SMTP_PASS are set', () => {
      const smtp = new SmtpEmailProvider();
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      assert.strictEqual(smtp.isConfigured(), false);

      process.env.SMTP_USER = 'sender@gmail.com';
      process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
      assert.strictEqual(smtp.isConfigured(), true);
      assert.strictEqual(smtp.getStatus().configured, true);
    });

    it('5.2 Throws configuration error when required credentials are missing', () => {
      const smtp = new SmtpEmailProvider();
      process.env.SMTP_USER = 'sender@gmail.com';
      delete process.env.SMTP_PASS;

      assert.throws(
        () => smtp.getTransporter(),
        /SMTP configuration incomplete.*SMTP_PASS/
      );
    });
  });

  // ==========================================
  // SECTION 6: DEV SIMULATION PROVIDER
  // ==========================================
  describe('6. Dev Simulation Provider', () => {
    it('6.1 Blocks execution in production environment', async () => {
      const dev = new DevSimulationEmailProvider();
      process.env.NODE_ENV = 'production';

      const result = await dev.sendVerificationEmail({
        email: 'user@example.com',
        name: 'User',
        otp: '123456',
        token: 'tok123',
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Transactional email service is not configured'));
    });

    it('6.2 Allows loopback execution in non-production environment', async () => {
      const dev = new DevSimulationEmailProvider();
      process.env.NODE_ENV = 'development';

      const result = await dev.sendVerificationEmail({
        email: 'user@example.com',
        name: 'User',
        otp: '123456',
        token: 'tok123',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.provider, 'dev_simulation');
    });
  });

  // ==========================================
  // SECTION 7: PROVIDER REGISTRY & SELECTION
  // ==========================================
  describe('7. Email Provider Registry & Dynamic Selection', () => {
    it('7.1 Explicit EMAIL_PROVIDER=brevo selects Brevo', () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-mock';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'pass';
      assert.strictEqual(getActiveEmailProvider(), 'brevo');
    });

    it('7.2 Explicit EMAIL_PROVIDER=smtp selects SMTP', () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.BREVO_API_KEY = 'xkeysib-mock';
      assert.strictEqual(getActiveEmailProvider(), 'smtp');
    });

    it('7.3 Explicit EMAIL_PROVIDER=resend selects Resend', () => {
      process.env.EMAIL_PROVIDER = 'resend';
      assert.strictEqual(getActiveEmailProvider(), 'resend');
    });

    it('7.4 Implicit auto-selection prioritizes Brevo when BREVO_API_KEY is present', () => {
      delete process.env.EMAIL_PROVIDER;
      process.env.BREVO_API_KEY = 'xkeysib-mock';
      assert.strictEqual(getActiveEmailProvider(), 'brevo');
    });

    it('7.5 Status reporting exposes non-sensitive booleans without leaking keys', () => {
      process.env.BREVO_API_KEY = 'xkeysib-super-secret-key-123';
      process.env.SMTP_PASS = 'smtp-secret-password-456';
      process.env.RESEND_API_KEY = 're_resend_secret_token_789';
      process.env.EMAIL_PROVIDER = 'brevo';

      const status = getEmailServiceStatus();
      assert.strictEqual(status.provider, 'brevo');
      assert.strictEqual(status.configured, true);
      assert.strictEqual(status.brevoConfigured, true);

      const serialized = JSON.stringify(status);
      assert.strictEqual(serialized.includes('xkeysib-super-secret'), false, 'Brevo key must not be exposed');
      assert.strictEqual(serialized.includes('smtp-secret-password'), false, 'SMTP pass must not be exposed');
      assert.strictEqual(serialized.includes('re_resend_secret'), false, 'Resend token must not be exposed');
    });
  });

  // ==========================================
  // SECTION 8: FUTURE DOMAIN INTEGRATION
  // ==========================================
  describe('8. Future Custom Domain Compatibility', () => {
    it('8.1 Setting a future custom domain EMAIL_FROM propagates seamlessly without OTP code changes', () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-key';
      process.env.EMAIL_FROM = 'Artho AI <support@arthoai.com>';

      const provider = getProvider('brevo');
      const status = provider.getStatus();
      assert.strictEqual(status.emailFrom, 'Artho AI <support@arthoai.com>');

      // Verify OTP generation and verification remain 100% decoupled and functional
      const creds = generateVerificationCredentials();
      assert.strictEqual(creds.otp.length, 6);
      assert.strictEqual(verifySecretHash(creds.otp, creds.otpHashed), true);
    });

    it('8.2 Switching to Resend with future domain propagates cleanly', () => {
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 're_key';
      process.env.EMAIL_FROM = 'Artho AI <verify@mycustomdomain.com>';

      const provider = getProvider('resend');
      const status = provider.getStatus();
      assert.strictEqual(status.emailFrom, 'Artho AI <verify@mycustomdomain.com>');
    });
  });
});

