import type { DayKey, DayShard, Period, Segment } from '@/shared/types';

export interface DayRange {
  from: DayKey;
  to: DayKey;
}

export interface Aggregated {
  total: number;
  perDomain: Map<string, number>;
}

export interface DomainRow {
  domain: string;
  seconds: number;
}

export interface DailyTotal {
  day: DayKey;
  seconds: number;
  perDomain: Map<string, number>;
}

export interface HourlyTotal {
  hour: number;
  seconds: number;
  perDomain: Map<string, number>;
}

/** Days in the yearly period, including today. */
const YEAR_DAYS = 365;

/** Hours in a day: the hourly series has this number of buckets. */
const HOURS_PER_DAY = 24;

/** Local date of the moment ts in the format YYYY-MM-DD. */
export function localDayKey(ts: number): DayKey {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local noon of the day from the key YYYY-MM-DD. */
function dayKeyToDate(day: DayKey): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12, 0, 0);
}

/**
 * The day shifted by days days. Date components are shifted, not milliseconds.
 * In zones with daylight saving time, days of 23 or 25 hours give a skipped
 * or repeated day otherwise.
 */
function shiftDay(day: DayKey, days: number): DayKey {
  const date = dayKeyToDate(day);
  date.setDate(date.getDate() + days);
  return localDayKey(date.getTime());
}

/** Period bounds by local dates. from and to are inclusive. */
export function rangeFor(period: Period, now: number): DayRange {
  const today = localDayKey(now);
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      // The week starts on Monday. getDay() gives 0 for Sunday.
      const mondayOffset = (new Date(now).getDay() + 6) % 7;
      return { from: shiftDay(today, -mondayOffset), to: today };
    }
    case 'month': {
      const date = new Date(now);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return { from: `${date.getFullYear()}-${month}-01`, to: today };
    }
    case 'year':
      return { from: shiftDay(today, -(YEAR_DAYS - 1)), to: today };
  }
}

/**
 * Bounds of the previous period. For today, it is yesterday. For a week, it
 * is the previous calendar week (Monday to Sunday). For a month, it is the
 * whole previous calendar month. For a year, it is 365 days before the start
 * of the current yearly range. Both bounds are inclusive.
 */
export function previousRange(period: Period, now: number): DayRange {
  const range = rangeFor(period, now);
  switch (period) {
    case 'today': {
      const yesterday = shiftDay(range.to, -1);
      return { from: yesterday, to: yesterday };
    }
    case 'week':
      // The current week started on Monday. The previous week is the seven
      // days before it.
      return { from: shiftDay(range.from, -7), to: shiftDay(range.from, -1) };
    case 'month': {
      // The day before the first day of the month is the last day of the
      // previous month.
      const lastDay = shiftDay(range.from, -1);
      return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
    }
    case 'year':
      return { from: shiftDay(range.from, -YEAR_DAYS), to: shiftDay(range.from, -1) };
  }
}

/** All local days of the range in order, including both bounds. */
export function dayKeys(range: DayRange): DayKey[] {
  const keys: DayKey[] = [];
  const date = dayKeyToDate(range.from);
  let key = localDayKey(date.getTime());
  while (key <= range.to) {
    keys.push(key);
    date.setDate(date.getDate() + 1);
    key = localDayKey(date.getTime());
  }
  return keys;
}

/**
 * Seconds sums per domain for the days of the range across all hours. A day
 * outside the range and a missing day give zero.
 */
export function aggregate(days: Record<DayKey, DayShard>, range: DayRange): Aggregated {
  const perDomain = new Map<string, number>();
  let total = 0;
  for (const key of dayKeys(range)) {
    const shard = days[key];
    if (shard === undefined) {
      continue;
    }
    for (const hourEntries of Object.values(shard)) {
      for (const [domain, seconds] of Object.entries(hourEntries)) {
        perDomain.set(domain, (perDomain.get(domain) ?? 0) + seconds);
        total += seconds;
      }
    }
  }
  // Domains with a zero sum do not go into the top list. sites counts only
  // non-zero values.
  for (const [domain, seconds] of perDomain) {
    if (seconds === 0) {
      perDomain.delete(domain);
    }
  }
  return { total, perDomain };
}

/**
 * Seconds for each day of the range in order: the sum of all hours of the day
 * and the seconds per domain for stacked columns. A missing day gives zero
 * and an empty map. Days outside the range do not go into the series. The
 * input does not change.
 */
export function dailyTotals(days: Record<DayKey, DayShard>, range: DayRange): DailyTotal[] {
  return dayKeys(range).map((day) => {
    const shard = days[day];
    if (shard === undefined) {
      return { day, seconds: 0, perDomain: new Map<string, number>() };
    }
    const perDomain = new Map<string, number>();
    let seconds = 0;
    for (const hourEntries of Object.values(shard)) {
      for (const [domain, value] of Object.entries(hourEntries)) {
        perDomain.set(domain, (perDomain.get(domain) ?? 0) + value);
        seconds += value;
      }
    }
    return { day, seconds, perDomain };
  });
}

/**
 * Seconds for the 24 hours of the last day of the range in order 0...23: the
 * sum of the hour and the seconds per domain for stacked columns. A missing
 * day and an hour without data give zero and an empty map. The input does not
 * change.
 */
export function hourlyTotals(days: Record<DayKey, DayShard>, range: DayRange): HourlyTotal[] {
  const shard = days[range.to];
  const buckets: HourlyTotal[] = [];
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    const perDomain = new Map<string, number>();
    let seconds = 0;
    const hourEntries = shard?.[String(hour)];
    if (hourEntries !== undefined) {
      for (const [domain, value] of Object.entries(hourEntries)) {
        perDomain.set(domain, value);
        seconds += value;
      }
    }
    buckets.push({ hour, seconds, perDomain });
  }
  return buckets;
}

/** Rows in descending order of seconds. On a tie, in alphabetical order. */
export function sortRows(perDomain: Map<string, number>): DomainRow[] {
  const rows = [...perDomain.entries()].map(([domain, seconds]) => ({ domain, seconds }));
  rows.sort((a, b) => b.seconds - a.seconds || compareDomain(a.domain, b.domain));
  return rows;
}

/** Plain string comparison for the order of domains with equal seconds. */
function compareDomain(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Live segment. If it exists and the local day of the moment now falls in the
 * range, whole seconds from the start of the segment are added to the domain.
 * The whole segment belongs to the day of the moment now, as a commit would
 * assign it. The input does not change.
 */
export function mergeSegment(
  aggregated: Aggregated,
  segment: Segment | null,
  range: DayRange,
  now: number,
): Aggregated {
  if (segment === null) {
    return aggregated;
  }
  const day = localDayKey(now);
  if (day < range.from || day > range.to) {
    return aggregated;
  }
  const seconds = Math.floor(Math.max(0, now - segment.startedAt) / 1000);
  if (seconds === 0) {
    return aggregated;
  }
  const perDomain = new Map(aggregated.perDomain);
  perDomain.set(segment.domain, (perDomain.get(segment.domain) ?? 0) + seconds);
  return { total: aggregated.total + seconds, perDomain };
}
