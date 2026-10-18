import { describe, expect, it } from 'vitest';

import { POPUP_OPEN_TTL_MS, isPopupOpen, popupOpenRecord } from '@/shared/presence';

describe('presence', () => {
  it('popupOpenRecord_returns_the_moment', () => {
    expect(popupOpenRecord(1_234_567)).toBe(1_234_567);
  });

  it('isPopupOpen_accepts_a_fresh_record', () => {
    const now = 1_000_000;

    expect(isPopupOpen(now, now)).toBe(true);
    expect(isPopupOpen(now - 29_999, now)).toBe(true);
  });

  it('isPopupOpen_rejects_a_stale_record', () => {
    const now = 1_000_000;

    expect(isPopupOpen(now - POPUP_OPEN_TTL_MS, now)).toBe(false);
    expect(isPopupOpen(now - 60_000, now)).toBe(false);
  });

  it('isPopupOpen_rejects_anything_that_is_not_a_number', () => {
    const now = 1_000_000;

    for (const value of [undefined, null, '5', {}, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isPopupOpen(value, now)).toBe(false);
    }
  });
});
