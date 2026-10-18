import { describe, expect, it } from 'vitest';

import { limitLevel, limitPercent, overLimitCount, parseLimitMinutes } from '@/ui/limits';
import { aggregate, rangeFor } from '@/shared/period';

/**
 * Local noon on 2026-06-17 is the base for time-related checks.
 * Noon is far from midnight, so time zone offsets do not change
 * the local date of the moment.
 */
const BASE = new Date(2026, 5, 17, 12, 0, 0).getTime();

describe('limitLevel', () => {
  it('limitLevel_normal_below_eighty_percent', () => {
    expect(limitLevel(0, 300)).toBe('normal');
    expect(limitLevel(239, 300)).toBe('normal');
  });

  it('limitLevel_warning_from_eighty_percent', () => {
    expect(limitLevel(240, 300)).toBe('warning');
    expect(limitLevel(299, 300)).toBe('warning');
    expect(limitLevel(80, 100)).toBe('warning');
  });

  it('limitLevel_over_from_the_full_limit', () => {
    expect(limitLevel(300, 300)).toBe('over');
    expect(limitLevel(301, 300)).toBe('over');
    expect(limitLevel(900, 300)).toBe('over');
  });
});

describe('limitPercent', () => {
  it('limitPercent_rounds_the_share', () => {
    expect(limitPercent(150, 300)).toBe(50);
    expect(limitPercent(2, 300)).toBe(1);
    expect(limitPercent(1, 300)).toBe(0);
  });

  it('limitPercent_clamps_at_one_hundred', () => {
    expect(limitPercent(300, 300)).toBe(100);
    expect(limitPercent(450, 300)).toBe(100);
  });

  it('limitPercent_with_non_positive_limit_is_zero', () => {
    expect(limitPercent(100, 0)).toBe(0);
    expect(limitPercent(100, -60)).toBe(0);
  });
});

describe('overLimitCount', () => {
  it('overLimitCount_counts_only_domains_above_their_limit', () => {
    const perDomain = new Map([
      ['youtube.com', 1801],
      ['github.com', 1800],
      ['notion.com', 5000],
    ]);

    expect(overLimitCount(perDomain, { 'youtube.com': 1800, 'github.com': 1800 })).toBe(1);
  });

  it('overLimitCount_ignores_limits_without_time', () => {
    const perDomain = new Map([['youtube.com', 900]]);

    expect(overLimitCount(perDomain, { 'youtube.com': 1800, 'example.org': 60 })).toBe(0);
    expect(overLimitCount(new Map(), {})).toBe(0);
  });

  it('overLimitCount_ignores_seconds_from_previous_days', () => {
    const days = { '2026-06-16': { '9': { 'youtube.com': 3600 } } };
    const limits = { 'youtube.com': 1800 };

    const today = aggregate(days, rangeFor('today', BASE));
    expect(today.perDomain.size).toBe(0);
    expect(overLimitCount(today.perDomain, limits)).toBe(0);

    const week = aggregate(days, rangeFor('week', BASE));
    expect(overLimitCount(week.perDomain, limits)).toBe(1);
  });
});

describe('parseLimitMinutes', () => {
  it('parseLimitMinutes_accepts_whole_minutes_in_range', () => {
    expect(parseLimitMinutes('1')).toBe(1);
    expect(parseLimitMinutes('30')).toBe(30);
    expect(parseLimitMinutes('030')).toBe(30);
    expect(parseLimitMinutes('1440')).toBe(1440);
    expect(parseLimitMinutes(' 30 ')).toBe(30);
  });

  it('parseLimitMinutes_rejects_everything_else', () => {
    for (const value of ['', ' ', '0', '1441', '1.5', 'abc', '-5', '30m', '1 440']) {
      expect(parseLimitMinutes(value)).toBeNull();
    }
  });
});
