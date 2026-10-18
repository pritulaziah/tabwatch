import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

/**
 * jsdom does not implement matchMedia: the theme reads only matches and
 * subscriptions.
 */
window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

/**
 * jsdom has no chrome. Components use it only for icon URLs and
 * storage event subscriptions, so the stub does nothing.
 */
(globalThis as { chrome?: unknown }).chrome = {
  runtime: {
    getURL: (path: string) => path,
  },
  storage: {
    onChanged: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
  },
};

/**
 * jsdom does not implement ResizeObserver: the chart subscribes but
 * gets no sizes.
 */
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
  };
}
