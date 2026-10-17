/**
 * Centralized Multi-Currency Service for ArthoBachao AI
 * 
 * Supports 11 ISO 4217 currencies:
 * 1. Bangladeshi Taka — BDT (৳) (Default)
 * 2. US Dollar — USD ($)
 * 3. Euro — EUR (€)
 * 4. Pound Sterling — GBP (£)
 * 5. Japanese Yen — JPY (¥)
 * 6. Chinese Yuan — CNY (¥)
 * 7. Swiss Franc — CHF
 * 8. Indian Rupee — INR (₹)
 * 9. Canadian Dollar — CAD (C$)
 * 10. Australian Dollar — AUD (A$)
 * 11. Saudi Riyal — SAR
 */

export interface CurrencyConfig {
  code: string; // ISO 4217
  name: string;
  nameBn: string;
  symbol: string;
  displaySymbol: string;
  locale: string;
  fractionDigits: number; // JPY: 0, others: 2
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    code: 'BDT',
    name: 'Bangladeshi Taka',
    nameBn: 'Bangladeshi Taka',
    symbol: '৳',
    displaySymbol: '৳',
    locale: 'en-IN',
    fractionDigits: 2,
    flag: '🇧🇩',
  },
  {
    code: 'USD',
    name: 'US Dollar',
    nameBn: 'US Dollar',
    symbol: '$',
    displaySymbol: '$',
    locale: 'en-US',
    fractionDigits: 2,
    flag: '🇺🇸',
  },
  {
    code: 'EUR',
    name: 'Euro',
    nameBn: 'Euro',
    symbol: '€',
    displaySymbol: '€',
    locale: 'de-DE',
    fractionDigits: 2,
    flag: '🇪🇺',
  },
  {
    code: 'GBP',
    name: 'British Pound',
    nameBn: 'British Pound',
    symbol: '£',
    displaySymbol: '£',
    locale: 'en-GB',
    fractionDigits: 2,
    flag: '🇬🇧',
  },
  {
    code: 'JPY',
    name: 'Japanese Yen',
    nameBn: 'Japanese Yen',
    symbol: '¥',
    displaySymbol: '¥',
    locale: 'ja-JP',
    fractionDigits: 0,
    flag: '🇯🇵',
  },
  {
    code: 'CNY',
    name: 'Chinese Yuan',
    nameBn: 'Chinese Yuan',
    symbol: '¥',
    displaySymbol: '¥',
    locale: 'zh-CN',
    fractionDigits: 2,
    flag: '🇨🇳',
  },
  {
    code: 'CHF',
    name: 'Swiss Franc',
    nameBn: 'Swiss Franc',
    symbol: 'CHF',
    displaySymbol: 'CHF',
    locale: 'de-CH',
    fractionDigits: 2,
    flag: '🇨🇭',
  },
  {
    code: 'INR',
    name: 'Indian Rupee',
    nameBn: 'Indian Rupee',
    symbol: '₹',
    displaySymbol: '₹',
    locale: 'en-IN',
    fractionDigits: 2,
    flag: '🇮🇳',
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    nameBn: 'Canadian Dollar',
    symbol: 'C$',
    displaySymbol: 'C$',
    locale: 'en-CA',
    fractionDigits: 2,
    flag: '🇨🇦',
  },
  {
    code: 'AUD',
    name: 'Australian Dollar',
    nameBn: 'Australian Dollar',
    symbol: 'A$',
    displaySymbol: 'A$',
    locale: 'en-AU',
    fractionDigits: 2,
    flag: '🇦🇺',
  },
  {
    code: 'SAR',
    name: 'Saudi Riyal',
    nameBn: 'Saudi Riyal',
    symbol: 'SAR',
    displaySymbol: 'SAR',
    locale: 'ar-SA',
    fractionDigits: 2,
    flag: '🇸🇦',
  },
];

export const CURRENCY_MAP = new Map<string, CurrencyConfig>(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

export const DEFAULT_CURRENCY_CODE = 'BDT';

// Baseline fallback rates with BDT as base
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  BDT: 1,
  USD: 0.008127,
  EUR: 0.007232,
  GBP: 0.0061,
  JPY: 1.284028,
  CNY: 0.054441,
  CHF: 0.006702,
  INR: 0.772359,
  CAD: 0.0115,
  AUD: 0.011703,
  SAR: 0.030478,
};

export interface ExchangeRatesState {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
  timestamp: number;
  provider: string;
  stale?: boolean;
}

let activeRates: ExchangeRatesState = {
  base: 'BDT',
  rates: { ...DEFAULT_EXCHANGE_RATES },
  lastUpdated: 'Sat, 17 Oct 2026 00:02:32 +0000',
  timestamp: 1792195352,
  provider: 'ExchangeRate-API',
};

const STORAGE_RATES_KEY = 'arthobachao_exchange_rates';

/**
 * Normalizes legacy symbols (৳, $, €) or invalid codes to a canonical ISO 4217 code
 */
export function normalizeCurrencyCode(raw?: string | null): string {
  if (!raw) return DEFAULT_CURRENCY_CODE;
  const clean = raw.trim();

  if (clean === '৳' || clean === 'TK' || clean === 'BDT') return 'BDT';
  if (clean === '$' || clean === 'USD') return 'USD';
  if (clean === '€' || clean === 'EUR') return 'EUR';
  if (clean === '£' || clean === 'GBP') return 'GBP';
  if (clean === '₹' || clean === 'INR') return 'INR';
  if (clean === 'C$' || clean === 'CAD') return 'CAD';
  if (clean === 'A$' || clean === 'AUD') return 'AUD';

  const upper = clean.toUpperCase();
  if (CURRENCY_MAP.has(upper)) {
    return upper;
  }

  return DEFAULT_CURRENCY_CODE;
}

/**
 * Check if raw string is a valid supported currency code or alias
 */
export function isValidCurrencyCode(code?: string | null): boolean {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase();
  const validAliases = ['৳', 'TK', '$', '€', '£', '¥', '₹', 'C$', 'A$'];
  return CURRENCY_MAP.has(clean) || validAliases.includes(code.trim());
}

/**
 * Convert and aggregate transaction list amounts to a target display currency
 */
export function aggregateTransactionAmounts(
  transactions: Array<{ amount: number; currency?: string; type?: string }>,
  targetCurrency: string = 'BDT',
  customRates?: Record<string, number>
): { totalIncome: number; totalExpenses: number; netTotal: number } {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    const txCurrency = tx.currency || 'BDT';
    const converted = convertAmount(tx.amount, txCurrency, targetCurrency, customRates);
    if (tx.type === 'income') {
      totalIncome += converted;
    } else if (tx.type === 'expense') {
      totalExpenses += converted;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netTotal: totalIncome - totalExpenses,
  };
}

/**
 * Get currency configuration by code
 */
export function getCurrencyConfig(code?: string): CurrencyConfig {
  const norm = normalizeCurrencyCode(code);
  return CURRENCY_MAP.get(norm) || SUPPORTED_CURRENCIES[0];
}

/**
 * Fetch latest exchange rates from backend API
 */
export async function fetchExchangeRates(): Promise<ExchangeRatesState> {
  try {
    const res = await fetch('/api/exchange-rates');
    if (res.ok) {
      const data: ExchangeRatesState = await res.json();
      if (data && data.rates && typeof data.rates === 'object') {
        activeRates = data;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_RATES_KEY, JSON.stringify(data));
          }
        } catch {
          // Ignore storage errors
        }
        return activeRates;
      }
    }
  } catch (err) {
    console.warn('[currencyService] Failed fetching exchange rates from backend:', err);
  }

  // Try reading from localStorage cache
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_RATES_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.rates) {
          activeRates = { ...parsed, stale: true };
          return activeRates;
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return activeRates;
}

/**
 * Get currently loaded exchange rates
 */
export function getLoadedRates(): ExchangeRatesState {
  return activeRates;
}

/**
 * Convert an amount between any two currencies using current rates
 * Base currency is BDT:
 * - 1 BDT = rates[code] units of `code`
 * - amount in BDT = amount / rates[fromCode]
 * - result in toCode = amountInBDT * rates[toCode]
 */
export function convertAmount(
  amount: number,
  fromCode: string = 'BDT',
  toCode: string = 'BDT',
  customRates?: Record<string, number>
): number {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  if (amount === 0) return 0;

  const from = normalizeCurrencyCode(fromCode);
  const to = normalizeCurrencyCode(toCode);

  if (from === to) return amount;

  const rates = customRates || activeRates.rates || DEFAULT_EXCHANGE_RATES;
  const rateFrom = rates[from];
  const rateTo = rates[to];

  if (!rateFrom || !rateTo || rateFrom <= 0 || rateTo <= 0) {
    console.warn(`[currencyService] Rate missing for conversion from ${from} to ${to}`);
    return amount;
  }

  // Convert to common base (BDT), then to target
  const amountInBDT = from === 'BDT' ? amount : amount / rateFrom;
  const result = to === 'BDT' ? amountInBDT : amountInBDT * rateTo;

  return result;
}

export interface FormatCurrencyOptions {
  decimals?: number;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  showCode?: boolean;
  isBangla?: boolean;
  roundWhole?: boolean; // When true and value has no cents, omit decimals
}

/**
 * Centralized formatting utility for monetary values
 */
export function formatCurrency(
  amount: number,
  currencyCode?: string,
  options: FormatCurrencyOptions = {}
): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    amount = 0;
  }

  const code = normalizeCurrencyCode(currencyCode);
  const config = getCurrencyConfig(code);

  const isWhole = Math.abs(amount % 1) < 0.001;
  const defaultDecimals = config.fractionDigits;
  const maxDec =
    options.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : options.decimals !== undefined
      ? options.decimals
      : options.roundWhole && isWhole
      ? 0
      : code === 'BDT'
      ? 0 // BDT is traditionally rounded to whole taka in dashboard
      : defaultDecimals;

  const minDec =
    options.minimumFractionDigits !== undefined
      ? options.minimumFractionDigits
      : options.maximumFractionDigits !== undefined
      ? 0
      : maxDec;

  // Use Intl.NumberFormat with appropriate locale
  let formattedNumber: string;
  try {
    formattedNumber = new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    }).format(Math.abs(amount));
  } catch {
    formattedNumber = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    });
  }

  const sign = amount < 0 ? '-' : '';

  // Specific symbol positioning
  let symbolWithAmount: string;
  switch (code) {
    case 'BDT':
      symbolWithAmount = `৳${formattedNumber}`;
      break;
    case 'USD':
      symbolWithAmount = `$${formattedNumber}`;
      break;
    case 'EUR':
      symbolWithAmount = `€${formattedNumber}`;
      break;
    case 'GBP':
      symbolWithAmount = `£${formattedNumber}`;
      break;
    case 'JPY':
      symbolWithAmount = `¥${formattedNumber}`;
      break;
    case 'CNY':
      symbolWithAmount = `¥${formattedNumber}`;
      break;
    case 'CHF':
      symbolWithAmount = `CHF ${formattedNumber}`;
      break;
    case 'INR':
      symbolWithAmount = `₹${formattedNumber}`;
      break;
    case 'CAD':
      symbolWithAmount = `C$${formattedNumber}`;
      break;
    case 'AUD':
      symbolWithAmount = `A$${formattedNumber}`;
      break;
    case 'SAR':
      symbolWithAmount = `SAR ${formattedNumber}`;
      break;
    default:
      symbolWithAmount = `${config.symbol}${formattedNumber}`;
      break;
  }

  const fullDisplay = `${sign}${symbolWithAmount}`;
  if (options.showCode && code !== 'CHF' && code !== 'SAR') {
    return `${fullDisplay} ${code}`;
  }

  return fullDisplay;
}

/**
 * Backward-compatible helper for BDT formatting
 */
export function formatBDT(amount: number): string {
  return formatCurrency(amount, 'BDT');
}

