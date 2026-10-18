import type { DayRange, DomainRow } from '@/shared/period';
import type { DayKey } from '@/shared/types';

/**
 * Colors of the placeholder tile that replaces the site icon. The tones
 * are dark and the contrast with the white letter is at least 4.5:1.
 */
export const TILE_COLORS = [
  '#334155',
  '#b91c1c',
  '#c2410c',
  '#b45309',
  '#15803d',
  '#0f766e',
  '#1d4ed8',
  '#6d28d9',
] as const;

/**
 * Tile color for a domain: the sum of the character codes modulo the
 * number of colors. One domain always gives the same color.
 */
export function tileColor(domain: string): string {
  let sum = 0;
  for (const char of domain) {
    sum += char.codePointAt(0) ?? 0;
  }
  // The remainder is an index inside the list. The first color is the
  // fallback for a list that is not there.
  return TILE_COLORS[sum % TILE_COLORS.length] ?? TILE_COLORS[0];
}

/**
 * Site icon URL from the Chrome cache. The caller builds the `/_favicon/`
 * path through `chrome.runtime.getURL`, so the function is pure and testable.
 * Chrome returns an icon only for an address that it has seen, so the icon
 * is built from the page URL. Without a known address, SiteIcon draws the tile.
 */
export function faviconUrl(pageUrl: string, getUrl: (path: string) => string): string {
  return `${getUrl('/_favicon/')}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
}

/**
 * Rounded share of the seconds from the maximum in percent. Zero if the
 * maximum is 0.
 */
export function sharePercent(seconds: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.round((seconds / max) * 100);
}

/**
 * Rows whose domain contains the query. Leading and trailing spaces are
 * dropped, and the case is not important. An empty query returns all rows
 * and keeps the input order. The result is always a new array.
 */
export function filterRows(rows: DomainRow[], query: string): DomainRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [...rows];
  }
  return rows.filter((row) => row.domain.includes(needle));
}

/** English month abbreviations in calendar order: day labels on the chart. */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Day label YYYY-MM-DD for the chart axis: '2026-10-16' -> 'Oct 16'. */
export function chartDayLabel(day: DayKey): string {
  const [, month = 1, date = 1] = day.split('-').map(Number);
  return `${MONTHS[month - 1] ?? MONTHS[0]} ${date}`;
}

/**
 * Date range label for the header chip. One day gives 'Oct 16'. A range
 * in one year gives 'Oct 12 - Oct 16'. A range across years gives the
 * year at both ends: 'Jun 18, 2025 - Jun 17, 2026'.
 */
export function rangeLabel(range: DayRange): string {
  if (range.from === range.to) {
    return chartDayLabel(range.from);
  }
  const from = chartDayLabel(range.from);
  const to = chartDayLabel(range.to);
  if (range.from.slice(0, 4) === range.to.slice(0, 4)) {
    return `${from} – ${to}`;
  }
  return `${from}, ${range.from.slice(0, 4)} – ${to}, ${range.to.slice(0, 4)}`;
}

/** Hour label for the chart axis: 9 -> '09:00'. */
export function chartHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** How many domains of the period stay as separate chart series. */
export const STACK_TOP_LIMIT = 5;

/** Stacked chart point: bucket label, top-domain seconds, sum of others. */
export interface StackPoint {
  label: string;
  values: Record<string, number>;
  other: number;
}

/**
 * Stacked chart points for each bucket. In `values`, the seconds of each
 * domain from `topDomains` for the bucket. A missing domain gives zero.
 * In `other`, the sum of the seconds of the domains outside the list.
 * The bucket order and labels are kept. The value maps have no prototype,
 * so a domain like `__proto__` does not break the series.
 */
export function buildStackSeries(
  buckets: readonly { label: string; perDomain: Map<string, number> }[],
  topDomains: readonly string[],
): StackPoint[] {
  const top = new Set(topDomains);
  return buckets.map((bucket) => {
    const values: Record<string, number> = Object.create(null);
    for (const domain of topDomains) {
      values[domain] = bucket.perDomain.get(domain) ?? 0;
    }
    let other = 0;
    for (const [domain, seconds] of bucket.perDomain) {
      if (!top.has(domain)) {
        other += seconds;
      }
    }
    return { label: bucket.label, values, other };
  });
}
