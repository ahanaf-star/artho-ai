/**
 * Server-side email validation, disposable domain detection, and DNS mail exchanger verification.
 * Provides strict RFC 5322 compliance, normalization, temporary provider blocking,
 * and authoritative DNS MX/A record validation for ArthoBachao AI.
 */

import dns from 'node:dns/promises';

// Curated list of high-traffic disposable and temporary email domains
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
  'emailfake.com',
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

// Explicit whitelist of common trusted domains to ensure zero false positives and fast bypass
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

// Reserved special-use TLDs that can never receive legitimate public email (RFC 2606 / RFC 6761)
const INVALID_TLDS = new Set<string>([
  'invalid',
  'test',
  'localhost',
  'local',
  'onion',
  'internal',
]);

// Lightweight in-memory cache for DNS lookup results (TTL 10 minutes)
interface DnsCacheEntry {
  isValid: boolean;
  error?: string;
  expiresAt: number;
}
const dnsCache = new Map<string, DnsCacheEntry>();
const DNS_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Normalizes email by trimming whitespace and converting to lowercase.
 */
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

/**
 * Validates structural email format with granular, user-friendly error messages.
 */
export function validateEmailFormat(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email address is required.' };
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email address cannot be empty or contain only whitespace.' };
  }

  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address exceeds maximum allowed length of 254 characters.' };
  }

  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount === 0) {
    return { isValid: false, error: 'Email address must include an "@" symbol.' };
  }
  if (atCount > 1) {
    return { isValid: false, error: 'Email address cannot contain multiple "@" symbols.' };
  }

  const { email: cleanEmail, localPart, domain } = normalizeEmail(trimmed);

  if (!localPart) {
    return { isValid: false, error: 'Email username before "@" cannot be empty.' };
  }

  if (localPart.length > 64) {
    return { isValid: false, error: 'Email username before "@" cannot exceed 64 characters.' };
  }

  // Reject consecutive dots or leading/trailing dot in local part
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { isValid: false, error: 'Email username cannot start, end, or contain consecutive dots.' };
  }

  if (!domain) {
    return { isValid: false, error: 'Email domain after "@" cannot be empty.' };
  }

  if (domain.length > 253) {
    return { isValid: false, error: 'Email domain exceeds maximum allowed length of 253 characters.' };
  }

  // Domain must contain at least one dot
  if (!domain.includes('.')) {
    return { isValid: false, error: 'Email domain must contain a valid domain extension (e.g. .com, .edu).' };
  }

  // Reject consecutive dots or leading/trailing dot in domain
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return { isValid: false, error: 'Email domain cannot start, end, or contain consecutive dots.' };
  }

  const domainParts = domain.split('.');
  for (const part of domainParts) {
    if (!part || part.length > 63) {
      return { isValid: false, error: 'Email domain labels must be between 1 and 63 characters.' };
    }
    if (part.startsWith('-') || part.endsWith('-')) {
      return { isValid: false, error: 'Email domain labels cannot start or end with a hyphen.' };
    }
    if (!/^[a-z0-9-]+$/.test(part)) {
      return { isValid: false, error: 'Email domain contains invalid characters.' };
    }
  }

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return { isValid: false, error: 'Email domain has an invalid top-level domain extension.' };
  }

  if (!/^[a-z]+$/.test(tld)) {
    return { isValid: false, error: 'Top-level domain extension must contain only letters.' };
  }

  if (INVALID_TLDS.has(tld)) {
    return { isValid: false, error: `Domains ending in ".${tld}" are reserved and cannot receive public email.` };
  }

  // RFC 5322 compatible format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { isValid: false, error: 'Please enter a valid email address without invalid characters or spaces.' };
  }

  return { isValid: true };
}

/**
 * Checks whether an email or domain belongs to a known temporary/disposable provider.
 */
export function isDisposableEmail(emailOrDomain: string): boolean {
  if (!emailOrDomain) return false;

  const domain = emailOrDomain.includes('@')
    ? normalizeEmail(emailOrDomain).domain
    : emailOrDomain.trim().toLowerCase();

  if (!domain) return false;

  // Safeguard: Trusted providers or educational/governmental domains are never disposable
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

  // Check direct domain match
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return true;
  }

  // Check parent domains (e.g., sub.mailinator.com -> mailinator.com)
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(parts.length - 2).join('.');
    if (DISPOSABLE_DOMAINS.has(parentDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates domain DNS mail exchange (MX) and host address (A/AAAA) records.
 * Resolves MX records with A/AAAA fallback as specified in RFC 5321 Section 5.1.
 * Gracefully handles transient DNS timeouts or network errors without falsely blocking users.
 */
export async function validateEmailDomainDns(domain: string): Promise<{ isValid: boolean; error?: string }> {
  const cleanDomain = (domain || '').trim().toLowerCase();
  if (!cleanDomain) {
    return { isValid: false, error: 'Domain name is required for DNS validation.' };
  }

  // Fast-path: Trusted providers and official institutional TLDs
  if (
    TRUSTED_DOMAINS.has(cleanDomain) ||
    cleanDomain.endsWith('.edu') ||
    cleanDomain.endsWith('.ac.bd') ||
    cleanDomain.endsWith('.gov') ||
    cleanDomain.endsWith('.gov.bd') ||
    cleanDomain.endsWith('.mil')
  ) {
    return { isValid: true };
  }

  // Check cache
  const cached = dnsCache.get(cleanDomain);
  if (cached && cached.expiresAt > Date.now()) {
    return { isValid: cached.isValid, error: cached.error };
  }

  // Helper with DNS timeout (3500ms)
  const runWithTimeout = <T>(promise: Promise<T>, timeoutMs = 3500): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => {
          const timeoutErr: any = new Error('DNS query timed out');
          timeoutErr.code = 'ETIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
  };

  try {
    // 1. Check MX records
    let hasValidMx = false;
    try {
      const mxRecords = await runWithTimeout(dns.resolveMx(cleanDomain));
      if (Array.isArray(mxRecords) && mxRecords.length > 0) {
        // Filter out RFC 7505 Null MX (exchange = '' or '.')
        const activeExchanges = mxRecords.filter((r) => r.exchange && r.exchange !== '.');
        if (activeExchanges.length > 0) {
          hasValidMx = true;
        }
      }
    } catch (mxErr: any) {
      // If temporary network/timeout error, proceed gracefully
      if (mxErr.code !== 'ENODATA' && mxErr.code !== 'ENOTFOUND' && mxErr.code !== 'NXDOMAIN') {
        console.warn(`[EmailValidation] Transient DNS MX lookup warning for "${cleanDomain}": ${mxErr.code || mxErr.message}. Allowing gracefully.`);
        return { isValid: true };
      }
    }

    if (hasValidMx) {
      dnsCache.set(cleanDomain, { isValid: true, expiresAt: Date.now() + DNS_CACHE_TTL_MS });
      return { isValid: true };
    }

    // 2. RFC 5321 Implicit MX Fallback: Check A (IPv4) or AAAA (IPv6) records
    let hasHostRecord = false;
    let definiteNotFound = false;

    try {
      const aRecords = await runWithTimeout(dns.resolve4(cleanDomain));
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        hasHostRecord = true;
      }
    } catch (aErr: any) {
      if (aErr.code === 'ENOTFOUND' || aErr.code === 'NXDOMAIN') {
        definiteNotFound = true;
      } else if (aErr.code !== 'ENODATA') {
        console.warn(`[EmailValidation] Transient DNS A lookup warning for "${cleanDomain}": ${aErr.code || aErr.message}. Allowing gracefully.`);
        return { isValid: true };
      }
    }

    if (!hasHostRecord) {
      try {
        const aaaaRecords = await runWithTimeout(dns.resolve6(cleanDomain));
        if (Array.isArray(aaaaRecords) && aaaaRecords.length > 0) {
          hasHostRecord = true;
        }
      } catch (aaaaErr: any) {
        if (aaaaErr.code === 'ENOTFOUND' || aaaaErr.code === 'NXDOMAIN') {
          definiteNotFound = true;
        } else if (aaaaErr.code !== 'ENODATA') {
          return { isValid: true };
        }
      }
    }

    if (hasHostRecord) {
      dnsCache.set(cleanDomain, { isValid: true, expiresAt: Date.now() + DNS_CACHE_TTL_MS });
      return { isValid: true };
    }

    // Both MX and A/AAAA lookups failed
    const errorMsg = definiteNotFound
      ? `The email domain "${cleanDomain}" does not exist. Please check the spelling of your email address.`
      : `The email domain "${cleanDomain}" has no valid mail exchanger (MX) or host records to receive mail.`;

    dnsCache.set(cleanDomain, { isValid: false, error: errorMsg, expiresAt: Date.now() + DNS_CACHE_TTL_MS });
    return { isValid: false, error: errorMsg };
  } catch (err: any) {
    // Graceful fallback on unexpected errors
    console.warn(`[EmailValidation] Unexpected DNS error for "${cleanDomain}": ${err.message}. Allowing gracefully.`);
    return { isValid: true };
  }
}

/**
 * Synchronous pre-validation: format and disposable domain checks.
 */
export function validateSignupEmail(email: string, isBangla: boolean = false): {
  isValid: boolean;
  normalizedEmail: string;
  domain: string;
  error?: string;
} {
  const formatResult = validateEmailFormat(email);
  const normalized = normalizeEmail(email);

  if (!formatResult.isValid) {
    return {
      isValid: false,
      normalizedEmail: normalized.email,
      domain: normalized.domain,
      error: formatResult.error,
    };
  }

  if (isDisposableEmail(normalized.domain)) {
    return {
      isValid: false,
      normalizedEmail: normalized.email,
      domain: normalized.domain,
      error: isBangla
        ? 'সাময়িক বা ডিসপোজেবল ইমেইল দিয়ে অ্যাকাউন্ট তৈরি করা যাবে না। অনুগ্রহ করে স্থায়ী ব্যক্তিগত বা অফিশিয়াল ইমেইল ব্যবহার করুন।'
        : 'Disposable and temporary email addresses are not permitted. Please use a permanent personal or work email address.',
    };
  }

  return {
    isValid: true,
    normalizedEmail: normalized.email,
    domain: normalized.domain,
  };
}

/**
 * Full asynchronous email verification: format, disposable domain blocklist, and DNS MX/A validation.
 */
export async function validateSignupEmailAsync(
  email: string,
  isBangla: boolean = false
): Promise<{
  isValid: boolean;
  normalizedEmail: string;
  domain: string;
  error?: string;
}> {
  // 1. Synchronous structural and disposable check
  const syncResult = validateSignupEmail(email, isBangla);
  if (!syncResult.isValid) {
    return syncResult;
  }

  // 2. Asynchronous DNS MX/A record validation
  const dnsResult = await validateEmailDomainDns(syncResult.domain);
  if (!dnsResult.isValid) {
    return {
      isValid: false,
      normalizedEmail: syncResult.normalizedEmail,
      domain: syncResult.domain,
      error: dnsResult.error,
    };
  }

  return {
    isValid: true,
    normalizedEmail: syncResult.normalizedEmail,
    domain: syncResult.domain,
  };
}
