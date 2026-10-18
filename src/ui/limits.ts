import type { Limits } from '@/shared/types';

/** Limit color by the share spent: normal, warning, over. */
export type LimitLevel = 'normal' | 'warning' | 'over';

/** Share at which the limit is a warning: 4/5, that is 80%. */
const WARNING_SHARE_NUMERATOR = 4;
const WARNING_SHARE_DENOMINATOR = 5;

const PERCENT_MAX = 100;
const MINUTES_MIN = 1;
const MINUTES_MAX = 1440;

/**
 * Limit level by the share spent. The comparisons use integers and no
 * floating point. `warning` starts at exactly 80%, `over` starts at the
 * full limit.
 */
export function limitLevel(spentSeconds: number, limitSeconds: number): LimitLevel {
  if (spentSeconds >= limitSeconds) {
    return 'over';
  }
  if (spentSeconds * WARNING_SHARE_DENOMINATOR >= limitSeconds * WARNING_SHARE_NUMERATOR) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Rounded share of the spent time of the limit in percent, at most 100.
 * Zero if the limit is <= 0.
 */
export function limitPercent(spentSeconds: number, limitSeconds: number): number {
  if (limitSeconds <= 0) {
    return 0;
  }
  return Math.min(PERCENT_MAX, Math.round((spentSeconds / limitSeconds) * PERCENT_MAX));
}

/**
 * Number of domains whose seconds are strictly more than their limit.
 * Domains without a limit and limits without time do not count.
 */
export function overLimitCount(perDomain: Map<string, number>, limits: Limits): number {
  let count = 0;
  for (const [domain, seconds] of perDomain) {
    const limit = limits[domain];
    if (limit !== undefined && seconds > limit) {
      count += 1;
    }
  }
  return count;
}

/**
 * Limit minutes from the input field. After trim, digits only, an integer
 * from 1 to 1440. Otherwise null.
 */
export function parseLimitMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const minutes = Number(trimmed);
  if (minutes < MINUTES_MIN || minutes > MINUTES_MAX) {
    return null;
  }
  return minutes;
}
