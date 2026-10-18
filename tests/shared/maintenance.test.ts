import { describe, expect, it } from 'vitest';

import {
  MAINTENANCE_TTL_MS,
  MaintenanceActiveError,
  isMaintenance,
  maintenanceRecord,
} from '@/shared/maintenance';

describe('maintenance', () => {
  it('maintenanceRecord_returns_the_moment', () => {
    expect(maintenanceRecord(1_234_567)).toBe(1_234_567);
  });

  it('isMaintenance_accepts_a_fresh_record', () => {
    const now = 1_000_000;

    expect(isMaintenance(now, now)).toBe(true);
    expect(isMaintenance(now - MAINTENANCE_TTL_MS + 1, now)).toBe(true);
  });

  it('isMaintenance_rejects_a_stale_record', () => {
    const now = 1_000_000;

    expect(isMaintenance(now - MAINTENANCE_TTL_MS, now)).toBe(false);
    expect(isMaintenance(now - 300_000, now)).toBe(false);
  });

  it('isMaintenance_rejects_anything_that_is_not_a_number', () => {
    const now = 1_000_000;

    for (const value of [undefined, null, '5', {}, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isMaintenance(value, now)).toBe(false);
    }
  });

  it('MaintenanceActiveError_is_recognizable_by_instanceof', () => {
    const error = new MaintenanceActiveError();

    expect(error).toBeInstanceOf(MaintenanceActiveError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MaintenanceActiveError');
  });
});
