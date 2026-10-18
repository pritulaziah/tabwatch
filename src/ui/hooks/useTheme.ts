import { useEffect, useState } from 'react';

import { getSettings } from '@/background/store';
import { resolveTheme, writeCachedTheme } from '@/ui/theme';
import { sanitizeSettings } from '@/shared/settings';
import type { Settings } from '@/shared/types';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Applies the theme to <html>: the dark class turns on the dark tokens,
 * and its absence gives the light tokens. Returns the applied theme.
 */
function applyTheme(theme: Settings['theme'], prefersDark: boolean): 'light' | 'dark' {
  const resolved = resolveTheme(theme, prefersDark);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  return resolved;
}

/**
 * Keeps the theme in agreement with the settings and the OS preference
 * and returns the applied theme. The switch in the header changes it
 * with one click.
 */
export function useTheme(): 'light' | 'dark' {
  // The initial value is the theme that is already on <html>. Before the
  // settings read, the state matches the class that the switches see.
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    let theme: Settings['theme'] | null = null;
    let disposed = false;

    const update = (): void => {
      if (theme !== null && !disposed) {
        // The mirror feeds the boot script of the next page load.
        writeCachedTheme(theme);
        setResolved(applyTheme(theme, media.matches));
      }
    };

    // The settings are read once at mount. After that, only events change
    // the theme.
    void getSettings()
      .then((settings) => {
        // A storage event can come before the read. Its value is fresher.
        if (theme === null && !disposed) {
          theme = settings.theme;
          update();
        }
      })
      .catch((error) => {
        console.error('[tabwatch] failed to read settings for the theme', error);
      });

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ): void => {
      if (areaName !== 'local' || changes.settings === undefined) {
        return;
      }
      // Invalid fields are replaced with the default values, as at a read.
      theme = sanitizeSettings(changes.settings.newValue).theme;
      update();
    };

    const onMediaChanged = (): void => {
      update();
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    media.addEventListener('change', onMediaChanged);

    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
      media.removeEventListener('change', onMediaChanged);
    };
  }, []);

  return resolved;
}
