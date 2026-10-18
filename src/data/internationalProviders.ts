/**
 * International Banking, Mobile Money, and Financial Provider Directory
 * Country-independent directory for Artho AI with ISO 3166-1 alpha-2 country codes
 * and ISO 4217 currency defaults.
 */

export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2 (e.g. 'BD', 'US', 'GB')
  name: string;
  flag: string;
  defaultCurrency: string; // ISO 4217 (e.g. 'BDT', 'USD', 'GBP')
  providersByType: {
    'Bank Account'?: string[];
    'Mobile Money / Digital Wallet'?: string[];
    'Cash'?: string[];
    'Other Financial Account'?: string[];
  };
}

export const INTERNATIONAL_ACCOUNT_TYPES = [
  'Bank Account',
  'Mobile Money / Digital Wallet',
  'Cash',
  'Other Financial Account',
] as const;

export type AccountTypeName = (typeof INTERNATIONAL_ACCOUNT_TYPES)[number];

const DEFAULT_CASH_PROVIDERS = [
  'Physical Cash Wallet',
  'Petty Cash',
  'Home Cash Reserve',
  'Travel Cash Envelope',
];

const DEFAULT_OTHER_PROVIDERS = [
  'Brokerage / Investment Account',
  'Retirement / Pension Account',
  'Mutual Fund / Unit Trust',
  'Precious Metals Vault',
  'Cooperative / Credit Union',
];

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'BD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    defaultCurrency: 'BDT',
    providersByType: {
      'Mobile Money / Digital Wallet': [
        'bKash',
        'Nagad',
        'Rocket (DBBL)',
        'Upay (UCB)',
        'SureCash',
        'Cellfin (IBBL)',
        'Tap',
        'mCash (Islami Bank)',
      ],
      'Bank Account': [
        'City Bank',
        'BRAC Bank',
        'Dutch-Bangla Bank (DBBL)',
        'Islami Bank Bangladesh (IBBL)',
        'Eastern Bank (EBL)',
        'Sonali Bank',
        'Dhaka Bank',
        'Standard Chartered Bangladesh',
        'Mutual Trust Bank (MTB)',
        'United Commercial Bank (UCB)',
        'Pubali Bank',
        'Prime Bank',
        'Bank Asia',
        'Trust Bank',
        'Janata Bank',
        'Agrani Bank',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'National Savings Certificate (Sanchayapatra)',
        'High-Yield DPS Vault',
        'Microfinance Account (Grameen / BRAC)',
        'Shariah Investment Vault',
      ],
    },
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    defaultCurrency: 'USD',
    providersByType: {
      'Bank Account': [
        'JPMorgan Chase',
        'Bank of America',
        'Wells Fargo',
        'Citibank',
        'Capital One',
        'U.S. Bank',
        'PNC Bank',
        'Truist Financial',
        'Fidelity Cash Management',
        'Charles Schwab Bank',
        'Ally Bank',
        'Marcus by Goldman Sachs',
      ],
      'Mobile Money / Digital Wallet': [
        'Venmo',
        'PayPal',
        'Cash App',
        'Apple Cash',
        'Zelle',
        'Google Pay',
        'Wise (US Dollar)',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Vanguard Brokerage',
        'Fidelity Investment',
        'Charles Schwab Brokerage',
        'Robinhood',
        'Health Savings Account (HSA)',
        'Traditional / Roth IRA',
        '401(k) Account',
      ],
    },
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    defaultCurrency: 'GBP',
    providersByType: {
      'Bank Account': [
        'Barclays',
        'HSBC UK',
        'Lloyds Bank',
        'NatWest',
        'Santander UK',
        'Monzo Bank',
        'Revolut',
        'Starling Bank',
        'Halifax',
        'Nationwide Building Society',
        'TSB Bank',
      ],
      'Mobile Money / Digital Wallet': [
        'PayPal UK',
        'Revolut Wallet',
        'Wise (GBP)',
        'Apple Pay',
        'Google Wallet',
        'Skrill',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Stocks & Shares ISA',
        'Cash ISA',
        'Premium Bonds (NS&I)',
        'Hargreaves Lansdown',
        'Interactive Investor',
      ],
    },
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    defaultCurrency: 'EUR',
    providersByType: {
      'Bank Account': [
        'Deutsche Bank',
        'Commerzbank',
        'N26',
        'Sparkasse',
        'ING Germany',
        'DKB (Deutsche Kreditbank)',
        'Postbank',
        'Volksbanken Raiffeisenbanken',
      ],
      'Mobile Money / Digital Wallet': [
        'PayPal Germany',
        'Trade Republic Cash',
        'Revolut',
        'Apple Pay',
        'Google Pay',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Trade Republic Brokerage',
        'Scalable Capital',
        'Flatex',
      ],
    },
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    defaultCurrency: 'EUR',
    providersByType: {
      'Bank Account': [
        'BNP Paribas',
        'Crédit Agricole',
        'Société Générale',
        'BoursoBank',
        'BPCE (Banque Populaire)',
        'Crédit Mutuel',
        'LCL',
        'La Banque Postale',
      ],
      'Mobile Money / Digital Wallet': [
        'Lydia',
        'PayPal France',
        'Revolut',
        'Apple Pay',
        'Paylib',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Livret A Savings',
        'Plan d’Épargne en Actions (PEA)',
        'Assurance-Vie',
      ],
    },
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    defaultCurrency: 'INR',
    providersByType: {
      'Mobile Money / Digital Wallet': [
        'PhonePe',
        'Google Pay (Tez)',
        'Paytm',
        'Amazon Pay',
        'BHIM UPI',
        'MobiKwik',
      ],
      'Bank Account': [
        'State Bank of India (SBI)',
        'HDFC Bank',
        'ICICI Bank',
        'Axis Bank',
        'Kotak Mahindra Bank',
        'Punjab National Bank (PNB)',
        'Bank of Baroda',
        'Canara Bank',
        'IndusInd Bank',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Public Provident Fund (PPF)',
        'Post Office Savings Account',
        'Zerodha Coin / Kite',
        'Groww Investment',
        'National Pension System (NPS)',
      ],
    },
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    defaultCurrency: 'CAD',
    providersByType: {
      'Bank Account': [
        'RBC Royal Bank',
        'TD Canada Trust',
        'Scotiabank',
        'BMO Bank of Montreal',
        'CIBC',
        'Tangerine Bank',
        'EQ Bank',
        'National Bank of Canada',
        'Desjardins',
      ],
      'Mobile Money / Digital Wallet': [
        'Interac e-Transfer',
        'Wealthsimple Cash',
        'PayPal Canada',
        'Apple Pay',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Tax-Free Savings Account (TFSA)',
        'Registered Retirement Savings Plan (RRSP)',
        'Questrade Brokerage',
        'Wealthsimple Trade',
      ],
    },
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    defaultCurrency: 'AUD',
    providersByType: {
      'Bank Account': [
        'Commonwealth Bank (CBA)',
        'Westpac',
        'ANZ (Australia & New Zealand Banking)',
        'National Australia Bank (NAB)',
        'Macquarie Bank',
        'Up Bank',
        'ING Australia',
        'Bendigo Bank',
        'Suncorp Bank',
      ],
      'Mobile Money / Digital Wallet': [
        'Beem',
        'PayPal Australia',
        'Wise (AUD)',
        'Apple Pay',
        'Google Wallet',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Superannuation Account',
        'CommSec Brokerage',
        'Stake Investment',
        'Betashares Direct',
      ],
    },
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    defaultCurrency: 'SAR',
    providersByType: {
      'Bank Account': [
        'Al Rajhi Bank',
        'Saudi National Bank (SNB / AlAhli)',
        'Riyad Bank',
        'Alinma Bank',
        'Saudi Awwal Bank (SAB)',
        'Banque Saudi Fransi',
        'Arab National Bank (ANB)',
        'Bank AlJazira',
      ],
      'Mobile Money / Digital Wallet': [
        'STC Pay',
        'Urpay (Al Rajhi)',
        'Tiqmo',
        'Apple Pay KSA',
        'Mada Pay',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Derayah Financial',
        'SNB Capital Investment',
        'Al Rajhi Capital',
      ],
    },
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    defaultCurrency: 'AED',
    providersByType: {
      'Bank Account': [
        'Emirates NBD',
        'Abu Dhabi Commercial Bank (ADCB)',
        'First Abu Dhabi Bank (FAB)',
        'Mashreq Bank',
        'Dubai Islamic Bank (DIB)',
        'Abu Dhabi Islamic Bank (ADIB)',
        'Standard Chartered UAE',
      ],
      'Mobile Money / Digital Wallet': [
        'Careem Pay',
        'e& money',
        'Liv. by Emirates NBD',
        'Klip Digital Wallet',
        'Apple Pay UAE',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'National Bonds UAE',
        'Sarwa Investment',
        'Wio Personal Investment',
      ],
    },
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    defaultCurrency: 'SGD',
    providersByType: {
      'Bank Account': [
        'DBS Bank / POSB',
        'OCBC Bank',
        'United Overseas Bank (UOB)',
        'Standard Chartered Singapore',
        'Trust Bank',
        'Citibank Singapore',
        'MariBank',
      ],
      'Mobile Money / Digital Wallet': [
        'PayNow',
        'GrabPay',
        'Singtel Dash',
        'FavePay',
        'Apple Pay',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Central Provident Fund (CPF)',
        'Singapore Savings Bonds (SSB)',
        'Endowus Investment',
        'Syfe Wealth',
      ],
    },
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    defaultCurrency: 'JPY',
    providersByType: {
      'Bank Account': [
        'Mitsubishi UFJ Financial (MUFG)',
        'Sumitomo Mitsui Banking (SMBC)',
        'Mizuho Bank',
        'Japan Post Bank (Yucho)',
        'Rakuten Bank',
        'SBI Shinsei Bank',
        'Sony Bank',
      ],
      'Mobile Money / Digital Wallet': [
        'PayPay',
        'Line Pay',
        'Rakuten Pay',
        'Mobile Suica / Pasmo',
        'Merpay',
        'd Barai',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'NISA Investment Account',
        'iDeCo Pension Account',
        'SBI Securities',
        'Rakuten Securities',
      ],
    },
  },
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    defaultCurrency: 'CNY',
    providersByType: {
      'Bank Account': [
        'Industrial and Commercial Bank of China (ICBC)',
        'China Construction Bank (CCB)',
        'Agricultural Bank of China (ABC)',
        'Bank of China (BOC)',
        'Bank of Communications (BOCOM)',
        'China Merchants Bank (CMB)',
      ],
      'Mobile Money / Digital Wallet': [
        'Alipay (Ant Group)',
        'WeChat Pay (Tencent)',
        'UnionPay QuickPass',
        'Digital RMB (e-CNY)',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Yu’e Bao Money Market',
        'China Postal Savings',
      ],
    },
  },
  {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    defaultCurrency: 'CHF',
    providersByType: {
      'Bank Account': [
        'UBS Switzerland',
        'PostFinance',
        'Raiffeisen Switzerland',
        'Zürcher Kantonalbank (ZKB)',
        'Banque Cantonale de Genève',
        'Neon Banking',
        'Yuh App',
      ],
      'Mobile Money / Digital Wallet': [
        'TWINT',
        'Revolut Switzerland',
        'Apple Pay',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Swiss Pillar 3a Account',
        'Selly / VIAC 3a',
        'Swissquote Brokerage',
      ],
    },
  },
  {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    defaultCurrency: 'MYR',
    providersByType: {
      'Bank Account': [
        'Maybank',
        'CIMB Bank',
        'Public Bank Berhad',
        'RHB Bank',
        'Hong Leong Bank',
        'AmBank',
      ],
      'Mobile Money / Digital Wallet': [
        'Touch n Go eWallet',
        'GrabPay Malaysia',
        'Boost',
        'DuitNow QR',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Amanah Saham Bumiputera (ASB)',
        'Employees Provident Fund (EPF)',
        'StashAway Malaysia',
      ],
    },
  },
  {
    code: 'PK',
    name: 'Pakistan',
    flag: '🇵🇰',
    defaultCurrency: 'PKR',
    providersByType: {
      'Mobile Money / Digital Wallet': [
        'Easypaisa',
        'JazzCash',
        'NayaPay',
        'SadaPay',
        'Raast Instant Payment',
      ],
      'Bank Account': [
        'Habib Bank Limited (HBL)',
        'Meezan Bank',
        'United Bank Limited (UBL)',
        'MCB Bank',
        'Allied Bank Limited (ABL)',
        'Bank Alfalah',
        'National Bank of Pakistan (NBP)',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'National Savings Schemes (Qaumi Bachat)',
        'CDC Sub-Account / PSX',
      ],
    },
  },
  {
    code: 'KE',
    name: 'Kenya',
    flag: '🇰🇪',
    defaultCurrency: 'KES',
    providersByType: {
      'Mobile Money / Digital Wallet': [
        'M-Pesa (Safaricom)',
        'Airtel Money Kenya',
        'T-Kash (Telkom)',
      ],
      'Bank Account': [
        'KCB Bank Kenya',
        'Equity Bank',
        'Co-operative Bank of Kenya',
        'NCBA Bank',
        'Standard Chartered Kenya',
        'Stanbic Bank',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'M-Shwari Savings',
        'KCB M-Pesa Vault',
        'Chama Cooperative Vault',
      ],
    },
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    defaultCurrency: 'NGN',
    providersByType: {
      'Mobile Money / Digital Wallet': [
        'OPay',
        'PalmPay',
        'Moniepoint',
        'Kuda Bank Wallet',
        'Paga',
      ],
      'Bank Account': [
        'Access Bank',
        'Zenith Bank',
        'Guaranty Trust Bank (GTBank)',
        'First Bank of Nigeria',
        'United Bank for Africa (UBA)',
        'Fidelity Bank',
        'Stanbic IBTC Bank',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'PiggyVest SafeLock',
        'Cowrywise Savings',
        'Bamboo Investment',
      ],
    },
  },
  {
    code: 'GLOBAL',
    name: 'International / Other Region',
    flag: '🌐',
    defaultCurrency: 'USD',
    providersByType: {
      'Bank Account': [
        'Wise Multi-Currency Account',
        'Revolut Global',
        'Payoneer Global Bank',
        'HSBC Expat',
        'Standard Chartered International',
        'N26 Global',
      ],
      'Mobile Money / Digital Wallet': [
        'PayPal Global',
        'Apple Cash',
        'Google Wallet',
        'Skrill International',
        'Neteller',
        'Binance Pay / Web3 Wallet',
      ],
      'Cash': DEFAULT_CASH_PROVIDERS,
      'Other Financial Account': [
        'Interactive Brokers (IBKR)',
        'eToro Global',
        'Precious Metals Vault',
        'Offshore Savings Vault',
      ],
    },
  },
];

export const COUNTRY_MAP = new Map<string, CountryInfo>(
  COUNTRIES.map((c) => [c.code.toUpperCase(), c])
);

/**
 * Retrieve CountryInfo by ISO alpha-2 code or fallback to Bangladesh
 */
export function getCountryByCode(code?: string): CountryInfo {
  if (!code) return COUNTRIES[0];
  const normalized = code.trim().toUpperCase();
  return COUNTRY_MAP.get(normalized) || COUNTRIES[0];
}

/**
 * Retrieve curated list of providers for a given country and account type.
 * Always includes the standard cash / other providers and a custom provider fallback.
 */
export function getProvidersForCountryAndType(
  countryCode: string = 'BD',
  accountType: string = 'Bank Account'
): string[] {
  const country = getCountryByCode(countryCode);

  // Normalize legacy account type if needed
  let normalizedType: AccountTypeName = 'Bank Account';
  if (accountType === 'Mobile Financial Service (MFS)' || accountType === 'Mobile Money / Digital Wallet') {
    normalizedType = 'Mobile Money / Digital Wallet';
  } else if (accountType === 'Cash') {
    normalizedType = 'Cash';
  } else if (accountType === 'Other Financial Account') {
    normalizedType = 'Other Financial Account';
  }

  const providers = country.providersByType[normalizedType] || [];
  return [...providers];
}

/**
 * Search countries by name, code, or currency
 */
export function searchCountries(query: string): CountryInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.defaultCurrency.toLowerCase().includes(q)
  );
}
