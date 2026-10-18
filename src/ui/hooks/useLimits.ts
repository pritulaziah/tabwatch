import { useEffect, useState } from 'react';

import { getLimits, setLimits } from '@/background/store';
import type { Limits } from '@/shared/types';

/** Limits and writes to them: the state of the limit editor. */
export interface LimitsState {
  limits: Limits | null;
  error: boolean;
  save(domain: string, seconds: number): Promise<boolean>;
  remove(domain: string): Promise<boolean>;
}

/**
 * Daily limits: reads them at mount and on storage events, writes on user
 * actions. The settings screen uses this hook. The data transfer also
 * changes the limits, so the hook listens to storage events.
 */
export function useLimits(): LimitsState {
  const [limits, setLimitsState] = useState<Limits | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;

    const read = async (): Promise<void> => {
      try {
        const stored = await getLimits();
        if (!disposed) {
          setLimitsState(stored);
          setError(false);
        }
      } catch (readError) {
        if (disposed) {
          return;
        }
        // Read error: an empty map and the flag for the banner. The surface
        // continues to work.
        console.error('[tabwatch] failed to read limits', readError);
        setLimitsState({});
        setError(true);
      }
    };

    void read();

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ): void => {
      if (areaName === 'local' && changes.limits !== undefined) {
        void read();
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);

    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  const write = async (next: Limits): Promise<boolean> => {
    try {
      await setLimits(next);
      setLimitsState(next);
      return true;
    } catch (writeError) {
      // Write error: the state stays the same. The UI does not diverge
      // from the storage.
      console.error('[tabwatch] failed to write limits', writeError);
      return false;
    }
  };

  const save = (domain: string, seconds: number): Promise<boolean> => {
    if (limits === null) {
      return Promise.resolve(false);
    }
    return write({ ...limits, [domain]: seconds });
  };

  const remove = (domain: string): Promise<boolean> => {
    if (limits === null) {
      return Promise.resolve(false);
    }
    const next = { ...limits };
    delete next[domain];
    return write(next);
  };

  return { limits, error, save, remove };
}
