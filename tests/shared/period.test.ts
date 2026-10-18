import { describe, expect, it } from 'vitest';

import { required } from '../helpers/required';
import {
  aggregate,
  dailyTotals,
  dayKeys,
  hourlyTotals,
  mergeSegment,
  previousRange,
  rangeFor,
  sortRows,
} from '@/shared/period';
import type { Aggregated } from '@/shared/period';
import type { Segment } from '@/shared/types';

/**
 * Local noon of the day. The month is as in the calendar (1-12).
 * Noon is far from midnight, so time zone offsets do not change
 * the local date of the moment.
 */
function localNoon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

/** Wednesday 2026-06-17, local noon: the base for most checks. */
const BASE = localNoon(2026, 6, 17);

/** Domain segment that started secondsBeforeNow seconds before now. */
function segmentFor(domain: string, now: number, secondsBeforeNow: number): Segment {
  return {
    domain,
    startedAt: now - secondsBeforeNow * 1000,
    lastCommitAt: now - secondsBeforeNow * 1000,
    tabId: 1,
    windowId: 1,
  };
}

/** Aggregation with one domain: the input for mergeSegment checks. */
function aggregatedWith(domain: string, seconds: number): Aggregated {
  return { total: seconds, perDomain: new Map([[domain, seconds]]) };
}

describe('rangeFor', () => {
  it('rangeFor_today_is_the_current_local_day', () => {
    expect(rangeFor('today', BASE)).toEqual({ from: '2026-06-17', to: '2026-06-17' });
  });

  it('rangeFor_week_starts_on_monday', () => {
    expect(rangeFor('week', BASE)).toEqual({ from: '2026-06-15', to: '2026-06-17' });
    expect(rangeFor('week', localNoon(2026, 6, 15))).toEqual({
      from: '2026-06-15',
      to: '2026-06-15',
    });
    expect(rangeFor('week', localNoon(2026, 6, 21))).toEqual({
      from: '2026-06-15',
      to: '2026-06-21',
    });
  });

  it('rangeFor_week_crosses_year_boundary', () => {
    expect(rangeFor('week', localNoon(2027, 1, 1))).toEqual({
      from: '2026-12-28',
      to: '2027-01-01',
    });
  });

  it('rangeFor_month_starts_on_the_first', () => {
    expect(rangeFor('month', BASE)).toEqual({ from: '2026-06-01', to: '2026-06-17' });
    expect(rangeFor('month', localNoon(2026, 6, 1))).toEqual({
      from: '2026-06-01',
      to: '2026-06-01',
    });
  });

  it('rangeFor_year_covers_the_last_365_days', () => {
    expect(rangeFor('year', BASE)).toEqual({ from: '2025-06-18', to: '2026-06-17' });
    expect(rangeFor('year', localNoon(2028, 3, 1))).toEqual({
      from: '2027-03-03',
      to: '2028-03-01',
    });
  });
});

describe('previousRange', () => {
  it('previousRange_today_is_yesterday', () => {
    expect(previousRange('today', BASE)).toEqual({ from: '2026-06-16', to: '2026-06-16' });
  });

  it('previousRange_week_is_the_previous_calendar_week', () => {
    // Wednesday 2026-06-17: the current week started on Monday 2026-06-15.
    expect(previousRange('week', BASE)).toEqual({ from: '2026-06-08', to: '2026-06-14' });
    // Monday of the current week gives the same previous week.
    expect(previousRange('week', localNoon(2026, 6, 15))).toEqual({
      from: '2026-06-08',
      to: '2026-06-14',
    });
  });

  it('previousRange_month_is_the_previous_calendar_month', () => {
    expect(previousRange('month', BASE)).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    // January takes all of December from the previous year.
    expect(previousRange('month', localNoon(2026, 1, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('previousRange_year_is_the_365_days_before_the_year_range', () => {
    // Year range 2025-06-18 to 2026-06-17: the previous range is the
    // 365 days before it.
    expect(rangeFor('year', BASE)).toEqual({ from: '2025-06-18', to: '2026-06-17' });
    expect(previousRange('year', BASE)).toEqual({ from: '2024-06-18', to: '2025-06-17' });
  });
});

describe('dayKeys', () => {
  it('dayKeys_returns_consecutive_local_days_inclusive', () => {
    expect(dayKeys({ from: '2026-06-15', to: '2026-06-17' })).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ]);
    expect(dayKeys({ from: '2026-06-15', to: '2026-06-15' })).toEqual(['2026-06-15']);
    expect(dayKeys({ from: '2026-06-28', to: '2026-07-02' })).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ]);
  });

  it('dayKeys_year_range_has_365_unique_entries', () => {
    const keys = dayKeys(rangeFor('year', BASE));
    expect(keys).toHaveLength(365);
    expect(new Set(keys).size).toBe(365);
    expect(keys[0]).toBe('2025-06-18');
    expect(keys[364]).toBe('2026-06-17');
  });
});

describe('aggregate', () => {
  it('aggregate_sums_a_domain_across_days', () => {
    const result = aggregate(
      {
        '2026-06-16': { '9': { 'youtube.com': 600, 'github.com': 300 } },
        '2026-06-17': { '10': { 'youtube.com': 300 } },
      },
      { from: '2026-06-16', to: '2026-06-17' },
    );
    expect(result.total).toBe(1200);
    expect(result.perDomain.get('youtube.com')).toBe(900);
    expect(result.perDomain.get('github.com')).toBe(300);
    expect(result.perDomain.size).toBe(2);
  });

  it('aggregate_sums_a_domain_across_hours', () => {
    const result = aggregate(
      { '2026-06-17': { '9': { 'youtube.com': 300 }, '10': { 'youtube.com': 600 } } },
      { from: '2026-06-17', to: '2026-06-17' },
    );
    expect(result.total).toBe(900);
    expect(result.perDomain.get('youtube.com')).toBe(900);
    expect(result.perDomain.size).toBe(1);
  });

  it('aggregate_ignores_days_outside_the_range_and_missing_days', () => {
    const result = aggregate(
      {
        '2026-06-15': { '9': { 'youtube.com': 999 } },
        '2026-06-16': { '9': { 'youtube.com': 100 } },
        '2026-06-18': { '9': { 'youtube.com': 500 } },
      },
      { from: '2026-06-16', to: '2026-06-17' },
    );
    // 2026-06-17 is in the range but has no record: the day counts as empty.
    expect(result.total).toBe(100);
    expect(result.perDomain.get('youtube.com')).toBe(100);
    expect(result.perDomain.size).toBe(1);
  });

  it('aggregate_empty_input_gives_zeros', () => {
    const result = aggregate({}, { from: '2026-06-17', to: '2026-06-17' });
    expect(result.total).toBe(0);
    expect(result.perDomain.size).toBe(0);
  });

  it('aggregate_drops_zero_sum_domains', () => {
    const zeroOnly = aggregate(
      { '2026-06-17': { '9': { 'youtube.com': 0, 'github.com': 600 } } },
      { from: '2026-06-17', to: '2026-06-17' },
    );
    expect(zeroOnly.perDomain.has('youtube.com')).toBe(false);
    expect(zeroOnly.perDomain.get('github.com')).toBe(600);

    const zeroThenNonZero = aggregate(
      {
        '2026-06-16': { '9': { 'youtube.com': 0, 'github.com': 600 } },
        '2026-06-17': { '10': { 'youtube.com': 600 } },
      },
      { from: '2026-06-16', to: '2026-06-17' },
    );
    expect(zeroThenNonZero.perDomain.get('youtube.com')).toBe(600);
    expect(zeroThenNonZero.total).toBe(1200);
  });
});

describe('sortRows', () => {
  it('sortRows_orders_by_seconds_descending', () => {
    const rows = sortRows(
      new Map([
        ['notion.com', 300],
        ['youtube.com', 600],
        ['github.com', 450],
      ]),
    );
    expect(rows).toEqual([
      { domain: 'youtube.com', seconds: 600 },
      { domain: 'github.com', seconds: 450 },
      { domain: 'notion.com', seconds: 300 },
    ]);
  });

  it('sortRows_breaks_ties_alphabetically', () => {
    const rows = sortRows(
      new Map([
        ['youtube.com', 600],
        ['github.com', 600],
        ['notion.com', 300],
      ]),
    );
    expect(rows.map((row) => row.domain)).toEqual(['github.com', 'youtube.com', 'notion.com']);
  });
});

describe('mergeSegment', () => {
  it('mergeSegment_adds_live_seconds_to_its_domain', () => {
    const input = aggregatedWith('youtube.com', 100);
    const range = rangeFor('today', BASE);
    const segment = segmentFor('youtube.com', BASE, 65);

    const result = mergeSegment(input, segment, range, BASE);

    expect(result.total).toBe(165);
    expect(result.perDomain.get('youtube.com')).toBe(165);
    // the input aggregation did not change
    expect(input.total).toBe(100);
    expect(input.perDomain.get('youtube.com')).toBe(100);
  });

  it('mergeSegment_adds_a_domain_missing_from_the_days', () => {
    const input = aggregatedWith('youtube.com', 100);
    const range = rangeFor('today', BASE);
    const segment = segmentFor('github.com', BASE, 30);

    const result = mergeSegment(input, segment, range, BASE);

    expect(result.perDomain.get('github.com')).toBe(30);
    expect(result.perDomain.get('youtube.com')).toBe(100);
    expect(result.total).toBe(130);
  });

  it('mergeSegment_floors_partial_seconds_and_clamps_negative_elapsed', () => {
    const input = aggregatedWith('youtube.com', 100);
    const range = rangeFor('today', BASE);

    const partial = mergeSegment(input, segmentFor('youtube.com', BASE, 0.9), range, BASE);
    expect(partial.perDomain.get('youtube.com')).toBe(100);
    expect(partial.total).toBe(100);

    const negative = mergeSegment(input, segmentFor('youtube.com', BASE, -5_000), range, BASE);
    expect(negative.perDomain.get('youtube.com')).toBe(100);
    expect(negative.total).toBe(100);
  });

  it('mergeSegment_ignores_null_segment', () => {
    const input = aggregatedWith('youtube.com', 100);
    const result = mergeSegment(input, null, rangeFor('today', BASE), BASE);
    expect(result.total).toBe(100);
    expect(result.perDomain.get('youtube.com')).toBe(100);
    expect(result.perDomain.size).toBe(1);
  });

  it('mergeSegment_skips_a_day_outside_the_range', () => {
    const input = aggregatedWith('youtube.com', 100);
    const range = rangeFor('today', BASE);
    const twoDaysLater = localNoon(2026, 6, 19);
    const segment = segmentFor('youtube.com', twoDaysLater, 65);

    const result = mergeSegment(input, segment, range, twoDaysLater);

    expect(result.total).toBe(100);
    expect(result.perDomain.get('youtube.com')).toBe(100);
    expect(result.perDomain.size).toBe(1);
  });
});

describe('dailyTotals', () => {
  it('dailyTotals_returns_a_row_for_every_day_including_zeros', () => {
    const totals = dailyTotals(
      { '2026-06-16': { '9': { 'youtube.com': 600 } } },
      { from: '2026-06-15', to: '2026-06-17' },
    );
    expect(totals).toEqual([
      { day: '2026-06-15', seconds: 0, perDomain: new Map() },
      { day: '2026-06-16', seconds: 600, perDomain: new Map([['youtube.com', 600]]) },
      { day: '2026-06-17', seconds: 0, perDomain: new Map() },
    ]);
  });

  it('dailyTotals_sums_all_domains_of_a_day', () => {
    const totals = dailyTotals(
      { '2026-06-17': { '9': { 'youtube.com': 600 }, '14': { 'github.com': 300 } } },
      { from: '2026-06-17', to: '2026-06-17' },
    );
    expect(totals).toEqual([
      {
        day: '2026-06-17',
        seconds: 900,
        perDomain: new Map([
          ['youtube.com', 600],
          ['github.com', 300],
        ]),
      },
    ]);
  });

  it('dailyTotals_sums_all_hours_of_a_day', () => {
    const totals = dailyTotals(
      {
        '2026-06-17': {
          '0': { 'youtube.com': 100 },
          '9': { 'youtube.com': 600 },
          '23': { 'github.com': 300 },
        },
      },
      { from: '2026-06-17', to: '2026-06-17' },
    );
    expect(totals).toHaveLength(1);
    expect(required(totals[0]).seconds).toBe(1000);
    expect(required(totals[0]).perDomain.get('youtube.com')).toBe(700);
    expect(required(totals[0]).perDomain.get('github.com')).toBe(300);
  });

  it('dailyTotals_keeps_per_domain_seconds_for_stacking', () => {
    const totals = dailyTotals(
      { '2026-06-17': { '9': { 'youtube.com': 300, 'github.com': 200 } } },
      { from: '2026-06-16', to: '2026-06-17' },
    );
    // The day record has per-domain seconds. The stacked bar is built
    // from them.
    expect(required(totals[1]).perDomain).toEqual(
      new Map([
        ['youtube.com', 300],
        ['github.com', 200],
      ]),
    );
    // A day without data gives an empty map.
    expect(required(totals[0]).perDomain.size).toBe(0);
  });

  it('dailyTotals_empty_input_gives_zero_rows', () => {
    const totals = dailyTotals({}, { from: '2026-06-15', to: '2026-06-17' });
    expect(totals).toEqual([
      { day: '2026-06-15', seconds: 0, perDomain: new Map() },
      { day: '2026-06-16', seconds: 0, perDomain: new Map() },
      { day: '2026-06-17', seconds: 0, perDomain: new Map() },
    ]);
  });

  it('dailyTotals_year_range_has_365_rows', () => {
    const range = rangeFor('year', BASE);
    const totals = dailyTotals({}, range);
    expect(totals).toHaveLength(365);
    expect(required(totals[0]).day).toBe(range.from);
    expect(required(totals[364]).day).toBe(range.to);
    expect(required(totals[0]).perDomain.size).toBe(0);
  });

  it('dailyTotals_ignores_days_outside_the_range', () => {
    const totals = dailyTotals(
      {
        '2026-06-15': { '9': { 'youtube.com': 999 } },
        '2026-06-16': { '9': { 'youtube.com': 100 } },
      },
      { from: '2026-06-16', to: '2026-06-17' },
    );
    expect(totals).toEqual([
      { day: '2026-06-16', seconds: 100, perDomain: new Map([['youtube.com', 100]]) },
      { day: '2026-06-17', seconds: 0, perDomain: new Map() },
    ]);
    // The day before from did not add to any row of the series.
    expect(totals.reduce((sum, row) => sum + row.seconds, 0)).toBe(100);
  });
});

describe('hourlyTotals', () => {
  it('hourlyTotals_returns_24_buckets_in_order', () => {
    const buckets = hourlyTotals(
      { '2026-06-17': { '9': { 'youtube.com': 600 } } },
      { from: '2026-06-17', to: '2026-06-17' },
    );
    expect(buckets).toHaveLength(24);
    expect(buckets.map((bucket) => bucket.hour)).toEqual(
      Array.from({ length: 24 }, (_, hour) => hour),
    );
    // Data of hour 9 goes to the ninth bucket. The rest are zero.
    expect(required(buckets[9]).seconds).toBe(600);
    for (const bucket of buckets) {
      if (bucket.hour !== 9) {
        expect(bucket.seconds).toBe(0);
        expect(bucket.perDomain.size).toBe(0);
      }
    }
  });

  it('hourlyTotals_sums_domains_of_an_hour', () => {
    const buckets = hourlyTotals(
      { '2026-06-17': { '9': { 'youtube.com': 600, 'github.com': 300 } } },
      { from: '2026-06-17', to: '2026-06-17' },
    );
    expect(required(buckets[9]).seconds).toBe(900);
    expect(required(buckets[9]).perDomain).toEqual(
      new Map([
        ['youtube.com', 600],
        ['github.com', 300],
      ]),
    );
  });

  it('hourlyTotals_reads_the_day_of_the_range_end', () => {
    const buckets = hourlyTotals(
      {
        '2026-06-16': { '9': { 'youtube.com': 999 } },
        '2026-06-17': { '9': { 'youtube.com': 600 } },
      },
      { from: '2026-06-16', to: '2026-06-17' },
    );
    // The day of the range end is taken. Data of another day in the
    // range does not enter.
    expect(required(buckets[9]).seconds).toBe(600);
    expect(required(buckets[9]).perDomain.get('youtube.com')).toBe(600);
    expect(buckets.reduce((sum, bucket) => sum + bucket.seconds, 0)).toBe(600);
  });

  it('hourlyTotals_empty_input_gives_zero_buckets', () => {
    const buckets = hourlyTotals({}, { from: '2026-06-17', to: '2026-06-17' });
    expect(buckets).toHaveLength(24);
    expect(buckets.every((bucket) => bucket.seconds === 0 && bucket.perDomain.size === 0)).toBe(
      true,
    );
  });
});
