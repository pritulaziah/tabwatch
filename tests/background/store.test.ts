import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { required } from '../helpers/required';
import { installFakeChromeStorage } from '../helpers/fakeChromeStorage';
import {
  addSeconds,
  beginMaintenance,
  endMaintenance,
  getAllDays,
  getDayKeys,
  getDays,
  getLimits,
  getMeta,
  getSegment,
  getSettings,
  isMaintenanceActive,
  removeDays,
  setDays,
  setLimits,
  setSegment,
  setSettings,
} from '@/background/store';
import { MAINTENANCE_KEY, MAINTENANCE_TTL_MS, MaintenanceActiveError } from '@/shared/maintenance';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Segment } from '@/shared/types';

const chromeGlobal = globalThis as { chrome?: unknown };
const originalChrome = chromeGlobal.chrome;

let fake: ReturnType<typeof installFakeChromeStorage>;

beforeEach(() => {
  fake = installFakeChromeStorage();
});

afterEach(() => {
  chromeGlobal.chrome = originalChrome;
});

describe('store', () => {
  it('addSeconds_accumulates_under_the_day_key', async () => {
    await addSeconds('2026-10-16', 9, 'youtube.com', 60);
    await addSeconds('2026-10-16', 9, 'youtube.com', 60);

    expect(fake.local).toEqual({ 'day:2026-10-16': { '9': { 'youtube.com': 120 } } });
  });

  it('addSeconds_creates_the_day_key', async () => {
    fake.local['day:2026-10-15'] = { '9': { 'github.com': 30 } };

    await addSeconds('2026-10-16', 9, 'youtube.com', 45);

    expect(fake.local['day:2026-10-16']).toEqual({ '9': { 'youtube.com': 45 } });
    expect(fake.local['day:2026-10-15']).toEqual({ '9': { 'github.com': 30 } });
  });

  it('addSeconds_floors_and_skips_below_one_second', async () => {
    await addSeconds('2026-10-16', 9, 'youtube.com', 60.9);
    expect(fake.local['day:2026-10-16']).toEqual({ '9': { 'youtube.com': 60 } });

    await addSeconds('2026-10-14', 9, 'youtube.com', 0.9);
    await addSeconds('2026-10-14', 9, 'youtube.com', 0);
    await addSeconds('2026-10-14', 9, 'youtube.com', Number.NaN);
    await addSeconds('2026-10-14', 9, 'youtube.com', Number.POSITIVE_INFINITY);

    expect(fake.local).toEqual({ 'day:2026-10-16': { '9': { 'youtube.com': 60 } } });
  });

  it('addSeconds_writes_hours_side_by_side', async () => {
    await addSeconds('2026-10-16', 9, 'youtube.com', 60);
    await addSeconds('2026-10-16', 10, 'youtube.com', 30);

    expect(fake.local['day:2026-10-16']).toEqual({
      '9': { 'youtube.com': 60 },
      '10': { 'youtube.com': 30 },
    });
  });

  it('addSeconds_skips_an_invalid_hour', async () => {
    await addSeconds('2026-10-16', 24, 'youtube.com', 60);
    await addSeconds('2026-10-16', -1, 'youtube.com', 60);
    await addSeconds('2026-10-16', 9.5, 'youtube.com', 60);
    await addSeconds('2026-10-16', Number.NaN, 'youtube.com', 60);

    // Invalid hours write nothing: the day is not in the storage yet.
    expect(fake.local).toEqual({});

    // Control write: a valid hour is written.
    await addSeconds('2026-10-16', 9, 'youtube.com', 30);

    expect(fake.local).toEqual({ 'day:2026-10-16': { '9': { 'youtube.com': 30 } } });
  });

  it('addSeconds_keeps_prototype_named_domains', async () => {
    // Text, not an object: only JSON.parse makes __proto__ an own property.
    fake.local['day:2026-10-16'] = JSON.parse('{"9": {"__proto__": 30, "youtube.com": 60}}');

    await addSeconds('2026-10-16', 9, 'github.com', 30);

    const shard = fake.local['day:2026-10-16'] as Record<string, Record<string, unknown>>;
    const hour = required(shard['9']);
    expect(Object.hasOwn(hour, '__proto__')).toBe(true);
    expect(hour['__proto__']).toBe(30);
    expect(Object.hasOwn(hour, 'youtube.com')).toBe(true);
    expect(hour['youtube.com']).toBe(60);
    expect(Object.hasOwn(hour, 'github.com')).toBe(true);
    expect(hour['github.com']).toBe(30);
  });

  it('addSeconds_creates_a_prototype_named_domain_on_a_new_day', async () => {
    await addSeconds('2026-10-16', 9, '__proto__', 30);

    const shard = fake.local['day:2026-10-16'] as Record<string, Record<string, unknown>>;
    const hour = required(shard['9']);
    expect(Object.hasOwn(hour, '__proto__')).toBe(true);
    expect(hour['__proto__']).toBe(30);
  });

  it('getDays_reads_all_requested_keys_in_one_call', async () => {
    fake.local['day:2026-10-15'] = { '9': { 'youtube.com': 60 } };
    fake.local['day:2026-10-16'] = { '10': { 'github.com': 30 } };

    await getDays(['2026-10-15', '2026-10-16']);

    const localGets = fake.getCalls.filter((call) => call.area === 'local');
    expect(localGets).toHaveLength(1);
    expect(required(localGets[0]).keys).toEqual(['day:2026-10-15', 'day:2026-10-16']);
  });

  it('getDays_omits_missing_days', async () => {
    fake.local['day:2026-10-16'] = { '9': { 'youtube.com': 60 } };

    const days = await getDays(['2026-10-15', '2026-10-16']);

    expect(days).toEqual({ '2026-10-16': { '9': { 'youtube.com': 60 } } });
  });

  it('getDays_drops_invalid_entries', async () => {
    fake.local['day:2026-10-16'] = {
      '9': {
        'youtube.com': 60,
        'max.com': 86_400,
        'zero.com': 0,
        'negative.com': -1,
        'too-big.com': 86_401,
        'string.com': '60',
        'nan.com': Number.NaN,
        'a b.com': 30,
      },
    };

    const days = await getDays(['2026-10-16']);

    expect(days).toEqual({
      '2026-10-16': { '9': { 'youtube.com': 60, 'max.com': 86_400, 'zero.com': 0 } },
    });
  });

  it('getDays_drops_invalid_hours', async () => {
    // Text, not an object: only JSON.parse makes __proto__ an own property.
    fake.local['day:2026-10-16'] = JSON.parse(
      '{"9":{"youtube.com":60},"24":{"youtube.com":60},"09":{"youtube.com":60},' +
        '"nine":{"youtube.com":60},"__proto__":{"youtube.com":60},"10":"garbage"}',
    );
    fake.local['day:2026-10-15'] = { '24': { 'youtube.com': 60 }, nine: 'x' };

    const days = await getDays(['2026-10-15', '2026-10-16']);

    // Valid hours of the day stay. A day without valid hours is not
    // in the result.
    expect(days).toEqual({ '2026-10-16': { '9': { 'youtube.com': 60 } } });
  });

  it('getSegment_returns_null_when_absent', async () => {
    expect(await getSegment()).toBeNull();
  });

  it('getSegment_drops_invalid_record', async () => {
    fake.session.segment = {
      domain: 'youtube.com',
      startedAt: 1000,
      lastCommitAt: 1000,
      tabId: 1,
    };
    expect(await getSegment()).toBeNull();

    fake.session.segment = {
      domain: 'a b.com',
      startedAt: 1000,
      lastCommitAt: 1000,
      tabId: 1,
      windowId: 2,
    };
    expect(await getSegment()).toBeNull();

    fake.session.segment = {
      domain: 'youtube.com',
      startedAt: '1000',
      lastCommitAt: 1000,
      tabId: 1,
      windowId: 2,
    };
    expect(await getSegment()).toBeNull();

    fake.session.segment = 'garbage';
    expect(await getSegment()).toBeNull();
  });

  it('setSegment_writes_and_removes_the_session_key', async () => {
    const segment: Segment = {
      domain: 'youtube.com',
      startedAt: 1000,
      lastCommitAt: 1000,
      tabId: 1,
      windowId: 2,
    };

    await setSegment(segment);
    expect(fake.session.segment).toEqual(segment);

    await setSegment(null);
    expect(fake.session).toEqual({});
  });

  it('getLimits_returns_empty_object_when_absent_and_sanitizes', async () => {
    expect(await getLimits()).toEqual({});

    fake.local.limits = {
      'youtube.com': 1800,
      'a b.com': 1800,
      'string.com': '1800',
      'zero.com': 0,
    };

    expect(await getLimits()).toEqual({ 'youtube.com': 1800 });
  });

  it('setLimits_writes_the_limits_key', async () => {
    await setLimits({ 'youtube.com': 1800 });

    expect(fake.local.limits).toEqual({ 'youtube.com': 1800 });
  });

  it('getSettings_returns_defaults_when_absent_and_sanitizes', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);

    fake.local.settings = { theme: 'blue' };
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);

    fake.local.settings = { theme: 'light', unknown: true };
    expect(await getSettings()).toEqual({ theme: 'light' });
  });

  it('setSettings_writes_the_settings_key', async () => {
    await setSettings({ theme: 'light' });

    expect(fake.local.settings).toEqual({ theme: 'light' });
  });

  it('getMeta_initializes_once_and_replaces_invalid_record', async () => {
    const before = Date.now();

    const first = await getMeta();

    const after = Date.now();
    expect(first.schemaVersion).toBe(1);
    expect(first.installedAt).toBeGreaterThanOrEqual(before);
    expect(first.installedAt).toBeLessThanOrEqual(after);
    expect(fake.local.meta).toEqual(first);

    const second = await getMeta();
    expect(second.installedAt).toBe(first.installedAt);

    fake.local.meta = { schemaVersion: 1, installedAt: 12345 };
    expect(await getMeta()).toEqual({ schemaVersion: 1, installedAt: 12345 });

    fake.local.meta = { schemaVersion: 'one', installedAt: 'yesterday' };
    const replaced = await getMeta();
    expect(replaced.schemaVersion).toBe(1);
    expect(replaced.installedAt).toBeGreaterThanOrEqual(before);
    expect(fake.local.meta).toEqual(replaced);
  });

  it('getAllDays_reads_every_day_key_in_one_call', async () => {
    fake.local['day:2026-10-15'] = { '9': { 'youtube.com': 60 } };
    fake.local['day:2026-10-16'] = { '10': { 'github.com': 30 } };
    fake.local.limits = { 'youtube.com': 1800 };
    fake.local.settings = { theme: 'dark' };
    fake.local.meta = { schemaVersion: 1, installedAt: 12345 };

    const days = await getAllDays();

    expect(days).toEqual({
      '2026-10-15': { '9': { 'youtube.com': 60 } },
      '2026-10-16': { '10': { 'github.com': 30 } },
    });

    const localGets = fake.getCalls.filter((call) => call.area === 'local');
    expect(localGets).toHaveLength(1);
    expect(required(localGets[0]).keys).toBeNull();
  });

  it('getAllDays_sanitizes_shards_and_skips_non_objects', async () => {
    fake.local['day:2026-10-16'] = {
      '9': {
        'youtube.com': 60,
        'a b.com': 30,
        'string.com': '60',
      },
    };
    fake.local['day:2026-10-15'] = 'garbage';

    const days = await getAllDays();

    expect(days).toEqual({ '2026-10-16': { '9': { 'youtube.com': 60 } } });
  });

  it('getAllDays_keeps_prototype_named_domains', async () => {
    // Text, not an object: only JSON.parse makes __proto__ an own property.
    fake.local['day:2026-10-16'] = JSON.parse('{"9": {"__proto__": 30, "toString": 60}}');

    const days = await getAllDays();

    const dayShard = required(days['2026-10-16']);
    const hour = required(dayShard['9']);
    expect(Object.hasOwn(hour, '__proto__')).toBe(true);
    expect(hour['__proto__']).toBe(30);
    expect(Object.hasOwn(hour, 'toString')).toBe(true);
    expect(hour['toString']).toBe(60);
  });

  it('getDayKeys_returns_every_day_key_regardless_of_value', async () => {
    fake.local['day:2026-10-16'] = { '9': { 'youtube.com': 60 } };
    fake.local['day:2026-10-15'] = 'garbage';
    fake.local['day:'] = 'x';
    fake.local.limits = { 'youtube.com': 1800 };
    fake.local.settings = { theme: 'dark' };
    fake.local.meta = { schemaVersion: 1, installedAt: 12345 };

    const keys = await getDayKeys();

    expect(keys.sort()).toEqual(['', '2026-10-15', '2026-10-16']);

    const localGets = fake.getCalls.filter((call) => call.area === 'local');
    expect(localGets).toHaveLength(1);
    expect(required(localGets[0]).keys).toBeNull();
  });

  it('setDays_writes_whole_day_keys', async () => {
    fake.local['day:2026-10-15'] = { '9': { 'github.com': 30 } };

    await setDays({ '2026-10-16': { '9': { 'youtube.com': 60 } } });

    expect(fake.local).toEqual({
      'day:2026-10-15': { '9': { 'github.com': 30 } },
      'day:2026-10-16': { '9': { 'youtube.com': 60 } },
    });
  });

  it('setDays_empty_map_does_not_write', async () => {
    await setDays({});

    expect(fake.setCalls).toHaveLength(0);
  });

  it('removeDays_removes_only_the_given_days', async () => {
    fake.local['day:2026-10-15'] = { '9': { 'github.com': 30 } };
    fake.local['day:2026-10-16'] = { '9': { 'youtube.com': 60 } };
    fake.local.limits = { 'youtube.com': 1800 };

    await removeDays(['2026-10-16']);

    expect(fake.local).toEqual({
      'day:2026-10-15': { '9': { 'github.com': 30 } },
      limits: { 'youtube.com': 1800 },
    });

    await removeDays([]);

    expect(fake.local).toEqual({
      'day:2026-10-15': { '9': { 'github.com': 30 } },
      limits: { 'youtube.com': 1800 },
    });
  });

  it('removeDays_empty_list_does_not_remove', async () => {
    await removeDays([]);

    expect(fake.removeCalls).toHaveLength(0);
  });

  it('addSeconds_defers_the_write_while_a_bulk_write_holds_the_data', async () => {
    await beginMaintenance();

    await expect(addSeconds('2026-10-16', 9, 'youtube.com', 60)).rejects.toBeInstanceOf(
      MaintenanceActiveError,
    );
    expect(fake.local).toEqual({});

    // The bulk write ended: the same commit goes to the storage.
    await endMaintenance();
    await addSeconds('2026-10-16', 9, 'youtube.com', 60);

    expect(fake.local).toEqual({ 'day:2026-10-16': { '9': { 'youtube.com': 60 } } });
  });

  it('addSeconds_ignores_a_stale_marker', async () => {
    fake.session[MAINTENANCE_KEY] = Date.now() - MAINTENANCE_TTL_MS;

    await addSeconds('2026-10-16', 9, 'youtube.com', 60);

    expect(fake.local).toEqual({ 'day:2026-10-16': { '9': { 'youtube.com': 60 } } });
  });

  it('beginMaintenance_and_endMaintenance_write_the_session_key', async () => {
    await beginMaintenance();

    expect(typeof fake.session[MAINTENANCE_KEY]).toBe('number');
    expect(await isMaintenanceActive()).toBe(true);

    await endMaintenance();

    expect(fake.session).toEqual({});
    expect(await isMaintenanceActive()).toBe(false);
  });
});
