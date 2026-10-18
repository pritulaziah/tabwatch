import { localDayKey } from '@/shared/period';
import { isValidDomain, isValidLimitSeconds, SCHEMA_VERSION } from '@/shared/settings';
import type { DayKey, DayShard, Limits, Settings } from '@/shared/types';

export type ImportMode = 'merge' | 'replace';

export type ImportError = 'damaged' | 'newerVersion';

/** Days and limits: the form that storage and import exchange. */
export interface TransferData {
  days: Record<DayKey, DayShard>;
  limits: Limits;
}

/**
 * Export document: days, limits, and settings plus the version and the
 * timestamp.
 */
export interface TransferFile {
  app: 'tabwatch';
  schemaVersion: number;
  exportedAt: string;
  days: Record<DayKey, DayShard>;
  limits: Limits;
  settings: Settings;
}

export interface ImportReport {
  affectedDays: number;
  domains: number;
  seconds: number;
  droppedRecords: number;
}

export interface ImportOutcome extends TransferData {
  report: ImportReport;
}

export type ImportParseResult =
  { ok: true; data: TransferData; droppedRecords: number } | { ok: false; error: ImportError };

/**
 * Maximum seconds per domain per day: the bound of a day record and of the
 * sum after merge.
 */
const DAY_MAX_SECONDS = 86_400;

/** Day key: a local date in the format YYYY-MM-DD. */
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Hour key in a day: the string "0"..."23" without a leading zero. */
const HOUR_KEY_PATTERN = /^(?:[0-9]|1[0-9]|2[0-3])$/;

/**
 * Export document: days and limits as they are, the schema version, the
 * timestamp, and the settings.
 */
export function buildExport(
  days: Record<DayKey, DayShard>,
  limits: Limits,
  settings: Settings,
  now: number,
): TransferFile {
  return {
    app: 'tabwatch',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    days,
    limits,
    settings,
  };
}

/** Export file name: the export day in local time. */
export function exportFileName(now: number): string {
  return `tabwatch-export-${localDayKey(now)}.json`;
}

/**
 * Import file parse. A damaged document is rejected as a whole. A document
 * with a newer schema version is rejected with a separate error. Invalid day,
 * hour, and limit records are dropped and counted. Settings and the timestamp
 * are not read. The import moves only days and limits.
 */
export function parseImport(text: string): ImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'damaged' };
  }
  if (!isPlainRecord(parsed) || parsed.app !== 'tabwatch') {
    return { ok: false, error: 'damaged' };
  }

  const version = parsed.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'damaged' };
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: 'newerVersion' };
  }

  const rawDays = parsed.days;
  const rawLimits = parsed.limits;
  if (!isPlainRecord(rawDays) || !isPlainRecord(rawLimits)) {
    return { ok: false, error: 'damaged' };
  }

  let droppedRecords = 0;
  const days: Record<DayKey, DayShard> = {};
  for (const [day, value] of Object.entries(rawDays)) {
    if (!isDayKey(day) || !isPlainRecord(value)) {
      droppedRecords += 1;
      continue;
    }
    const shard: DayShard = Object.create(null);
    for (const [hour, hourValue] of Object.entries(value)) {
      if (!isHourKey(hour)) {
        droppedRecords += 1;
        continue;
      }
      if (!isPlainRecord(hourValue)) {
        droppedRecords += 1;
        continue;
      }
      // The hour map has no prototype. A __proto__ domain becomes an own key.
      const bucket: Record<string, number> = Object.create(null);
      for (const [domain, seconds] of Object.entries(hourValue)) {
        if (isValidDomain(domain) && isDaySeconds(seconds)) {
          bucket[domain] = seconds;
        } else {
          droppedRecords += 1;
        }
      }
      // An hour without valid pairs does not go into the result. An empty hour
      // does not count as dropped.
      if (Object.keys(bucket).length > 0) {
        shard[hour] = bucket;
      }
    }
    // A day without valid hours does not go into the result. An empty day does
    // not count as dropped.
    if (Object.keys(shard).length > 0) {
      days[day] = shard;
    }
  }

  const limits: Limits = Object.create(null);
  for (const [domain, seconds] of Object.entries(rawLimits)) {
    if (isValidDomain(domain) && isValidLimitSeconds(seconds)) {
      limits[domain] = seconds;
    } else {
      droppedRecords += 1;
    }
  }

  return { ok: true, data: { days, limits }, droppedRecords };
}

/**
 * Merge of the file with the current data. Seconds of the day-hour-domain
 * triple are added and capped at the daily maximum. Limits take the maximum
 * per domain. Days and limits outside the file stay. The report is computed
 * from the file data. The inputs do not change.
 */
export function mergeImport(
  current: TransferData,
  data: TransferData,
  droppedRecords: number,
): ImportOutcome {
  // Maps without a prototype. A domain like __proto__ becomes an own key.
  const days: Record<DayKey, DayShard> = {};
  for (const [day, shard] of Object.entries(current.days)) {
    days[day] = copyDayShard(shard);
  }
  for (const [day, shard] of Object.entries(data.days)) {
    const merged: DayShard = days[day] ?? Object.create(null);
    for (const [hour, bucket] of Object.entries(shard)) {
      const mergedHour: Record<string, number> = merged[hour] ?? Object.create(null);
      for (const [domain, seconds] of Object.entries(bucket)) {
        // The current value is read only by an own key. An inherited prototype
        // member is not seconds.
        const currentSeconds = ownSeconds(mergedHour, domain);
        mergedHour[domain] = Math.min(currentSeconds + seconds, DAY_MAX_SECONDS);
      }
      merged[hour] = mergedHour;
    }
    days[day] = merged;
  }

  const limits: Limits = Object.assign(Object.create(null), current.limits);
  for (const [domain, seconds] of Object.entries(data.limits)) {
    const currentSeconds = ownSeconds(limits, domain);
    limits[domain] = Math.max(currentSeconds, seconds);
  }

  return { days, limits, report: buildReport(data, droppedRecords) };
}

/**
 * Replace. Days and limits come from the file as a whole. Days outside the
 * file disappear. The report is computed from the file data. The input does
 * not change.
 */
export function replaceImport(data: TransferData, droppedRecords: number): ImportOutcome {
  const days: Record<DayKey, DayShard> = {};
  for (const [day, shard] of Object.entries(data.days)) {
    days[day] = copyDayShard(shard);
  }
  return { days, limits: { ...data.limits }, report: buildReport(data, droppedRecords) };
}

/**
 * Report on the valid records of the file: days, unique domains of days and
 * limits, and the seconds sum.
 */
function buildReport(data: TransferData, droppedRecords: number): ImportReport {
  const domains = new Set<string>();
  let seconds = 0;
  for (const shard of Object.values(data.days)) {
    for (const bucket of Object.values(shard)) {
      for (const [domain, value] of Object.entries(bucket)) {
        domains.add(domain);
        seconds += value;
      }
    }
  }
  for (const domain of Object.keys(data.limits)) {
    domains.add(domain);
  }
  return {
    affectedDays: Object.keys(data.days).length,
    domains: domains.size,
    seconds,
    droppedRecords,
  };
}

/** Day key by the format YYYY-MM-DD. Calendar correctness is not checked. */
function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && DAY_KEY_PATTERN.test(value);
}

/** Hour key by the format "0"..."23" without a leading zero. */
function isHourKey(value: string): boolean {
  return HOUR_KEY_PATTERN.test(value);
}

/** A copy of the day: the hour and domain maps have no prototype. */
function copyDayShard(shard: DayShard): DayShard {
  const copy: DayShard = Object.create(null);
  for (const [hour, bucket] of Object.entries(shard)) {
    copy[hour] = Object.assign(Object.create(null), bucket);
  }
  return copy;
}

/**
 * Seconds of a domain in the map. The value is read only by an own key: an
 * inherited prototype member is not seconds.
 */
function ownSeconds(map: Record<string, number>, domain: string): number {
  const value = Object.hasOwn(map, domain) ? map[domain] : undefined;
  return value ?? 0;
}

/** Day seconds: an integer from 0 to the daily maximum. */
function isDaySeconds(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= DAY_MAX_SECONDS
  );
}

/** A JSON object record: not null and not an array. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
