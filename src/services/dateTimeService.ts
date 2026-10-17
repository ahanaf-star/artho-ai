import { useState, useEffect } from 'react';

/**
 * Interface for timestamp formatting options
 */
export interface FormatTimestampOptions {
  timeZone?: string;
  locale?: string;
  isBangla?: boolean;
  hour12?: boolean;
  referenceDate?: Date; // Optional reference Date for deterministic testing
}

/**
 * Curated timezone option for UI selectors
 */
export interface TimeZoneOption {
  value: string;
  label: string;
  city: string;
}

/**
 * List of common curated international timezones
 */
export const COMMON_TIMEZONES: TimeZoneOption[] = [
  { value: 'Asia/Dhaka', label: 'Dhaka (GMT+6)', city: 'Dhaka' },
  { value: 'Asia/Kolkata', label: 'Kolkata, Mumbai, New Delhi (GMT+5:30)', city: 'Kolkata' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi (GMT+4)', city: 'Dubai' },
  { value: 'Asia/Riyadh', label: 'Riyadh, Jeddah (GMT+3)', city: 'Riyadh' },
  { value: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (GMT+8)', city: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Osaka (GMT+9)', city: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Beijing, Shanghai (GMT+8)', city: 'Shanghai' },
  { value: 'Europe/London', label: 'London, Edinburgh (GMT/BST)', city: 'London' },
  { value: 'Europe/Paris', label: 'Paris, Frankfurt, Amsterdam (CET/CEST)', city: 'Paris' },
  { value: 'Europe/Zurich', label: 'Zurich, Geneva (CET/CEST)', city: 'Zurich' },
  { value: 'America/New_York', label: 'New York, Toronto, Montreal (ET)', city: 'New York' },
  { value: 'America/Chicago', label: 'Chicago, Dallas, Austin (CT)', city: 'Chicago' },
  { value: 'America/Denver', label: 'Denver, Calgary (MT)', city: 'Denver' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, San Francisco, Vancouver (PT)', city: 'Los Angeles' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST/AEDT)', city: 'Sydney' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', city: 'UTC' },
];

/**
 * Detect browser's native IANA timezone
 */
export function detectUserTimeZone(): string {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved && isValidTimeZone(resolved)) {
        return resolved;
      }
    }
  } catch {
    // Ignore error
  }
  return 'UTC';
}

/**
 * Test whether a given timezone identifier is supported by Intl
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely resolve a valid timezone, falling back to browser detection or UTC
 */
export function resolveTimeZone(preferredTimeZone?: string | null): string {
  if (preferredTimeZone && isValidTimeZone(preferredTimeZone)) {
    return preferredTimeZone;
  }
  return detectUserTimeZone();
}

/**
 * Convert western Arabic digits to Bengali digits
 */
export function toBanglaDigits(val: number | string): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/[0-9]/g, (digit) => banglaDigits[Number(digit)]);
}

/**
 * Get calendar day string 'YYYY-MM-DD' for a date in a specific timezone
 */
export function getCalendarDateString(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Format time of day in specific timezone
 */
export function formatTimeOfDay(
  date: Date,
  options: {
    timeZone: string;
    locale: string;
    hour12?: boolean;
    isBangla?: boolean;
  }
): string {
  const { timeZone, locale, hour12 = false, isBangla = false } = options;
  try {
    const targetLocale = isBangla ? 'bn-BD' : locale || 'en-GB';
    const formatter = new Intl.DateTimeFormat(targetLocale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    });
    return formatter.format(date);
  } catch {
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  }
}

/**
 * Format full calendar date (e.g. "Oct 14, 2026") in specific timezone
 */
export function formatCalendarDate(
  date: Date,
  options: {
    timeZone: string;
    locale: string;
    isBangla?: boolean;
  }
): string {
  const { timeZone, locale, isBangla = false } = options;
  try {
    const targetLocale = isBangla ? 'bn-BD' : locale || 'en-US';
    const formatter = new Intl.DateTimeFormat(targetLocale, {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return formatter.format(date);
  } catch {
    return date.toDateString();
  }
}

/**
 * Core dynamic readable timestamp formatter.
 *
 * Strictly formats non-relative 24-hour timestamps:
 * - "Updated today at 17:11"
 * - "Updated yesterday at 09:45"
 * - "Updated on Oct 14, 2026 at 16:30"
 *
 * Bangla translations:
 * - "আজ ১৭:১১-এ আপডেট"
 * - "গতকাল ০৯:৪৫-এ আপডেট"
 * - "১৪ অক্টো, ২০২৬ ১৬:৩০-এ আপডেট"
 */
export function formatLastUpdated(
  timestamp: string | Date | null | undefined,
  options: FormatTimestampOptions = {}
): string {
  const isBangla = Boolean(options.isBangla);

  if (!timestamp) {
    return isBangla ? 'এখনও আপডেট হয়নি' : 'Awaiting sync';
  }

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (!date || isNaN(date.getTime())) {
    return isBangla ? 'তারিখ পাওয়া যায়নি' : 'Invalid date';
  }

  const timeZone = resolveTimeZone(options.timeZone);
  const locale = options.locale || (isBangla ? 'bn-BD' : 'en-US');
  const now = options.referenceDate || new Date();

  // Calendar day comparison in the user's specific timezone
  const todayStr = getCalendarDateString(now, timeZone);
  const dateStr = getCalendarDateString(date, timeZone);
  // Always format time in 24-hour (HH:mm) format
  const timeFormatted = formatTimeOfDay(date, {
    timeZone,
    locale: isBangla ? 'bn-BD' : 'en-GB',
    hour12: false,
    isBangla,
  });

  // 1. If the update occurred today: "Updated today at HH:mm"
  if (todayStr === dateStr) {
    return isBangla ? `আজ ${timeFormatted}-এ আপডেট` : `Updated today at ${timeFormatted}`;
  }

  // 2. Check if target was yesterday in the user's timezone: "Updated yesterday at HH:mm"
  const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);
  const [dYear, dMonth, dDay] = dateStr.split('-').map(Number);
  const utcTodayMidnight = Date.UTC(tYear, tMonth - 1, tDay);
  const utcDateMidnight = Date.UTC(dYear, dMonth - 1, dDay);
  const dayDifference = Math.round((utcTodayMidnight - utcDateMidnight) / (24 * 60 * 60 * 1000));

  if (dayDifference === 1) {
    return isBangla ? `গতকাল ${timeFormatted}-এ আপডেট` : `Updated yesterday at ${timeFormatted}`;
  }

  // 3. Otherwise: "Updated on MMM DD, YYYY at HH:mm"
  const dateFormatted = formatCalendarDate(date, { timeZone, locale, isBangla });
  if (isBangla) {
    return `${dateFormatted} ${timeFormatted}-এ আপডেট`;
  }
  return `Updated on ${dateFormatted} at ${timeFormatted}`;
}

/**
 * Format full exact date and time for accessibility and tooltips
 */
export function formatExactDateTime(
  timestamp: string | Date | null | undefined,
  timeZone?: string,
  locale?: string
): string {
  if (!timestamp) return 'No timestamp available';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (!date || isNaN(date.getTime())) return 'Invalid timestamp';

  const tz = resolveTimeZone(timeZone);
  try {
    const formatter = new Intl.DateTimeFormat(locale || 'en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * React hook that yields a live auto-updating formatted timestamp.
 * Automatically updates relative intervals ("just now" -> "1 minute ago" -> "5 minutes ago" -> "today at ...")
 * without ever altering the underlying recorded timestamp.
 */
export function useLiveFormattedTimestamp(
  isoTimestamp: string | null | undefined,
  options: FormatTimestampOptions = {}
): string {
  const [, setTick] = useState<number>(0);

  useEffect(() => {
    if (!isoTimestamp) return;

    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) return;

    // Dynamically choose tick interval based on age
    const updateTick = () => setTick((prev) => prev + 1);

    const diffSeconds = (Date.now() - date.getTime()) / 1000;
    // Under 1 minute: refresh every 10 seconds
    // Under 1 hour: refresh every 30 seconds
    // Over 1 hour: refresh every 60 seconds
    const intervalMs = diffSeconds < 60 ? 10000 : diffSeconds < 3600 ? 30000 : 60000;

    const timer = setInterval(updateTick, intervalMs);
    return () => clearInterval(timer);
  }, [isoTimestamp]);

  return formatLastUpdated(isoTimestamp, options);
}

