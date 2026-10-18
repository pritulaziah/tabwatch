import { describe, expect, it } from 'vitest';

import { formatDuration, formatDurationWithSeconds } from '@/shared/format';

describe('formatDuration', () => {
  it('formatDuration_seconds_under_a_minute', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formatDuration_minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(2700)).toBe('45m');
    expect(formatDuration(3599)).toBe('59m');
  });

  it('formatDuration_hours_zero_pad_minutes', () => {
    expect(formatDuration(3600)).toBe('1h 00m');
    expect(formatDuration(3660)).toBe('1h 01m');
    expect(formatDuration(7320)).toBe('2h 02m');
  });

  it('formatDuration_days', () => {
    expect(formatDuration(86400)).toBe('1d 00h');
    expect(formatDuration(90000)).toBe('1d 01h');
  });
});

describe('formatDurationWithSeconds', () => {
  it('formatDurationWithSeconds_always_shows_seconds', () => {
    expect(formatDurationWithSeconds(0)).toBe('00s');
    expect(formatDurationWithSeconds(9)).toBe('09s');
    expect(formatDurationWithSeconds(59)).toBe('59s');
  });

  it('formatDurationWithSeconds_adds_minutes_when_there_are_minutes', () => {
    expect(formatDurationWithSeconds(60)).toBe('1m 00s');
    expect(formatDurationWithSeconds(2705)).toBe('45m 05s');
    expect(formatDurationWithSeconds(3599)).toBe('59m 59s');
  });

  it('formatDurationWithSeconds_adds_hours_when_there_are_hours', () => {
    expect(formatDurationWithSeconds(3600)).toBe('1h 00m 00s');
    expect(formatDurationWithSeconds(5045)).toBe('1h 24m 05s');
    expect(formatDurationWithSeconds(36000)).toBe('10h 00m 00s');
  });
});
