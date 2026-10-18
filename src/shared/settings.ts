import type { Limits, Settings } from '@/shared/types';

/** Current data schema version. */
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { theme: 'dark' };

const DOMAIN_MAX_LENGTH = 253;
const LIMIT_MIN_SECONDS = 60;
const LIMIT_MAX_SECONDS = 86_400;

/** Domain: a non-empty string without spaces, at most 253 characters. */
export function isValidDomain(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= DOMAIN_MAX_LENGTH &&
    !/\s/.test(value)
  );
}

/** Limit: an integer number of seconds from 60 to 86 400, a multiple of 60. */
export function isValidLimitSeconds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LIMIT_MIN_SECONDS &&
    value <= LIMIT_MAX_SECONDS &&
    value % 60 === 0
  );
}

/** Settings: each invalid field is replaced with the default value. */
export function sanitizeSettings(value: unknown): Settings {
  const record = asRecord(value);
  return {
    theme: isTheme(record.theme) ? record.theme : DEFAULT_SETTINGS.theme,
  };
}

/** Limits: only records with a valid domain and a valid limit stay. */
export function sanitizeLimits(value: unknown): Limits {
  const record = asRecord(value);
  // The map has no prototype. A domain like __proto__ becomes an own key.
  const limits: Limits = Object.create(null);
  for (const [domain, seconds] of Object.entries(record)) {
    if (isValidDomain(domain) && isValidLimitSeconds(seconds)) {
      limits[domain] = seconds;
    }
  }
  return limits;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Theme choice of the settings: 'system', 'light', or 'dark'. */
export function isTheme(value: unknown): value is Settings['theme'] {
  return value === 'system' || value === 'light' || value === 'dark';
}
