import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFakeChromeWorker } from '../helpers/fakeChromeWorker';
import { setSegment } from '@/background/store';

vi.mock('@/background/store', () => ({
  getSegment: vi.fn().mockRejectedValue(new Error('storage read failed')),
  getMeta: vi.fn().mockResolvedValue({ schemaVersion: 1, installedAt: 0 }),
  addSeconds: vi.fn().mockResolvedValue(undefined),
  setSegment: vi.fn().mockResolvedValue(undefined),
}));

const chromeGlobal = globalThis as { chrome?: unknown };
const originalChrome = chromeGlobal.chrome;

afterEach(() => {
  chromeGlobal.chrome = originalChrome;
});

describe('worker recovery', () => {
  it('a_failed_recovery_leaves_tracking_to_the_next_alarm', async () => {
    const { fake, alarm } = installFakeChromeWorker();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { ready } = await import('@/background/index');
    await ready;

    // The recovery failed: the failure is logged and the state stays empty.
    expect(consoleError).toHaveBeenCalledWith(
      '[tabwatch] failed to restore the tracking state',
      expect.any(Error),
    );

    // The next alarm reads the live context and starts a segment: a failed
    // recovery does not stop tracking.
    fake.windows.getLastFocused.mockResolvedValue({
      id: 7,
      focused: true,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });

    alarm.listener!({ name: 'heartbeat' });

    await vi.waitFor(() => {
      expect(setSegment).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: 'youtube.com', tabId: 42, windowId: 7 }),
      );
    });

    consoleError.mockRestore();
  });
});
