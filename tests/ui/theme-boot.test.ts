import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFakeLocalStorage } from '../helpers/fakeLocalStorage';
import { writeCachedTheme } from '@/ui/theme';

/**
 * The boot script runs before the bundle, so the test evaluates the file
 * itself. It must read the mirror that writeCachedTheme writes and paint
 * the right theme.
 */
const BOOT_SCRIPT = readFileSync(new URL('../../public/theme-boot.js', import.meta.url), 'utf8');

/** Runs the boot script and answers with the class state it left on <html>. */
function runBootScript(prefersDark: boolean): boolean {
  const storage = (globalThis as { localStorage?: unknown }).localStorage;
  const states: boolean[] = [];

  vi.stubGlobal('window', {
    localStorage: storage,
    matchMedia: () => ({ matches: prefersDark }),
  });
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (_name: string, on: boolean): void => {
          states.push(on);
        },
      },
    },
  });

  new Function(BOOT_SCRIPT)();

  return states.at(-1) ?? false;
}

describe('theme boot script', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('theme_boot_applies_the_mirrored_theme', () => {
    installFakeLocalStorage();
    writeCachedTheme('light');
    expect(runBootScript(false)).toBe(false);

    installFakeLocalStorage();
    writeCachedTheme('dark');
    expect(runBootScript(false)).toBe(true);
  });

  it('theme_boot_uses_the_dark_default_without_a_mirror', () => {
    installFakeLocalStorage();

    expect(runBootScript(false)).toBe(true);
  });

  it('theme_boot_follows_the_os_preference_for_system', () => {
    installFakeLocalStorage();
    writeCachedTheme('system');

    expect(runBootScript(false)).toBe(false);
    expect(runBootScript(true)).toBe(true);
  });

  it('theme_boot_uses_the_default_when_the_storage_is_blocked', () => {
    installFakeLocalStorage(true);

    expect(runBootScript(false)).toBe(true);
  });
});
