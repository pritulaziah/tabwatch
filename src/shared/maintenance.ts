/**
 * Marker of a bulk write from the interface. The service worker reads the
 * marker before every commit and defers its own writes while the marker is
 * fresh. Without the marker, an import of the whole data set and a 30 s
 * commit can overwrite each other.
 */

/** Key of the marker in storage.session. */
export const MAINTENANCE_KEY = 'maintenance';

/**
 * Lifetime of the marker. A page that closes in the middle of a bulk write
 * leaves the marker behind, so the worker resumes commits after this time.
 */
export const MAINTENANCE_TTL_MS = 120_000;

/** Marker record: the time of the write in ms. */
export function maintenanceRecord(now: number): number {
  return now;
}

/** The marker is fresh: it is a number not older than MAINTENANCE_TTL_MS. */
export function isMaintenance(value: unknown, now: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && now - value < MAINTENANCE_TTL_MS;
}

/**
 * Expected failure: a bulk write holds the data now, so the commit waits.
 * The caller keeps the commit and writes it at the next result save.
 */
export class MaintenanceActiveError extends Error {
  constructor() {
    super('a bulk write is in progress');
    this.name = 'MaintenanceActiveError';
  }
}
