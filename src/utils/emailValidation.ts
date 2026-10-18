/**
 * Client-side email validation and disposable domain detection utilities.
 * Mirrors server validation rules to provide instant feedback to users.
 */

const DISPOSABLE_DOMAINS = new Set<string>([
  '10minutemail.com',
  '10minutemail.net',
  '10minmail.com',
  '20minutemail.it',
  'burnermail.io',
  'crazymailing.com',
  'deadfake.com',
  'discard.email',
  'discardmail.com',
  'disposablemail.com',
  'dispostable.com',
  'emailondeck.com',
  'fakemailgenerator.com',
  'fakeinbox.com',
  'generator.email',
  'getairmail.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxkitten.com',
  'incognitomail.com',
  'instantemailaddress.com',
  'jetable.org',
  'maildrop.cc',
  'mailcatch.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator2.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'mohmal.im',
  'mytemp.email',
  'nada.ltd',
  'pokemail.net',
  'sharklasers.com',
  'spam4.me',
  'spambog.com',
  'spambox.us',
  'spamgourmet.com',
  'temp-mail.org',
  'temp-mail.ru',
  'tempail.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailaddress.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'trashymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'zillamail.com',
]);

const TRUSTED_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
  'aim.com',
  'mail.com',
  'gmx.com',
  'fastmail.com',
  'tutanota.com',
  'tuta.com',
  'hey.com',
]);

export function normalizeEmail(email: string): { email: string; localPart: string; domain: string } {
  const trimmed = (email || '').trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf('@');
  if (atIdx === -1) {
    return { email: trimmed, localPart: trimmed, domain: '' };
  }
  return {
    email: trimmed,
    localPart: trimmed.substring(0, atIdx),
    domain: trimmed.substring(atIdx + 1),
  };
}

export function validateEmailFormat(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email address is required.' };
  }

  const { email: cleanEmail, localPart, domain } = normalizeEmail(email);

  if (!cleanEmail) {
    return { isValid: false, error: 'Email address cannot be empty.' };
  }

  if (cleanEmail.length > 254) {
    return { isValid: false, error: 'Email address exceeds maximum length of 254 characters.' };
  }

  if (!cleanEmail.includes('@')) {
    return { isValid: false, error: 'Email address must include an "@" symbol.' };
  }

  if (!localPart) {
    return { isValid: false, error: 'Email username part before "@" cannot be empty.' };
  }

  if (localPart.length > 64) {
    return { isValid: false, error: 'Email username part before "@" cannot exceed 64 characters.' };
  }

  if (!domain) {
    return { isValid: false, error: 'Email domain part after "@" cannot be empty.' };
  }

  if (!domain.includes('.')) {
    return { isValid: false, error: 'Email domain must contain a valid top-level domain extension (e.g. .com, .edu).' };
  }

  const parts = domain.split('.');
  const tld = parts[parts.length - 1];

  if (!tld || tld.length < 2) {
    return { isValid: false, error: 'Email domain has an invalid top-level domain extension.' };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { isValid: false, error: 'Please enter a valid email address without invalid characters or spaces.' };
  }

  return { isValid: true };
}

export function isDisposableEmail(emailOrDomain: string): boolean {
  if (!emailOrDomain) return false;

  const domain = emailOrDomain.includes('@')
    ? normalizeEmail(emailOrDomain).domain
    : emailOrDomain.trim().toLowerCase();

  if (!domain) return false;

  if (
    TRUSTED_DOMAINS.has(domain) ||
    domain.endsWith('.edu') ||
    domain.endsWith('.ac.bd') ||
    domain.endsWith('.gov') ||
    domain.endsWith('.gov.bd') ||
    domain.endsWith('.mil')
  ) {
    return false;
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return true;
  }

  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(parts.length - 2).join('.');
    if (DISPOSABLE_DOMAINS.has(parentDomain)) {
      return true;
    }
  }

  return false;
}

export function validateSignupEmail(email: string, isBangla: boolean = false): {
  isValid: boolean;
  normalizedEmail: string;
  error?: string;
} {
  const formatResult = validateEmailFormat(email);
  if (!formatResult.isValid) {
    return {
      isValid: false,
      normalizedEmail: normalizeEmail(email).email,
      error: isBangla ? 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা লিখুন।' : formatResult.error,
    };
  }

  const { email: cleanEmail, domain } = normalizeEmail(email);

  if (isDisposableEmail(domain)) {
    return {
      isValid: false,
      normalizedEmail: cleanEmail,
      error: isBangla
        ? 'সাময়িক বা ডিসপোজেবল ইমেইল দিয়ে অ্যাকাউন্ট তৈরি করা যাবে না। অনুগ্রহ করে স্থায়ী ব্যক্তিগত বা অফিশিয়াল ইমেইল ব্যবহার করুন।'
        : 'Disposable and temporary email addresses are not permitted. Please use a permanent personal or work email address.',
    };
  }

  return {
    isValid: true,
    normalizedEmail: cleanEmail,
  };
}

