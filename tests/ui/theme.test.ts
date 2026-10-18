import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFakeLocalStorage } from '../helpers/fakeLocalStorage';
import { readCachedTheme, resolveTheme, writeCachedTheme } from '@/ui/theme';

describe('theme', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolveTheme_maps_light_and_dark_directly', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('resolveTheme_system_follows_the_preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('writeCachedTheme_and_readCachedTheme_round_trip', () => {
    for (const theme of ['system', 'light', 'dark'] as const) {
      writeCachedTheme(theme);
      expect(readCachedTheme()).toBe(theme);
    }
  });

  it('readCachedTheme_returns_null_without_a_mirror', () => {
    expect(readCachedTheme()).toBeNull();
  });

  it('readCachedTheme_drops_a_damaged_mirror', () => {
    const storage = installFakeLocalStorage();

    storage.setItem('tabwatch.theme', 'sepia');
    expect(readCachedTheme()).toBeNull();

    storage.setItem('tabwatch.theme', '{}');
    expect(readCachedTheme()).toBeNull();
  });

  it('the_mirror_survives_a_blocked_storage', () => {
    installFakeLocalStorage(true);

    expect(() => writeCachedTheme('light')).not.toThrow();
    expect(readCachedTheme()).toBeNull();
  });
});
