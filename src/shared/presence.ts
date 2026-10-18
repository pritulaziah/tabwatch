/** Lifetime of the "popup open" mark: the popup confirms it every 10 s. */
export const POPUP_OPEN_TTL_MS = 30_000;

/** Key of the "popup open" mark in storage.session. */
export const POPUP_OPEN_KEY = 'popupOpen';

/** "popup open" mark: the current time in ms. */
export function popupOpenRecord(now: number): number {
  return now;
}

/** The mark is fresh: it is a number not older than POPUP_OPEN_TTL_MS. */
export function isPopupOpen(value: unknown, now: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && now - value < POPUP_OPEN_TTL_MS;
}
