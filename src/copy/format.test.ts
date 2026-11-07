import { describe, expect, it } from 'vitest';
import { defaultSessionName, formatLongDate, formatShortDate } from './format';

const NOV_7_2026 = Date.UTC(2026, 10, 7, 12, 0, 0);

describe('format', () => {
  it('formats a long date as "7 November 2026"', () => {
    expect(formatLongDate(NOV_7_2026)).toBe('7 November 2026');
  });

  it('formats a short date as "Nov 7"', () => {
    expect(formatShortDate(NOV_7_2026)).toBe('Nov 7');
  });

  it('does not pad single-digit days', () => {
    expect(formatLongDate(Date.UTC(2026, 0, 3))).toBe('3 January 2026');
    expect(formatShortDate(Date.UTC(2026, 0, 3))).toBe('Jan 3');
  });

  it('builds the default session name from host and date', () => {
    expect(defaultSessionName('example.com', NOV_7_2026)).toBe('example.com · Nov 7');
  });
});
