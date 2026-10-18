/**
 * Trims leading/trailing whitespace and surrounding single or double quotes
 * from environment variable strings.
 */
export function cleanEnvValue(val?: string | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Parses an RFC 2822 sender string like "Artho AI <support@arthoai.com>" or "support@arthoai.com"
 * into a structured { name, email } object.
 */
export function parseSenderAddress(senderStr: string, fallbackEmail = 'noreply@arthoai.com'): { name: string; email: string } {
  const clean = cleanEnvValue(senderStr);
  if (!clean) {
    return { name: 'Artho AI', email: fallbackEmail };
  }

  const match = clean.match(/^(?:(.*)<)?([^<>]+)>?$/);
  if (match) {
    const rawName = match[1]?.trim().replace(/^["']+|["']+$/g, '').trim();
    const rawEmail = match[2]?.trim();
    return {
      name: rawName || 'Artho AI',
      email: rawEmail || fallbackEmail,
    };
  }

  return { name: 'Artho AI', email: clean };
}

/**
 * Sanitizes error messages by stripping secrets, tokens, or app passwords.
 */
export function sanitizeEmailError(errorStr: string): string {
  if (!errorStr) return 'Unknown email dispatch error';
  return errorStr
    .replace(/[a-zA-Z0-9]{16}/g, '****')
    .replace(/xkeysib-[a-zA-Z0-9_\-\.]+/gi, 'xkeysib-****')
    .replace(/re_[a-zA-Z0-9_\-\.]+/gi, 're_****')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ****');
}

