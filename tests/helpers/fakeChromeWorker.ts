import { vi } from 'vitest';

/** Alarm listener of chrome.alarms.onAlarm. */
export type AlarmListener = (alarm: { name: string }) => void;

/** Focus listener of chrome.windows.onFocusChanged. */
export type FocusListener = (windowId: number) => void;

/**
 * Holder of a listener: the worker registers the listeners at import, so
 * the test reads them from the holder after the import.
 */
export interface ListenerHolder<T> {
  listener: T | null;
}

/**
 * Holders of the listeners. The worker registers the listeners once, at the
 * first import, so every call of installFakeChromeWorker returns the same
 * holders: the tests read the listeners from them after the import.
 */
const alarm: ListenerHolder<AlarmListener> = { listener: null };
const focus: ListenerHolder<FocusListener> = { listener: null };

/**
 * Replaces chrome with a stub of the APIs the service worker wiring
 * touches. The listeners of the alarms and of the window focus are
 * reachable through the returned holders. A window read fails until the
 * test gives a window.
 */
export function installFakeChromeWorker(): {
  fake: ReturnType<typeof createFakeChrome>;
  alarm: ListenerHolder<AlarmListener>;
  focus: ListenerHolder<FocusListener>;
} {
  const fake = createFakeChrome(alarm, focus);

  (globalThis as { chrome?: unknown }).chrome = fake;

  return { fake, alarm, focus };
}

/** Stub of the Chrome APIs. Listener registration writes into the holders. */
function createFakeChrome(
  alarm: ListenerHolder<AlarmListener>,
  focus: ListenerHolder<FocusListener>,
) {
  const storageArea = () => ({
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  });

  return {
    storage: {
      local: storageArea(),
      session: storageArea(),
      onChanged: { addListener: vi.fn() },
    },
    alarms: {
      get: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      onAlarm: {
        addListener: vi.fn((listener: AlarmListener) => {
          alarm.listener = listener;
        }),
      },
    },
    windows: {
      WINDOW_ID_NONE: -1,
      getLastFocused: vi.fn().mockRejectedValue(new Error('no window')),
      onFocusChanged: {
        addListener: vi.fn((listener: FocusListener) => {
          focus.listener = listener;
        }),
      },
      onRemoved: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      onActivated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
    },
    webNavigation: {
      onHistoryStateUpdated: { addListener: vi.fn() },
    },
  };
}
