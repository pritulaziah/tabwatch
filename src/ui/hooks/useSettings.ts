import { useEffect, useState } from 'react';

import { getSettings, setSettings } from '@/background/store';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/shared/types';

/**
 * Settings and writes to them: the state of the application settings
 * on both surfaces.
 */
export interface SettingsState {
  settings: Settings | null;
  error: boolean;
  setTheme(theme: Settings['theme']): Promise<boolean>;
}

/**
 * Settings: reads them at mount and on storage events, writes on user
 * actions. Several writers change the settings, the popup and the page,
 * so the hook listens to storage events.
 */
export function useSettings(): SettingsState {
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;

    const read = async (): Promise<void> => {
      try {
        const stored = await getSettings();
        if (!disposed) {
          setSettingsState(stored);
          setError(false);
        }
      } catch (readError) {
        if (disposed) {
          return;
        }
        // Read error: the default values and the flag for the banner. The
        // surface continues to work.
        console.error('[tabwatch] failed to read settings', readError);
        setSettingsState(DEFAULT_SETTINGS);
        setError(true);
      }
    };

    void read();

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ): void => {
      if (areaName === 'local' && changes.settings !== undefined) {
        void read();
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);

    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  const write = async (next: Settings): Promise<boolean> => {
    try {
      await setSettings(next);
      setSettingsState(next);
      return true;
    } catch (writeError) {
      // Write error: the state stays the same. The UI does not diverge
      // from the storage.
      console.error('[tabwatch] failed to write settings', writeError);
      return false;
    }
  };

  const setTheme = (theme: Settings['theme']): Promise<boolean> => {
    if (settings === null) {
      return Promise.resolve(false);
    }
    return write({ ...settings, theme });
  };

  return { settings, error, setTheme };
}
