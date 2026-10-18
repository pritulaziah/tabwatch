import { describe, expect, it } from 'vitest';

import { required } from '../helpers/required';
import {
  STACK_TOP_LIMIT,
  TILE_COLORS,
  buildStackSeries,
  chartDayLabel,
  chartHourLabel,
  faviconUrl,
  filterRows,
  rangeLabel,
  sharePercent,
  tileColor,
} from '@/ui/display';

describe('display', () => {
  it('faviconUrl_builds_the_path_with_the_encoded_page_url_and_size', () => {
    const getUrl = (path: string): string => `chrome-extension://abc${path}`;

    expect(faviconUrl('https://www.youtube.com/watch?v=1', getUrl)).toBe(
      'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D1&size=32',
    );
  });

  it('tileColor_is_stable_and_comes_from_the_palette', () => {
    const domain = 'youtube.com';

    expect(tileColor(domain)).toBe(tileColor(domain));
    for (const sample of ['youtube.com', 'github.com', 'notion.com', 'example.org']) {
      expect(TILE_COLORS).toContain(tileColor(sample));
    }
  });

  it('tileColor_spreads_domains_across_the_palette', () => {
    const domains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com', 'g.com', 'h.com'];
    const colors = new Set(domains.map((domain) => tileColor(domain)));

    expect(colors.size).toBeGreaterThan(1);
  });

  it('sharePercent_top_row_is_100', () => {
    expect(sharePercent(600, 600)).toBe(100);
  });

  it('sharePercent_rounds_the_share_of_the_maximum', () => {
    expect(sharePercent(300, 600)).toBe(50);
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(0, 600)).toBe(0);
  });

  it('sharePercent_with_zero_maximum_is_zero', () => {
    expect(sharePercent(0, 0)).toBe(0);
  });

  it('filterRows_returns_all_rows_for_an_empty_query', () => {
    const rows = [
      { domain: 'youtube.com', seconds: 600 },
      { domain: 'github.com', seconds: 300 },
    ];

    const all = filterRows(rows, '');

    expect(all).toEqual(rows);
    expect(all).not.toBe(rows);
    expect(filterRows(rows, '  ')).toEqual(rows);
  });

  it('filterRows_matches_a_substring_case_insensitively', () => {
    const rows = [
      { domain: 'youtube.com', seconds: 600 },
      { domain: 'github.com', seconds: 300 },
    ];

    expect(filterRows(rows, 'YOU')).toEqual([{ domain: 'youtube.com', seconds: 600 }]);
    expect(filterRows(rows, 'tube')).toEqual([{ domain: 'youtube.com', seconds: 600 }]);
  });

  it('filterRows_drops_non_matching_rows', () => {
    const rows = [
      { domain: 'youtube.com', seconds: 600 },
      { domain: 'github.com', seconds: 300 },
    ];

    expect(filterRows(rows, 'zzz')).toEqual([]);
  });

  it('filterRows_keeps_the_row_order', () => {
    const rows = [
      { domain: 'youtube.com', seconds: 600 },
      { domain: 'github.com', seconds: 300 },
      { domain: 'notion.com', seconds: 200 },
      { domain: 'gitlab.com', seconds: 100 },
    ];

    expect(filterRows(rows, 'git')).toEqual([
      { domain: 'github.com', seconds: 300 },
      { domain: 'gitlab.com', seconds: 100 },
    ]);
  });

  it('chartDayLabel_formats_a_day_as_month_and_number', () => {
    expect(chartDayLabel('2026-10-16')).toBe('Oct 16');
    expect(chartDayLabel('2026-01-05')).toBe('Jan 5');
  });

  it('rangeLabel_shows_a_single_day', () => {
    expect(rangeLabel({ from: '2026-10-16', to: '2026-10-16' })).toBe('Oct 16');
  });

  it('rangeLabel_shows_a_range_inside_one_year', () => {
    expect(rangeLabel({ from: '2026-10-12', to: '2026-10-16' })).toBe('Oct 12 – Oct 16');
  });

  it('rangeLabel_shows_the_years_of_a_range_across_years', () => {
    expect(rangeLabel({ from: '2025-06-18', to: '2026-06-17' })).toBe(
      'Jun 18, 2025 – Jun 17, 2026',
    );
  });

  it('chartHourLabel_pads_the_hour', () => {
    expect(chartHourLabel(9)).toBe('09:00');
    expect(chartHourLabel(0)).toBe('00:00');
    expect(chartHourLabel(23)).toBe('23:00');
  });

  it('buildStackSeries_keeps_one_point_per_bucket', () => {
    const buckets = [
      { label: '09:00', perDomain: new Map([['youtube.com', 60]]) },
      { label: '10:00', perDomain: new Map([['github.com', 30]]) },
      { label: '11:00', perDomain: new Map<string, number>() },
    ];

    const points = buildStackSeries(buckets, ['youtube.com', 'github.com']);

    expect(points).toHaveLength(3);
    expect(points.map((point) => point.label)).toEqual(['09:00', '10:00', '11:00']);
    // Value maps have no prototype: a domain like `__proto__` does not
    // break the series.
    for (const point of points) {
      expect(Object.getPrototypeOf(point.values)).toBeNull();
    }
    expect(required(points[0]).values['youtube.com']).toBe(60);
    expect(required(points[1]).values['github.com']).toBe(30);
  });

  it('buildStackSeries_puts_domains_outside_the_top_into_other', () => {
    expect(STACK_TOP_LIMIT).toBe(5);
    const topDomains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
    const buckets = [
      {
        label: '09:00',
        perDomain: new Map([
          ['a.com', 10],
          ['f.com', 3],
          ['g.com', 2],
        ]),
      },
    ];

    const point = required(buildStackSeries(buckets, topDomains)[0]);

    expect(point.values['a.com']).toBe(10);
    expect(point.values['f.com']).toBeUndefined();
    expect(point.other).toBe(5);
  });

  it('buildStackSeries_fills_missing_top_domains_with_zero', () => {
    const topDomains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
    const buckets = [{ label: '09:00', perDomain: new Map([['c.com', 7]]) }];

    const point = required(buildStackSeries(buckets, topDomains)[0]);

    expect(point.values['a.com']).toBe(0);
    expect(point.values['b.com']).toBe(0);
    expect(point.values['c.com']).toBe(7);
    expect(point.values['d.com']).toBe(0);
    expect(point.values['e.com']).toBe(0);
  });

  it('buildStackSeries_keeps_zero_buckets', () => {
    const buckets = [{ label: '09:00', perDomain: new Map<string, number>() }];

    const point = required(buildStackSeries(buckets, ['a.com', 'b.com'])[0]);

    expect(point.values['a.com']).toBe(0);
    expect(point.values['b.com']).toBe(0);
    expect(point.other).toBe(0);
  });
});
