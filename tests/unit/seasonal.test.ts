import { describe, expect, it } from 'vitest';

import {
  buildSeasonalCountdownMessage,
  parseCountdownTargetDate,
} from '@/utils/seasonal';

describe('seasonal countdown utilities', () => {
  it('normalizes valid target dates and rejects invalid ones', () => {
    expect(parseCountdownTargetDate('2026-12-25')).toBe('2026-12-25');
    expect(parseCountdownTargetDate('2026-02-30')).toBe('');
    expect(parseCountdownTargetDate('12/25/2026')).toBe('');
  });

  it('reports future day counts using the configured time zone', () => {
    expect(
      buildSeasonalCountdownMessage({
        targetDate: '2026-12-25',
        label: 'UNTIL CHRISTMAS',
        timeZone: 'America/New_York',
        now: new Date('2026-12-13T15:00:00.000Z'),
      }),
    ).toMatchObject({
      state: 'future',
      daysRemaining: 12,
      message: '12 DAYS UNTIL CHRISTMAS',
    });
  });

  it('handles one-day, same-day, and past countdown states without negatives', () => {
    expect(
      buildSeasonalCountdownMessage({
        targetDate: '2026-12-25',
        label: 'UNTIL CHRISTMAS',
        timeZone: 'America/New_York',
        now: new Date('2026-12-24T15:00:00.000Z'),
      }),
    ).toMatchObject({
      state: 'future',
      daysRemaining: 1,
      message: '1 DAY UNTIL CHRISTMAS',
    });

    expect(
      buildSeasonalCountdownMessage({
        targetDate: '2026-12-25',
        label: 'UNTIL CHRISTMAS',
        timeZone: 'America/New_York',
        now: new Date('2026-12-25T15:00:00.000Z'),
      }),
    ).toMatchObject({
      state: 'today',
      daysRemaining: 0,
      message: 'CHRISTMAS IS HERE!',
    });

    expect(
      buildSeasonalCountdownMessage({
        targetDate: '2026-12-25',
        label: 'UNTIL CHRISTMAS',
        timeZone: 'America/New_York',
        now: new Date('2026-12-26T15:00:00.000Z'),
      }),
    ).toMatchObject({
      state: 'past',
      daysRemaining: 0,
      message: 'CHRISTMAS HAS PASSED—SANTA IS ALREADY PREPARING FOR NEXT YEAR.',
    });
  });

  it('stays stable across leap-year and year-boundary dates', () => {
    expect(
      buildSeasonalCountdownMessage({
        targetDate: '2028-02-29',
        label: 'UNTIL LEAP DAY',
        timeZone: 'UTC',
        now: new Date('2028-02-28T12:00:00.000Z'),
      }),
    ).toMatchObject({
      state: 'future',
      daysRemaining: 1,
      message: '1 DAY UNTIL LEAP DAY',
    });

    expect(
      buildSeasonalCountdownMessage({
        targetDate: '2027-01-01',
        label: 'UNTIL NEW YEAR',
        timeZone: 'UTC',
        now: new Date('2026-12-31T23:30:00.000Z'),
      }),
    ).toMatchObject({
      state: 'future',
      daysRemaining: 1,
      message: '1 DAY UNTIL NEW YEAR',
    });
  });
});
