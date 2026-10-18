/**
 * Verification script for SMTP configuration in Artho AI
 * Usage: npx tsx scripts/verify_smtp_config.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import {
  getEmailServiceStatus,
  verifySmtpConnection,
  sendVerificationEmail,
  generateVerificationCredentials,
} from '../server/services/emailService';

async function main() {
  console.log('====================================================');
  console.log('  Artho AI — SMTP & Email Provider Verification');
  console.log('====================================================\n');

  const status = getEmailServiceStatus();

  console.log('1. Configuration Check:');
  console.log('   - Active Provider:', status.provider);
  console.log('   - SMTP Configured:', status.smtpConfigured ? 'YES (SMTP_USER + SMTP_PASS present)' : 'NO');
  console.log('   - Resend Configured:', status.resendConfigured ? 'YES (RESEND_API_KEY present)' : 'NO');
  console.log('   - Sender Address:', status.emailFrom);
  console.log('   - SMTP Host:', process.env.SMTP_HOST || 'smtp.gmail.com (default)');
  console.log('   - SMTP Port:', process.env.SMTP_PORT || '465 (default SMTPS)');

  if (!status.smtpConfigured) {
    console.log('\n[NOTICE] Gmail SMTP is not yet configured in .env.');
    console.log('To activate Gmail SMTP, set the following in your local .env:');
    console.log('   SMTP_HOST=smtp.gmail.com');
    console.log('   SMTP_PORT=465');
    console.log('   SMTP_USER=your_dedicated_account@gmail.com');
    console.log('   SMTP_PASS=xxxx xxxx xxxx xxxx  (16-char Google App Password)');
    console.log('   EMAIL_FROM="Artho AI" <your_dedicated_account@gmail.com>');
    return;
  }

  console.log('\n2. Testing SMTP Server Connectivity & Authentication...');
  const connResult = await verifySmtpConnection();

  if (!connResult.success) {
    console.error('❌ SMTP Connection / Authentication Failed:');
    console.error('   Error:', connResult.error);
    console.error('\nTroubleshooting tips:');
    console.error('   1. Ensure 2-Step Verification is enabled on your Google Account.');
    console.error('   2. Ensure you generated an "App Password" (not your normal Google account password).');
    console.error('   3. Ensure SMTP_USER matches your full Gmail address.');
    return;
  }

  console.log('✅ SMTP Server Connection & Authentication Successful!');
  console.log('   Connected to smtp.gmail.com:465 with valid credentials.');

  // Test sending if TEST_EMAIL_RECIPIENT is provided
  const testRecipient = process.env.TEST_EMAIL_RECIPIENT;
  if (!testRecipient) {
    console.log('\n3. Test Email Dispatch:');
    console.log('   [SKIPPED] To send a live test verification email, set TEST_EMAIL_RECIPIENT in .env');
    console.log('   Example: TEST_EMAIL_RECIPIENT=your_test_email@gmail.com');
    console.log('   Then re-run: npx tsx scripts/verify_smtp_config.ts');
    return;
  }

  console.log(`\n3. Sending Test Verification Email to: ${testRecipient}...`);
  const creds = generateVerificationCredentials();
  const sendResult = await sendVerificationEmail(
    testRecipient,
    'Tester',
    creds.otp,
    creds.token
  );

  if (sendResult.success) {
    console.log('✅ Email accepted by SMTP server for delivery!');
    console.log('   - Provider Used:', sendResult.provider);
    console.log('   - SMTP Message ID:', sendResult.messageId || 'Acknowledged');
    console.log('\n[IMPORTANT NOTE]');
    console.log('SMTP acceptance confirms that smtp.gmail.com queued the email for immediate delivery.');
    console.log('Please check the recipient inbox (and spam/promotions folder) to confirm receipt.');
  } else {
    console.error('❌ Email dispatch failed:');
    console.error('   - Error:', sendResult.error);
  }
}

main().catch((err) => {
  console.error('Unexpected script error:', err?.message || err);
});

