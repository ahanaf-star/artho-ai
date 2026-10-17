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

console.log('🧪 Starting Timezone & Dynamic Timestamp Test Suite...\n');

// 1. Timezone Detection & Validation
console.log('--- Test 1: Timezone Detection & Validation ---');
const detected = detectUserTimeZone();
console.log('✓ Detected system timezone:', detected);
assert(typeof detected === 'string' && detected.length > 0, 'Detected timezone must be non-empty string');

assert.strictEqual(isValidTimeZone('Asia/Dhaka'), true, 'Asia/Dhaka should be valid');
assert.strictEqual(isValidTimeZone('America/New_York'), true, 'America/New_York should be valid');
assert.strictEqual(isValidTimeZone('Europe/London'), true, 'Europe/London should be valid');
assert.strictEqual(isValidTimeZone('UTC'), true, 'UTC should be valid');
assert.strictEqual(isValidTimeZone('Mars/Olympus_Mons'), false, 'Mars timezone should be invalid');
assert.strictEqual(isValidTimeZone(''), false, 'Empty string should be invalid');

assert.strictEqual(resolveTimeZone('Asia/Dhaka'), 'Asia/Dhaka');
assert.strictEqual(resolveTimeZone('Invalid/TZ'), detected);
assert.strictEqual(resolveTimeZone(null), detected);
console.log('✓ Timezone validation passed cleanly.\n');

// 2. Exact Timezone Conversion & Calendar Date Boundary Test
console.log('--- Test 2: Multi-Timezone Calendar Day Boundary ---');
// Let reference now be 2026-10-17T12:00:00.000Z
const refNow = new Date('2026-10-17T12:00:00.000Z');

// Event occurred at 2026-10-17T03:52:00.000Z:
// In Asia/Dhaka (UTC+6): 2026-10-17 at 09:52 -> TODAY
// In America/New_York (UTC-4): 2026-10-16 at 23:52 -> YESTERDAY
const eventTs = '2026-10-17T03:52:00.000Z';

const dhakaDateStr = getCalendarDateString(new Date(eventTs), 'Asia/Dhaka');
const nyDateStr = getCalendarDateString(new Date(eventTs), 'America/New_York');
console.log(`Event in Dhaka calendar: ${dhakaDateStr}`);
console.log(`Event in New York calendar: ${nyDateStr}`);
assert.strictEqual(dhakaDateStr, '2026-10-17', 'Should be Oct 17 in Dhaka');
assert.strictEqual(nyDateStr, '2026-10-16', 'Should be Oct 16 in New York');

// Formatted in Dhaka (earlier today at 09:52)
const formattedDhaka = formatLastUpdated(eventTs, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
  hour12: false,
});
console.log('Dhaka formatted (today):', formattedDhaka);
assert.strictEqual(formattedDhaka, 'Updated today at 09:52');

// Formatted in New York (yesterday at 23:52)
const formattedNY = formatLastUpdated(eventTs, {
  timeZone: 'America/New_York',
  referenceDate: refNow,
  hour12: false,
});
console.log('New York formatted (yesterday):', formattedNY);
assert.strictEqual(formattedNY, 'Updated yesterday at 23:52');
console.log('✓ Timezone boundary and calendar-day tests passed.\n');

// 3. Relative Intervals Test
console.log('--- Test 3: Relative Intervals (Just Now, Minutes Ago, Older Dates) ---');
// 3a. Just now (30 seconds ago)
const ts30sAgo = new Date(refNow.getTime() - 30 * 1000).toISOString();
const justNow = formatLastUpdated(ts30sAgo, { referenceDate: refNow });
console.log('30 seconds ago:', justNow);
assert.strictEqual(justNow, 'Updated just now');

// 3b. 5 minutes ago
const ts5mAgo = new Date(refNow.getTime() - 5 * 60 * 1000).toISOString();
const fiveMin = formatLastUpdated(ts5mAgo, { referenceDate: refNow });
console.log('5 minutes ago:', fiveMin);
assert.strictEqual(fiveMin, 'Updated 5 minutes ago');

// 3c. 1 minute ago
const ts1mAgo = new Date(refNow.getTime() - 65 * 1000).toISOString();
const oneMin = formatLastUpdated(ts1mAgo, { referenceDate: refNow });
console.log('1 minute ago:', oneMin);
assert.strictEqual(oneMin, 'Updated 1 minute ago');

// 3d. Older date (e.g. Oct 14, 2026 at 09:52 in Dhaka)
// Oct 14, 2026 09:52 Dhaka = 2026-10-14T03:52:00.000Z
const oldTs = '2026-10-14T03:52:00.000Z';
const formattedOld = formatLastUpdated(oldTs, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
  hour12: false,
});
console.log('Oct 14, 2026 in Dhaka:', formattedOld);
assert(formattedOld.includes('Oct 14, 2026 at 09:52'), `Expected Oct 14, 2026 at 09:52, got: ${formattedOld}`);
console.log('✓ Relative intervals verified.\n');

// 4. 12-Hour vs 24-Hour Formats
console.log('--- Test 4: 12-Hour vs 24-Hour Formatting ---');
const eveningTs = '2026-10-17T12:30:00.000Z'; // 18:30 in Dhaka
const fmt24 = formatLastUpdated(eveningTs, {
  timeZone: 'Asia/Dhaka',
  referenceDate: new Date('2026-10-18T06:00:00.000Z'), // next day in Dhaka -> yesterday
  hour12: false,
});
console.log('24h yesterday:', fmt24);
assert.strictEqual(fmt24, 'Updated yesterday at 18:30');

const fmt12 = formatLastUpdated(eveningTs, {
  timeZone: 'Asia/Dhaka',
  referenceDate: new Date('2026-10-18T06:00:00.000Z'),
  hour12: true,
});
console.log('12h yesterday:', fmt12);
assert(fmt12.includes('06:30 PM'), `Expected 06:30 PM, got: ${fmt12}`);
console.log('✓ 12h vs 24h formats verified.\n');

// 5. Bangla Translations & Digit Formatting
console.log('--- Test 5: Bangla Localization ---');
const bnJustNow = formatLastUpdated(ts30sAgo, { referenceDate: refNow, isBangla: true });
console.log('Bangla Just Now:', bnJustNow);
assert.strictEqual(bnJustNow, 'এইমাত্র আপডেট করা হয়েছে');

const bn5Min = formatLastUpdated(ts5mAgo, { referenceDate: refNow, isBangla: true });
console.log('Bangla 5 min ago:', bn5Min);
assert.strictEqual(bn5Min, '৫ মিনিট আগে আপডেট');

const bnToday = formatLastUpdated(eventTs, {
  timeZone: 'Asia/Dhaka',
  referenceDate: refNow,
  isBangla: true,
  hour12: false,
});
console.log('Bangla today:', bnToday);
assert(bnToday.includes('আজ') && bnToday.includes('০৯:৫২'), `Expected Bangla today with ০৯:৫২, got: ${bnToday}`);
console.log('✓ Bangla localization verified.\n');

// 6. Graceful Handling of Missing / Invalid Timestamps
console.log('--- Test 6: Missing & Invalid Timestamps ---');
assert.strictEqual(formatLastUpdated(null), 'Awaiting sync');
assert.strictEqual(formatLastUpdated(undefined), 'Awaiting sync');
assert.strictEqual(formatLastUpdated(null, { isBangla: true }), 'এখনও আপডেট হয়নি');
assert.strictEqual(formatLastUpdated('not-a-valid-date'), 'Invalid date');
assert.strictEqual(formatLastUpdated('not-a-valid-date', { isBangla: true }), 'তারিখ পাওয়া যায়নি');
console.log('✓ Missing and invalid timestamps handled gracefully.\n');

// 7. Full Exact DateTime Tooltip
console.log('--- Test 7: Full Exact DateTime Tooltip ---');
const tooltip = formatExactDateTime('2026-10-17T03:52:00.000Z', 'Asia/Dhaka');
console.log('Exact tooltip:', tooltip);
assert(tooltip.includes('2026') && tooltip.includes('09:52'), 'Tooltip must have year and time');
console.log('✓ Tooltip formatted successfully.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
