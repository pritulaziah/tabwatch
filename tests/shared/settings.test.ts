import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  isValidDomain,
  isValidLimitSeconds,
  sanitizeLimits,
  sanitizeSettings,
} from '@/shared/settings';

describe('settings', () => {
  it('default_settings_use_the_dark_theme', () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'dark' });
  });

  it('sanitizeSettings_keeps_valid_fields', () => {
    expect(sanitizeSettings({ theme: 'light' })).toEqual({
      theme: 'light',
    });
  });

  it('sanitizeSettings_falls_back_per_field', () => {
    expect(sanitizeSettings({ theme: 'blue' })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'system', unknown: true })).toEqual({ theme: 'system' });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('dark')).toEqual(DEFAULT_SETTINGS);
  });

  it('sanitizeLimits_keeps_whole_minute_limits', () => {
    expect(sanitizeLimits({ 'youtube.com': 1800, 'google.com': 60 })).toEqual({
      'youtube.com': 1800,
      'google.com': 60,
    });
  });

  it('sanitizeLimits_drops_invalid_entries', () => {
    const tooLongDomain = 'x'.repeat(254);

    expect(
      sanitizeLimits({
        'youtube.com': 1800,
        'a b.com': 1800,
        '': 1800,
        [tooLongDomain]: 1800,
        'zero.com': 0,
        'negative.com': -60,
        'too-big.com': 86460,
        'not-whole.com': 90,
        'string.com': '1800',
      }),
    ).toEqual({ 'youtube.com': 1800 });
    expect(sanitizeLimits(null)).toEqual({});
  });

  it('sanitizeLimits_keeps_prototype_named_domains', () => {
    // Text, not an object: only JSON.parse makes __proto__ an own property.
    const input = JSON.parse('{"__proto__": 1800, "toString": 60, "youtube.com": 1800}');

    const limits = sanitizeLimits(input);

    expect(Object.hasOwn(limits, '__proto__')).toBe(true);
    expect(limits['__proto__']).toBe(1800);
    expect(Object.hasOwn(limits, 'toString')).toBe(true);
    expect(limits['toString']).toBe(60);
    expect(Object.hasOwn(limits, 'youtube.com')).toBe(true);
    expect(limits['youtube.com']).toBe(1800);
  });

  it('isValidDomain_checks_shape', () => {
    expect(isValidDomain('youtube.com')).toBe(true);
    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('a b.com')).toBe(false);
    expect(isValidDomain('x'.repeat(254))).toBe(false);
    expect(isValidDomain('x'.repeat(253))).toBe(true);
  });

  it('isValidLimitSeconds_checks_bounds', () => {
    expect(isValidLimitSeconds(60)).toBe(true);
    expect(isValidLimitSeconds(1800)).toBe(true);
    expect(isValidLimitSeconds(86400)).toBe(true);
    expect(isValidLimitSeconds(59)).toBe(false);
    expect(isValidLimitSeconds(86460)).toBe(false);
    expect(isValidLimitSeconds(90)).toBe(false);
    expect(isValidLimitSeconds(1800.5)).toBe(false);
  });
});
