import { useEffect } from 'react';

import { POPUP_OPEN_KEY, popupOpenRecord } from '@/shared/presence';

/**
 * How often the popup confirms that it is open: the TTL of the mark
 * covers two missed refreshes.
 */
const REFRESH_MS = 10_000;

/**
 * While the popup is open, it keeps a fresh mark in storage.session. The
 * worker uses the mark to tell a focus loss from the popup apart from a
 * browser exit. It does not close the segment.
 */
export function usePopupPresence(): void {
  useEffect(() => {
    const mark = async (): Promise<void> => {
      try {
        await chrome.storage.session.set({ [POPUP_OPEN_KEY]: popupOpenRecord(Date.now()) });
      } catch (error) {
        console.error('[tabwatch] failed to mark the popup open', error);
      }
    };

    const clear = async (): Promise<void> => {
      try {
        await chrome.storage.session.remove(POPUP_OPEN_KEY);
      } catch (error) {
        console.error('[tabwatch] failed to clear the popup open mark', error);
      }
    };

    void mark();
    const timer = setInterval(() => void mark(), REFRESH_MS);

    const onPageHide = (): void => {
      void clear();
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
}
