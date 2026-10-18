import { useEffect, useMemo, useRef, useState } from 'react';

import { getDays, getLimits, getSegment } from '@/background/store';
import { overLimitCount } from '@/ui/limits';
import {
  aggregate,
  dailyTotals,
  dayKeys,
  hourlyTotals,
  localDayKey,
  mergeSegment,
  previousRange,
  rangeFor,
  sortRows,
} from '@/shared/period';
import type { Aggregated, DailyTotal, DomainRow, HourlyTotal } from '@/shared/period';
import type { DayKey, DayShard, Limits, Period, Segment } from '@/shared/types';

/** Running segment: the domain and the integer seconds from its start. */
export interface TrackingState {
  domain: string;
  seconds: number;
}

/** Statistics view data for the selected period. */
export interface Stats {
  total: number;
  sites: number;
  rows: DomainRow[];
  overLimit: number;
  tracking: TrackingState | null;
  limits: Limits;
  daily: DailyTotal[];
  hourly: HourlyTotal[];
  todayRows: DomainRow[];
  periodTotals: Record<Period, number>;
  previousTotal: number;
  avgPerDay: number;
  newSites: number;
  daysTracked: number;
  visitedDomains: string[];
  loading: boolean;
  error: boolean;
}

/**
 * Storage snapshot: the days of the year range, the limits, and the
 * segment at the read time.
 */
interface Snapshot {
  days: Record<DayKey, DayShard>;
  limits: Limits;
  segment: Segment | null;
}

/** Period order. The aggregations are computed for all four at once. */
const PERIODS: readonly Period[] = ['today', 'week', 'month', 'year'];

const EMPTY_SNAPSHOT: Snapshot = { days: {}, limits: {}, segment: null };

/** Change of the view inputs: days or limits in local, segment in session. */
function affectsStats(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
): boolean {
  if (areaName === 'local') {
    return Object.keys(changes).some((key) => key.startsWith('day:') || key === 'limits');
  }
  if (areaName === 'session') {
    return changes.segment !== undefined;
  }
  return false;
}

/**
 * Statistics view data. It reads the days of the year range with the
 * previous year, the limits, and the segment at mount and on storage
 * events. The sums of the four periods, the chart series, and the card
 * numbers come from the snapshot. The live segment is added on each
 * render from the ticking now, so the live counters do not read the
 * storage again.
 */
export function useStats(period: Period, now: number): Stats {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** Number of the last started read. Answers of stale reads are dropped. */
  const readIdRef = useRef(0);

  useEffect(() => {
    let disposed = false;

    const read = async (): Promise<void> => {
      const readId = readIdRef.current + 1;
      readIdRef.current = readId;
      try {
        // The year range and the previous year are read at once. One snapshot
        // gives the data of all periods and the comparison with the previous
        // period. The bounds come from the read time.
        const readNow = Date.now();
        const [days, limits, segment] = await Promise.all([
          getDays(
            dayKeys({
              from: previousRange('year', readNow).from,
              to: rangeFor('year', readNow).to,
            }),
          ),
          getLimits(),
          getSegment(),
        ]);
        if (disposed || readId !== readIdRef.current) {
          return;
        }
        setSnapshot({ days, limits, segment });
        setError(false);
      } catch (readError) {
        if (disposed || readId !== readIdRef.current) {
          return;
        }
        // Read error: empty data and the flag for the banner. The surface
        // continues to work.
        console.error('[tabwatch] failed to read stats', readError);
        setSnapshot(EMPTY_SNAPSHOT);
        setError(true);
      } finally {
        if (!disposed && readId === readIdRef.current) {
          setLoading(false);
        }
      }
    };

    void read();

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ): void => {
      if (affectsStats(changes, areaName)) {
        void read();
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);

    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  const day = localDayKey(now);
  const stored = useMemo(() => {
    const periods = {} as Record<Period, Aggregated>;
    for (const value of PERIODS) {
      periods[value] = aggregate(snapshot.days, rangeFor(value, now));
    }
    const daily = dailyTotals(snapshot.days, rangeFor(period, now));
    const hourly = hourlyTotals(snapshot.days, rangeFor(period, now));
    const previous = aggregate(snapshot.days, previousRange(period, now));
    const visitedDomains = [...periods.year.perDomain.entries()]
      .filter(([, seconds]) => seconds > 0)
      .map(([domain]) => domain)
      .sort();
    return { periods, daily, hourly, previous, visitedDomains };
    // The period bounds depend only on the local day of the now value.
    // Ticking seconds do not recompute the aggregations, the series, and the
    // visited domain list.
  }, [snapshot, period, day]);

  const range = rangeFor(period, now);
  const aggregated = mergeSegment(stored.periods[period], snapshot.segment, range, now);
  const rows = sortRows(aggregated.perDomain);
  // The Today panel and the over-limit counter always refer to the current
  // day. The limit is daily.
  const todayAggregated = mergeSegment(
    stored.periods.today,
    snapshot.segment,
    rangeFor('today', now),
    now,
  );
  const todayRows = sortRows(todayAggregated.perDomain);
  const overLimit = overLimitCount(todayAggregated.perDomain, snapshot.limits);
  const tracking =
    snapshot.segment === null
      ? null
      : {
          domain: snapshot.segment.domain,
          seconds: Math.floor(Math.max(0, now - snapshot.segment.startedAt) / 1000),
        };

  // The live segment is added to each period whose range holds its day.
  // The card sums grow with the counter.
  const periodTotals = {} as Record<Period, number>;
  for (const value of PERIODS) {
    periodTotals[value] = mergeSegment(
      stored.periods[value],
      snapshot.segment,
      rangeFor(value, now),
      now,
    ).total;
  }

  // The live seconds also go into the column of the current day if the
  // selected period holds it. The day sum and the segment domain seconds
  // for the stacked columns grow.
  let daily = stored.daily;
  let hourly = stored.hourly;
  const liveSeconds = tracking?.seconds ?? 0;
  if (snapshot.segment !== null && liveSeconds > 0) {
    const domain = snapshot.segment.domain;
    if (day >= range.from && day <= range.to) {
      daily = daily.map((row) => {
        if (row.day !== day) {
          return row;
        }
        const perDomain = new Map(row.perDomain);
        perDomain.set(domain, (perDomain.get(domain) ?? 0) + liveSeconds);
        return { day: row.day, seconds: row.seconds + liveSeconds, perDomain };
      });
    }
    // The hourly series is built on the current day. The segment is added to
    // the current hour.
    const hour = new Date(now).getHours();
    hourly = hourly.map((bucket) => {
      if (bucket.hour !== hour) {
        return bucket;
      }
      const perDomain = new Map(bucket.perDomain);
      perDomain.set(domain, (perDomain.get(domain) ?? 0) + liveSeconds);
      return { hour: bucket.hour, seconds: bucket.seconds + liveSeconds, perDomain };
    });
  }

  const daysTracked = daily.filter((row) => row.seconds > 0).length;
  const avgPerDay = daysTracked === 0 ? 0 : Math.floor(aggregated.total / daysTracked);
  // New sites: the domains of the period with no time in the previous period.
  const newSites = [...aggregated.perDomain.keys()].filter(
    (domain) => !stored.previous.perDomain.has(domain),
  ).length;

  return {
    total: aggregated.total,
    sites: aggregated.perDomain.size,
    rows,
    overLimit,
    tracking,
    limits: snapshot.limits,
    daily,
    hourly,
    todayRows,
    periodTotals,
    previousTotal: stored.previous.total,
    avgPerDay,
    newSites,
    daysTracked,
    visitedDomains: stored.visitedDomains,
    loading,
    error,
  };
}
