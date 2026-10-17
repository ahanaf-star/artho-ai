import assert from 'assert';
import {
  detectUserTimeZone,
  isValidTimeZone,
  resolveTimeZone,
  getCalendarDateString,
  formatLastUpdated,
  formatExactDateTime,
  toBanglaDigits,
} from '../src/services/dateTimeService.ts';

console.log('🧪 Starting Timezone & Non-Relative 24-Hour Timestamp Test Suite...\n');

// 1. Timezone Detection & Validation
console.log('--- Test 1: Timezone Detection & Validation ---');
const detected = detectUserTimeZone();
console.log('✓ Detected system timezone via Intl:', detected);
assert(typeof detected === 'string' && detected.length > 0, 'Detected timezone must be non-empty string');

assert.strictEqual(isValidTimeZone('Asia/Dhaka'), true, 'Asia/Dhaka should be valid');
assert.strictEqual(isValidTimeZone('America/New_York'), true, 'America/New_York should be valid');
assert.strictEqual(isValidTimeZone('Europe/London'), true, 'Europe/London should be valid');
assert.strictEqual(isValidTimeZone('UTC'), true, 'UTC should be valid');
assert.strictEqual(isValidTimeZone('Invalid/Unknown'), false, 'Unknown timezone should be invalid');

assert.strictEqual(resolveTimeZone('Asia/Dhaka'), 'Asia/Dhaka');
assert.strictEqual(resolveTimeZone('Invalid/TZ'), detected);
assert.strictEqual(resolveTimeZone(null), detected);
console.log('✓ Timezone validation passed cleanly.\n');

// 2. Strict 24-Hour Formats Required:
// - "Updated today at 17:11"
// - "Updated yesterday at 09:45"
// - "Updated on Oct 14, 2026 at 16:30"
console.log('--- Test 2: Required Exact 24-Hour Timestamp Formats ---');
const refNow = new Date('2026-10-17T12:00:00.000Z'); // 18:00 on Oct 17 in Dhaka

// 2a. Today at 17:11 in Dhaka:
// 17:11 Dhaka (UTC+6) is 11:11 UTC on Oct 17
const tsToday1711 = '2026-10-17T11:11:00.000Z';
const formattedToday = formatLastUpdated(tsToday1711, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
});
console.log('Today format result:', formattedToday);
assert.strictEqual(formattedToday, 'Updated today at 17:11');

// 2b. Even if updated 10 seconds ago or 5 minutes ago today, MUST NOT show "just now" or "5 minutes ago"
const ts10SecsAgo = new Date(refNow.getTime() - 10 * 1000).toISOString();
const formattedRecent = formatLastUpdated(ts10SecsAgo, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
});
console.log('10 seconds ago format result (Dhaka):', formattedRecent);
assert.strictEqual(formattedRecent, 'Updated today at 17:59'); // 17:59:50 in Dhaka is 17:59

const ts5MinsAgo = new Date(refNow.getTime() - 5 * 60 * 1000).toISOString();
const formatted5Min = formatLastUpdated(ts5MinsAgo, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
});
console.log('5 minutes ago format result (Dhaka):', formatted5Min);
assert.strictEqual(formatted5Min, 'Updated today at 17:55');

// 2c. Yesterday at 09:45 in Dhaka:
// Oct 16, 2026 09:45 Dhaka is Oct 16 03:45 UTC
const tsYesterday0945 = '2026-10-16T03:45:00.000Z';
const formattedYesterday = formatLastUpdated(tsYesterday0945, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
});
console.log('Yesterday format result:', formattedYesterday);
assert.strictEqual(formattedYesterday, 'Updated yesterday at 09:45');

// 2d. Updated on Oct 14, 2026 at 16:30 in Dhaka:
// Oct 14, 2026 16:30 Dhaka is Oct 14 10:30 UTC
const tsOct14 = '2026-10-14T10:30:00.000Z';
const formattedOct14 = formatLastUpdated(tsOct14, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
});
console.log('Oct 14 format result:', formattedOct14);
assert.strictEqual(formattedOct14, 'Updated on Oct 14, 2026 at 16:30');
console.log('✓ All 3 required timestamp formats verified exactly.\n');

// 3. Multi-Timezone Calendar Day & Daylight Saving Boundary
console.log('--- Test 3: Multi-Timezone Calendar Day Boundary ---');
// Event at 2026-10-17T03:52:00.000Z
// In Asia/Dhaka (UTC+6): 2026-10-17 09:52 -> TODAY
// In America/New_York (UTC-4): 2026-10-16 23:52 -> YESTERDAY
const eventTs = '2026-10-17T03:52:00.000Z';
const dhakaDateStr = getCalendarDateString(new Date(eventTs), 'Asia/Dhaka');
const nyDateStr = getCalendarDateString(new Date(eventTs), 'America/New_York');

assert.strictEqual(dhakaDateStr, '2026-10-17', 'Should be Oct 17 in Dhaka');
assert.strictEqual(nyDateStr, '2026-10-16', 'Should be Oct 16 in New York');

const inDhaka = formatLastUpdated(eventTs, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
});
console.log('In Dhaka:', inDhaka);
assert.strictEqual(inDhaka, 'Updated today at 09:52');

const inNY = formatLastUpdated(eventTs, {
  timeZone: 'America/New_York',
  referenceDate: refNow,
});
console.log('In New York:', inNY);
assert.strictEqual(inNY, 'Updated yesterday at 23:52');
console.log('✓ Timezone boundary tests passed.\n');

// 4. Bangla Localization (Strict non-relative 24h format)
console.log('--- Test 4: Bangla Localization ---');
const bnToday = formatLastUpdated(tsToday1711, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
  isBangla: true,
});
console.log('Bangla Today:', bnToday);
assert.strictEqual(bnToday, 'আজ ১৭:১১-এ আপডেট');

const bnYesterday = formatLastUpdated(tsYesterday0945, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
  isBangla: true,
});
console.log('Bangla Yesterday:', bnYesterday);
assert.strictEqual(bnYesterday, 'গতকাল ০৯:৪৫-এ আপডেট');

const bnOct14 = formatLastUpdated(tsOct14, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
  isBangla: true,
});
console.log('Bangla Older Date:', bnOct14);
assert(bnOct14.includes('১৬:৩০') && bnOct14.includes('আপডেট'), 'Bangla older date should contain time and update');
console.log('✓ Bangla localization passed.\n');

// 5. Graceful Handling of Missing / Invalid Timestamps
console.log('--- Test 5: Missing & Invalid Timestamps ---');
assert.strictEqual(formatLastUpdated(null), 'Awaiting sync');
assert.strictEqual(formatLastUpdated(undefined), 'Awaiting sync');
assert.strictEqual(formatLastUpdated(null, { isBangla: true }), 'এখনও আপডেট হয়নি');
assert.strictEqual(formatLastUpdated('invalid-timestamp-string'), 'Invalid date');
assert.strictEqual(formatLastUpdated('invalid-timestamp-string', { isBangla: true }), 'তারিখ পাওয়া যায়নি');
console.log('✓ Missing and invalid timestamps handled safely without crashing.\n');

// 6. Tooltip Exact Full Formatter
console.log('--- Test 6: Detailed Tooltip ---');
const tooltip = formatExactDateTime('2026-10-17T11:11:00.000Z', 'Asia/Dhaka');
console.log('Exact tooltip:', tooltip);
assert(tooltip.includes('2026') && tooltip.includes('17:11'), 'Tooltip must have year and 17:11');
console.log('✓ Tooltip verified.\n');

console.log('🎉 ALL NON-RELATIVE 24-HOUR TIMESTAMP TESTS PASSED SUCCESSFULLY! 🚀');
