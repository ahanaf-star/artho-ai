/**
 * Shared Gemini Configuration and Approved Models
 *
 * Supported models for text-based financial coaching and structured generation:
 * - gemini-3.8-flash: Primary high-efficiency production model with advanced structured output support
 * - gemini-flash-latest: Stable alias for current Flash release
 * - gemini-3.5-flash-lite: Fast, low-latency, lightweight fallback
 * - gemini-3.1-flash-lite: Secondary lightweight fallback
 */

export const APPROVED_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

export type ApprovedGeminiModel = (typeof APPROVED_GEMINI_MODELS)[number];

export const PRIMARY_GEMINI_MODEL: ApprovedGeminiModel = APPROVED_GEMINI_MODELS[0];

/**
 * Validates whether an API key is configured and not an obvious placeholder.
 * Avoids brittle length-only or prefix-only checks so that keys of varying lengths (e.g. 39, 53 chars)
 * or prefixes are allowed to attempt legitimate API requests.
 */
export function isConfiguredApiKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 10) return false;

  const placeholderPatterns = [
    'your_gemini_api_key',
    'your_google_gemini_api_key',
    'your_api_key_here',
    'placeholder',
    'replace_me',
    'insert_key_here',
    'dummy_key',
  ];

  return !placeholderPatterns.some((pattern) => trimmed.toLowerCase().includes(pattern));
}

