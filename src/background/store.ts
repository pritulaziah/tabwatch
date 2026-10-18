import { isValidDomain, sanitizeLimits, sanitizeSettings, SCHEMA_VERSION } from '@/shared/settings';
import {
  MAINTENANCE_KEY,
  MaintenanceActiveError,
  isMaintenance,
  maintenanceRecord,
} from '@/shared/maintenance';
import type {
  DayKey,
  DayShard,
  DayStorageKey,
  Limits,
  Meta,
  Segment,
  Settings,
} from '@/shared/types';

const SEGMENT_KEY = 'segment';
const LIMITS_KEY = 'limits';
const SETTINGS_KEY = 'settings';
const META_KEY = 'meta';

const DAY_KEY_PREFIX = 'day:';
const SECONDS_PER_DAY_MAX = 86_400;

/** Hour key in a day: the string "0"..."23" without a leading zero. */
const HOUR_KEY_PATTERN = /^(?:[0-9]|1[0-9]|2[0-3])$/;

/** Day key in storage.local: day:YYYY-MM-DD. */
function dayStorageKey(day: DayKey): DayStorageKey {
  return `${DAY_KEY_PREFIX}${day}`;
}

/** Day from a storage key. Keys of another form give null. */
function dayFromStorageKey(key: string): DayKey | null {
  return key.startsWith(DAY_KEY_PREFIX) ? key.slice(DAY_KEY_PREFIX.length) : null;
}

/** Current segment from storage.session. An invalid record gives null. */
export async function getSegment(): Promise<Segment | null> {
  const stored = await chrome.storage.session.get(SEGMENT_KEY);
  return sanitizeSegment(stored[SEGMENT_KEY]);
}

/** Saves the segment in storage.session. null deletes the record. */
export async function setSegment(segment: Segment | null): Promise<void> {
  if (segment === null) {
    await chrome.storage.session.remove(SEGMENT_KEY);
    return;
  }
  await chrome.storage.session.set({ [SEGMENT_KEY]: segment });
}

/**
 * Adds seconds to a domain in an hour of a day. Seconds are rounded down.
 * Non-finite values and values less than one are not written. An hour
 * outside 0-23 and a non-integer hour are not written. A bulk write from
 * the interface defers the commit: MaintenanceActiveError is thrown and the
 * caller keeps the commit for a retry.
 */
export async function addSeconds(
  day: DayKey,
  hour: number,
  domain: string,
  seconds: number,
): Promise<void> {
  const wholeSeconds = Math.floor(seconds);
  if (!Number.isFinite(wholeSeconds) || wholeSeconds < 1 || !isValidHour(hour)) {
    return;
  }
  const key = dayStorageKey(day);
  const stored = await chrome.storage.local.get(key);
  // The marker is read after the day: a bulk write can start between the
  // two calls, and this write must not overwrite the imported data.
  if (await isMaintenanceActive()) {
    throw new MaintenanceActiveError();
  }
  const shard = sanitizeDayShard(stored[key]) ?? Object.create(null);
  const hourKey = String(hour);
  // Maps without a prototype. A domain like __proto__ becomes an own key.
  const bucket: Record<string, number> = shard[hourKey] ?? Object.create(null);
  bucket[domain] = (bucket[domain] ?? 0) + wholeSeconds;
  shard[hourKey] = bucket;
  await chrome.storage.local.set({ [key]: shard });
}

/** Marker of a bulk write: true while the interface rewrites the data. */
export async function isMaintenanceActive(): Promise<boolean> {
  const stored = await chrome.storage.session.get(MAINTENANCE_KEY);
  return isMaintenance(stored[MAINTENANCE_KEY], Date.now());
}

/**
 * Sets the marker of a bulk write. The worker defers commits while the
 * marker is fresh, so the read and the write of the caller do not
 * interleave with a commit.
 */
export async function beginMaintenance(): Promise<void> {
  await chrome.storage.session.set({ [MAINTENANCE_KEY]: maintenanceRecord(Date.now()) });
}

/** Clears the marker of a bulk write. */
export async function endMaintenance(): Promise<void> {
  await chrome.storage.session.remove(MAINTENANCE_KEY);
}

/**
 * Reads days in one request. Invalid records are dropped. Missing days do not
 * go into the result.
 */
export async function getDays(days: DayKey[]): Promise<Record<DayKey, DayShard>> {
  const stored = await chrome.storage.local.get(days.map(dayStorageKey));
  const result: Record<DayKey, DayShard> = {};
  for (const day of days) {
    const shard = sanitizeDayShard(stored[dayStorageKey(day)]);
    if (shard !== null) {
      result[day] = shard;
    }
  }
  return result;
}

/**
 * Reads all days in one request. Invalid records are dropped. Other keys do
 * not go into the result.
 */
export async function getAllDays(): Promise<Record<DayKey, DayShard>> {
  const stored = await chrome.storage.local.get(null);
  const result: Record<DayKey, DayShard> = {};
  for (const [key, value] of Object.entries(stored)) {
    const day = dayFromStorageKey(key);
    if (day === null) {
      continue;
    }
    const shard = sanitizeDayShard(value);
    if (shard !== null) {
      result[day] = shard;
    }
  }
  return result;
}

/** Days from all storage keys in one request. Key values are not checked. */
export async function getDayKeys(): Promise<DayKey[]> {
  const stored = await chrome.storage.local.get(null);
  const days: DayKey[] = [];
  for (const key of Object.keys(stored)) {
    const day = dayFromStorageKey(key);
    if (day !== null) {
      days.push(day);
    }
  }
  return days;
}

/** Writes days with complete keys. An empty map does not access the storage. */
export async function setDays(days: Record<DayKey, DayShard>): Promise<void> {
  const entries = Object.entries(days);
  if (entries.length === 0) {
    return;
  }
  const items: Record<string, DayShard> = {};
  for (const [day, shard] of entries) {
    items[dayStorageKey(day)] = shard;
  }
  await chrome.storage.local.set(items);
}

/** Removes the given days. An empty list does not access the storage. */
export async function removeDays(days: DayKey[]): Promise<void> {
  if (days.length === 0) {
    return;
  }
  await chrome.storage.local.remove(days.map(dayStorageKey));
}

/** Limits from storage.local. Invalid records are dropped. */
export async function getLimits(): Promise<Limits> {
  const stored = await chrome.storage.local.get(LIMITS_KEY);
  return sanitizeLimits(stored[LIMITS_KEY]);
}

/** Saves the limits in storage.local. */
export async function setLimits(limits: Limits): Promise<void> {
  await chrome.storage.local.set({ [LIMITS_KEY]: limits });
}

/** Settings from storage.local. Invalid fields are replaced with defaults. */
export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings(stored[SETTINGS_KEY]);
}

/** Saves the settings in storage.local. */
export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

/**
 * Meta from storage.local. If the record is missing or invalid, a new record
 * is created and saved.
 */
export async function getMeta(): Promise<Meta> {
  const stored = await chrome.storage.local.get(META_KEY);
  const meta = sanitizeMeta(stored[META_KEY]);
  if (meta !== null) {
    return meta;
  }
  const created: Meta = { schemaVersion: SCHEMA_VERSION, installedAt: Date.now() };
  await chrome.storage.local.set({ [META_KEY]: created });
  return created;
}

/**
 * Parses a day record. A non-object gives null. An invalid hour key and an
 * invalid domain-seconds pair are dropped. An hour without valid pairs and a
 * day without valid hours do not go into the result. Maps at both levels have
 * no prototype.
 */
function sanitizeDayShard(value: unknown): DayShard | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const shard: DayShard = Object.create(null);
  for (const [hour, hourValue] of Object.entries(record)) {
    if (!HOUR_KEY_PATTERN.test(hour)) {
      continue;
    }
    const entries = asRecord(hourValue);
    if (entries === null) {
      continue;
    }
    const bucket: Record<string, number> = Object.create(null);
    for (const [domain, seconds] of Object.entries(entries)) {
      if (isValidDomain(domain) && isDaySeconds(seconds)) {
        bucket[domain] = seconds;
      }
    }
    if (Object.keys(bucket).length > 0) {
      shard[hour] = bucket;
    }
  }
  return Object.keys(shard).length > 0 ? shard : null;
}

/** Record hour: an integer from 0 to 23. */
function isValidHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

/**
 * Seconds of a domain-seconds pair: a finite number from 0 to the daily
 * maximum.
 */
function isDaySeconds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= SECONDS_PER_DAY_MAX
  );
}

/** Parses the segment. All fields are required and need the correct type. */
function sanitizeSegment(value: unknown): Segment | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const { domain, startedAt, lastCommitAt, tabId, windowId } = record;
  if (
    !isValidDomain(domain) ||
    !isFiniteNumber(startedAt) ||
    !isFiniteNumber(lastCommitAt) ||
    !isFiniteNumber(tabId) ||
    !isFiniteNumber(windowId)
  ) {
    return null;
  }
  return { domain, startedAt, lastCommitAt, tabId, windowId };
}

/**
 * Parses the meta: schemaVersion is an integer, installedAt is a finite
 * number.
 */
function sanitizeMeta(value: unknown): Meta | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const { schemaVersion, installedAt } = record;
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    !isFiniteNumber(installedAt)
  ) {
    return null;
  }
  return { schemaVersion, installedAt };
}

/** Storage record as an object. Arrays and primitives give null. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
