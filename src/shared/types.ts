/** Local date in ISO format without time: 2026-10-16 */
export type DayKey = string;

/** Storage key for a day: day:2026-10-16 */
export type DayStorageKey = `day:${DayKey}`;

/** Seconds per domain for one day, by hours: "0".."23" -> domain -> seconds. */
export type DayShard = Record<string, Record<string, number>>;

/** Daily limits in seconds per domain */
export type Limits = Record<string, number>;

export interface Settings {
  theme: 'system' | 'light' | 'dark';
}

export interface Meta {
  schemaVersion: number;
  installedAt: number;
}

/** Current tracking segment. The only record in storage.session */
export interface Segment {
  domain: string;
  /** Segment start time, ms */
  startedAt: number;
  /** Last commit time, ms. Equal to startedAt right after a commit */
  lastCommitAt: number;
  tabId: number;
  windowId: number;
}

export type Period = 'today' | 'week' | 'month' | 'year';
