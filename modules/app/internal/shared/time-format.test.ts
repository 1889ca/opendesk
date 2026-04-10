/** Contract: contracts/app/rules.md */

import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './time-format.ts';

// Helper: build a Date that is `ms` milliseconds before now.
function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  // --- sub-minute range ---

  it('returns "just now" for a date 2 seconds ago', () => {
    expect(formatRelativeTime(ago(2 * SECOND))).toBe('just now');
  });

  it('returns "just now" for a date 0ms ago', () => {
    expect(formatRelativeTime(ago(0))).toBe('just now');
  });

  it('returns "N seconds ago" for a date 10 seconds ago', () => {
    expect(formatRelativeTime(ago(10 * SECOND))).toBe('10 seconds ago');
  });

  it('returns "59 seconds ago" for a date 59 seconds ago', () => {
    expect(formatRelativeTime(ago(59 * SECOND))).toBe('59 seconds ago');
  });

  // --- minute range ---

  it('returns "1 minute ago" for a date 61 seconds ago', () => {
    expect(formatRelativeTime(ago(61 * SECOND))).toBe('1 minute ago');
  });

  it('returns "1 minute ago" for a date 119 seconds ago', () => {
    expect(formatRelativeTime(ago(119 * SECOND))).toBe('1 minute ago');
  });

  it('returns "5 minutes ago" for a date 5 minutes ago', () => {
    expect(formatRelativeTime(ago(5 * MINUTE))).toBe('5 minutes ago');
  });

  it('returns "59 minutes ago" for a date 59 minutes ago', () => {
    expect(formatRelativeTime(ago(59 * MINUTE))).toBe('59 minutes ago');
  });

  // --- same calendar day (but >1 hour ago) ---

  it('returns "Today at ..." for a date a few hours ago (same calendar day)', () => {
    // Use 2 hours ago only if we're past 2 AM, otherwise use 1 hour ago.
    // We anchor to the start of today to be safe.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // Pick a time that is definitely today: 1 minute after midnight of today.
    const earlyToday = new Date(todayStart.getTime() + MINUTE);
    const result = formatRelativeTime(earlyToday);
    expect(result).toMatch(/^Today at /);
  });

  // --- yesterday ---

  it('returns "Yesterday at ..." for a date in yesterday', () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // 1 minute into yesterday
    const yesterday = new Date(todayStart.getTime() - DAY + MINUTE);
    const result = formatRelativeTime(yesterday);
    expect(result).toMatch(/^Yesterday at /);
  });

  // --- within 7 days (but not today/yesterday) ---

  it('returns "<DayName> at ..." for a date 3 days ago', () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(todayStart.getTime() - 3 * DAY + MINUTE);
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) at /);
  });

  // --- older than 7 days ---

  it('returns "Mon DD" format for same-year dates older than 7 days', () => {
    const now = new Date();
    // 30 days ago — safely older than 7 days and (usually) same year.
    const old = new Date(now.getTime() - 30 * DAY);
    const result = formatRelativeTime(old);
    // Should match something like "Mar 10" — no year.
    expect(result).toMatch(/^[A-Z][a-z]+ \d+$/);
  });

  it('returns "Mon DD, YYYY" for dates in a previous year', () => {
    const twoYearsAgo = new Date(new Date().getFullYear() - 2, 0, 15);
    const result = formatRelativeTime(twoYearsAgo);
    // Should include a 4-digit year, e.g. "Jan 15, 2022"
    expect(result).toMatch(/\d{4}/);
  });

  // --- accepts ISO string input ---

  it('accepts an ISO string instead of a Date object', () => {
    const iso = ago(10 * SECOND).toISOString();
    const result = formatRelativeTime(iso);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  // --- accepts a Date object directly ---

  it('accepts a Date object directly', () => {
    const result = formatRelativeTime(ago(5 * MINUTE));
    expect(result).toBe('5 minutes ago');
  });
});
