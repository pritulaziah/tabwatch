import { isTheme } from '@/shared/settings';
import type { Settings } from '@/shared/types';

/** Key of the theme mirror in localStorage. Keep it in sync with public/theme-boot.js. */
const THEME_CACHE_KEY = 'tabwatch.theme';

/**
 * Theme choice: 'system' follows the OS preference, 'light' and 'dark'
 * are set explicitly.
 */
export function resolveTheme(theme: Settings['theme'], prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Theme of the last settings read, from the synchronous mirror. The boot
 * script paints this value before the module bundle loads, because
 * chrome.storage answers only asynchronously. A missing or damaged value
 * gives null.
 */
export function readCachedTheme(): Settings['theme'] | null {
  try {
    const value = localStorage.getItem(THEME_CACHE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    // A blocked localStorage costs the first paint only.
    return null;
  }
}

/** Writes the mirror for the next first paint. */
export function writeCachedTheme(theme: Settings['theme']): void {
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // A full or blocked localStorage costs the first paint only.
  }
}
