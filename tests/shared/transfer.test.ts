import { describe, expect, it } from 'vitest';

import { required } from '../helpers/required';
import {
  buildExport,
  exportFileName,
  mergeImport,
  parseImport,
  replaceImport,
} from '@/shared/transfer';
import type { TransferData } from '@/shared/transfer';
import type { DayShard, Limits, Settings } from '@/shared/types';

/**
 * Local noon of the day. The month is as in the calendar (1-12).
 * Noon is far from midnight, so time zone offsets do not change
 * the local date of the moment.
 */
function localNoon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

/** Export time: noon UTC on 2026-10-16. */
const EXPORTED_AT = Date.parse('2026-10-16T12:00:00.000Z');

/** Format fixtures: two days with hours, a limit, and settings. */
const FIXTURE_DAYS: Record<string, DayShard> = {
  '2026-10-16': { '9': { 'youtube.com': 3600, 'github.com': 1200 } },
  '2026-10-15': { '14': { 'youtube.com': 900 } },
};

const FIXTURE_LIMITS: Limits = { 'youtube.com': 1800 };

const FIXTURE_SETTINGS: Settings = { theme: 'dark' };

/**
 * Valid export document. The copy keeps case edits from leaking into
 * neighbors.
 */
function validFile(): Record<string, unknown> {
  return {
    app: 'tabwatch',
    schemaVersion: 1,
    exportedAt: '2026-10-16T12:00:00.000Z',
    days: FIXTURE_DAYS,
    limits: FIXTURE_LIMITS,
    settings: FIXTURE_SETTINGS,
  };
}

/** File for report checks: two days (5700 seconds) and two limits. */
const REPORT_FILE: TransferData = {
  days: FIXTURE_DAYS,
  limits: { 'youtube.com': 1800, 'notion.com': 600 },
};

describe('buildExport', () => {
  it('buildExport_writes_the_export_document', () => {
    const file = buildExport(FIXTURE_DAYS, FIXTURE_LIMITS, FIXTURE_SETTINGS, EXPORTED_AT);

    expect(file).toEqual({
      app: 'tabwatch',
      schemaVersion: 1,
      exportedAt: '2026-10-16T12:00:00.000Z',
      days: FIXTURE_DAYS,
      limits: FIXTURE_LIMITS,
      settings: FIXTURE_SETTINGS,
    });
  });
});

describe('exportFileName', () => {
  it('exportFileName_is_the_local_export_day', () => {
    expect(exportFileName(localNoon(2026, 10, 16))).toBe('tabwatch-export-2026-10-16.json');
    expect(exportFileName(localNoon(2026, 1, 5))).toBe('tabwatch-export-2026-01-05.json');
  });
});

describe('parseImport', () => {
  it('parseImport_accepts_a_valid_file', () => {
    const result = parseImport(JSON.stringify(validFile()));

    expect(result).toEqual({
      ok: true,
      data: { days: FIXTURE_DAYS, limits: FIXTURE_LIMITS },
      droppedRecords: 0,
    });
    if (result.ok) {
      expect(Object.keys(result.data)).toEqual(['days', 'limits']);
    }
  });

  it('parseImport_reports_damaged_json', () => {
    const damaged = [
      '{',
      '',
      'null',
      '[1]',
      JSON.stringify({ app: 'tabwatch', days: {}, limits: {} }),
      JSON.stringify({ ...validFile(), app: 'other' }),
      JSON.stringify({ ...validFile(), schemaVersion: '1' }),
      JSON.stringify({ ...validFile(), schemaVersion: 0 }),
      JSON.stringify({ ...validFile(), days: 'x' }),
      JSON.stringify({ ...validFile(), days: [] }),
      JSON.stringify({ ...validFile(), limits: 5 }),
      JSON.stringify({ app: 'tabwatch', schemaVersion: 1, limits: {} }),
    ];

    for (const text of damaged) {
      expect(parseImport(text)).toEqual({ ok: false, error: 'damaged' });
    }
  });

  it('parseImport_refuses_a_newer_schema_version', () => {
    expect(parseImport(JSON.stringify({ ...validFile(), schemaVersion: 2 }))).toEqual({
      ok: false,
      error: 'newerVersion',
    });
  });

  it('parseImport_drops_invalid_day_records', () => {
    const result = parseImport(
      JSON.stringify({
        ...validFile(),
        days: {
          '2026-10-16': {
            '9': {
              'youtube.com': 3600,
              'negative.com': -1,
              'too-big.com': 86401,
              'string.com': '60',
              'fraction.com': 60.5,
              'a b.com': 30,
            },
          },
          '16-10-2026': { '9': { 'youtube.com': 60 } },
          '2026-10-14': 'garbage',
        },
        limits: {},
      }),
    );

    expect(result).toEqual({
      ok: true,
      data: { days: { '2026-10-16': { '9': { 'youtube.com': 3600 } } }, limits: {} },
      droppedRecords: 7,
    });
  });

  it('parseImport_drops_invalid_hour_records', () => {
    const result = parseImport(
      JSON.stringify({
        ...validFile(),
        days: {
          '2026-10-16': {
            '9': { 'youtube.com': 60, 'a b.com': 30 },
            '24': { 'youtube.com': 60 },
            '09': { 'youtube.com': 60 },
            nine: 60,
            '10': 'garbage',
          },
        },
        limits: {},
      }),
    );

    // One dropped record each: keys "24" and "09", key "nine",
    // value "10", and pair "a b.com".
    expect(result).toEqual({
      ok: true,
      data: { days: { '2026-10-16': { '9': { 'youtube.com': 60 } } }, limits: {} },
      droppedRecords: 5,
    });
  });

  it('parseImport_drops_days_with_no_valid_records', () => {
    const result = parseImport(
      JSON.stringify({
        ...validFile(),
        days: {
          '2026-10-16': { '9': { 'a b.com': 30, 'zero-day.com': 'x' } },
          '2026-10-17': {},
        },
        limits: {},
      }),
    );

    expect(result).toEqual({ ok: true, data: { days: {}, limits: {} }, droppedRecords: 2 });
  });

  it('parseImport_counts_flat_day_records_as_dropped', () => {
    // Old flat day: "domain, seconds" pairs without an hour level.
    // Such records are dropped.
    const result = parseImport(
      JSON.stringify({
        ...validFile(),
        days: { '2026-10-16': { 'youtube.com': 1800, 'github.com': 600 } },
        limits: {},
      }),
    );

    expect(result).toEqual({ ok: true, data: { days: {}, limits: {} }, droppedRecords: 2 });
  });

  it('parseImport_drops_invalid_limit_records', () => {
    const result = parseImport(
      JSON.stringify({
        ...validFile(),
        days: {},
        limits: {
          'youtube.com': 1800,
          'a b.com': 1800,
          'half.com': 90,
          'zero.com': 0,
          'string.com': '1800',
          'big.com': 86460,
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      data: { days: {}, limits: { 'youtube.com': 1800 } },
      droppedRecords: 5,
    });
  });

  it('parseImport_ignores_settings', () => {
    const withGarbage = parseImport(JSON.stringify({ ...validFile(), settings: 'garbage' }));

    const withoutSettings = validFile();
    delete withoutSettings.settings;
    const without = parseImport(JSON.stringify(withoutSettings));

    expect(withGarbage).toEqual({
      ok: true,
      data: { days: FIXTURE_DAYS, limits: FIXTURE_LIMITS },
      droppedRecords: 0,
    });
    expect(without).toEqual({
      ok: true,
      data: { days: FIXTURE_DAYS, limits: FIXTURE_LIMITS },
      droppedRecords: 0,
    });
  });

  it('parseImport_keeps_prototype_named_domains', () => {
    // Text, not an object: only JSON.parse makes __proto__ an own property.
    const text =
      '{"app":"tabwatch","schemaVersion":1,' +
      '"days":{"2026-10-16":{"9":{"toString":60,"__proto__":30}}},' +
      '"limits":{"constructor":1800}}';

    const result = parseImport(text);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const dayShard = required(result.data.days['2026-10-16']);
    const hour = required(dayShard['9']);
    expect(Object.hasOwn(hour, 'toString')).toBe(true);
    expect(hour['toString']).toBe(60);
    expect(Object.hasOwn(hour, '__proto__')).toBe(true);
    expect(hour['__proto__']).toBe(30);
    expect(Object.hasOwn(result.data.limits, 'constructor')).toBe(true);
    expect(result.data.limits['constructor']).toBe(1800);
    expect(result.droppedRecords).toBe(0);
  });
});

describe('mergeImport', () => {
  it('mergeImport_adds_seconds_for_the_same_hour', () => {
    const outcome = mergeImport(
      { days: { '2026-10-16': { '9': { 'youtube.com': 60 } } }, limits: {} },
      { days: { '2026-10-16': { '9': { 'youtube.com': 30, 'github.com': 15 } } }, limits: {} },
      0,
    );

    expect(outcome.days).toEqual({
      '2026-10-16': { '9': { 'youtube.com': 90, 'github.com': 15 } },
    });
  });

  it('mergeImport_keeps_hours_separate', () => {
    const outcome = mergeImport(
      {
        days: { '2026-10-16': { '9': { 'youtube.com': 60 }, '10': { 'youtube.com': 15 } } },
        limits: {},
      },
      {
        days: { '2026-10-16': { '9': { 'youtube.com': 30 }, '10': { 'youtube.com': 45 } } },
        limits: {},
      },
      0,
    );

    expect(outcome.days).toEqual({
      '2026-10-16': { '9': { 'youtube.com': 90 }, '10': { 'youtube.com': 60 } },
    });
  });

  it('mergeImport_clamps_each_hour_sum', () => {
    const outcome = mergeImport(
      { days: { '2026-10-16': { '9': { 'youtube.com': 46800, 'github.com': 60 } } }, limits: {} },
      { days: { '2026-10-16': { '9': { 'youtube.com': 46800, 'github.com': 30 } } }, limits: {} },
      0,
    );

    expect(outcome.days).toEqual({
      '2026-10-16': { '9': { 'youtube.com': 86400, 'github.com': 90 } },
    });
  });

  it('mergeImport_keeps_current_days_and_limits_outside_the_file', () => {
    const outcome = mergeImport(
      {
        days: {
          '2026-10-10': { '9': { 'github.com': 120 } },
          '2026-10-16': { '9': { 'youtube.com': 60 } },
        },
        limits: { 'notion.com': 600 },
      },
      { days: { '2026-10-16': { '9': { 'youtube.com': 30 } } }, limits: {} },
      0,
    );

    expect(outcome.days).toEqual({
      '2026-10-10': { '9': { 'github.com': 120 } },
      '2026-10-16': { '9': { 'youtube.com': 90 } },
    });
    expect(outcome.limits).toEqual({ 'notion.com': 600 });
  });

  it('mergeImport_takes_the_maximum_limit_per_domain', () => {
    const raised = mergeImport(
      { days: {}, limits: { 'youtube.com': 1800 } },
      { days: {}, limits: { 'youtube.com': 3600 } },
      0,
    );
    const kept = mergeImport(
      { days: {}, limits: { 'youtube.com': 3600 } },
      { days: {}, limits: { 'youtube.com': 1800 } },
      0,
    );

    expect(raised.limits).toEqual({ 'youtube.com': 3600 });
    expect(kept.limits).toEqual({ 'youtube.com': 3600 });
  });

  it('mergeImport_report_counts_the_file', () => {
    // The youtube.com sum hits the daily maximum, but the report
    // counts the file.
    const outcome = mergeImport(
      { days: { '2026-10-16': { '9': { 'youtube.com': 86000 } } }, limits: {} },
      REPORT_FILE,
      3,
    );

    expect(outcome.report).toEqual({
      affectedDays: 2,
      domains: 3,
      seconds: 5700,
      droppedRecords: 3,
    });
  });

  it('mergeImport_keeps_the_inputs_unchanged', () => {
    const current: TransferData = {
      days: { '2026-10-16': { '9': { 'youtube.com': 60 } } },
      limits: { 'youtube.com': 1800 },
    };
    const fileData: TransferData = {
      days: {
        '2026-10-16': { '9': { 'youtube.com': 30 } },
        '2026-10-15': { '14': { 'github.com': 15 } },
      },
      limits: { 'youtube.com': 3600 },
    };

    mergeImport(current, fileData, 0);

    expect(current).toEqual({
      days: { '2026-10-16': { '9': { 'youtube.com': 60 } } },
      limits: { 'youtube.com': 1800 },
    });
    expect(fileData).toEqual({
      days: {
        '2026-10-16': { '9': { 'youtube.com': 30 } },
        '2026-10-15': { '14': { 'github.com': 15 } },
      },
      limits: { 'youtube.com': 3600 },
    });
  });

  it('mergeImport_sums_prototype_named_domains_as_numbers', () => {
    const outcome = mergeImport(
      { days: { '2026-10-16': { '9': { toString: 10 } } }, limits: {} },
      { days: { '2026-10-16': { '9': { toString: 20 } } }, limits: { constructor: 1800 } },
      0,
    );

    const dayShard = required(outcome.days['2026-10-16']);
    const hour = required(dayShard['9']);
    expect(Object.hasOwn(hour, 'toString')).toBe(true);
    expect(hour['toString']).toBe(30);
    expect(Object.hasOwn(outcome.limits, 'constructor')).toBe(true);
    expect(outcome.limits['constructor']).toBe(1800);
  });

  it('mergeImport_reads_missing_prototype_named_domains_as_zero', () => {
    const outcome = mergeImport(
      { days: { '2026-10-16': {} }, limits: {} },
      { days: { '2026-10-16': { '9': { toString: 20 } } }, limits: {} },
      0,
    );

    const dayShard = required(outcome.days['2026-10-16']);
    const hour = required(dayShard['9']);
    expect(Object.hasOwn(hour, 'toString')).toBe(true);
    expect(hour['toString']).toBe(20);
  });
});

describe('replaceImport', () => {
  it('replaceImport_returns_only_the_file_data', () => {
    const fileData: TransferData = {
      days: { '2026-10-16': { '9': { 'youtube.com': 3600 } } },
      limits: { 'youtube.com': 1800 },
    };

    const outcome = replaceImport(fileData, 0);

    expect(outcome.days).toEqual({ '2026-10-16': { '9': { 'youtube.com': 3600 } } });
    expect(outcome.limits).toEqual({ 'youtube.com': 1800 });
    expect(fileData).toEqual({
      days: { '2026-10-16': { '9': { 'youtube.com': 3600 } } },
      limits: { 'youtube.com': 1800 },
    });
  });

  it('replaceImport_report_counts_the_file', () => {
    const outcome = replaceImport(REPORT_FILE, 3);

    expect(outcome.report).toEqual({
      affectedDays: 2,
      domains: 3,
      seconds: 5700,
      droppedRecords: 3,
    });
  });
});
