import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFakeChromeWorker } from '../helpers/fakeChromeWorker';
import { addSeconds, setSegment } from '@/background/store';
import type { Commit, TrackerState } from '@/background/tracker';
import { MaintenanceActiveError } from '@/shared/maintenance';
import type { Segment } from '@/shared/types';

vi.mock('@/background/store', () => ({
  getSegment: vi.fn().mockResolvedValue(null),
  getMeta: vi.fn().mockResolvedValue({ schemaVersion: 1, installedAt: 0 }),
  addSeconds: vi.fn().mockResolvedValue(undefined),
  setSegment: vi.fn().mockResolvedValue(undefined),
}));

const chromeGlobal = globalThis as { chrome?: unknown };
const originalChrome = chromeGlobal.chrome;

afterEach(() => {
  chromeGlobal.chrome = originalChrome;
});

describe('background wiring', () => {
  it('applyResult_retries_failed_commits_on_the_next_call', async () => {
    installFakeChromeWorker();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The module registers listeners on load, so the chrome stub is set
    // before the import.
    const { applyResult, ready } = await import('@/background/index');
    await ready;

    const addSecondsMock = vi.mocked(addSeconds);
    const commit: Commit = { day: '2026-10-16', hour: 12, domain: 'youtube.com', seconds: 30 };
    const state: TrackerState = { segment: null, focusedWindowId: null, activeTab: null };

    addSecondsMock.mockRejectedValueOnce(new Error('storage write failed'));

    await applyResult({ state, commits: [commit], segment: null });

    expect(consoleError).toHaveBeenCalled();
    expect(addSecondsMock).toHaveBeenCalledTimes(1);
    expect(addSecondsMock).toHaveBeenNthCalledWith(
      1,
      commit.day,
      commit.hour,
      commit.domain,
      commit.seconds,
    );

    // Retry with no new commits: the unsaved commit goes to the storage
    // with the old arguments.
    await applyResult({ state, commits: [], segment: null });

    expect(addSecondsMock).toHaveBeenCalledTimes(2);
    expect(addSecondsMock).toHaveBeenNthCalledWith(
      2,
      commit.day,
      commit.hour,
      commit.domain,
      commit.seconds,
    );

    // The commit is saved and the queue is empty: there is no third retry.
    await applyResult({ state, commits: [], segment: null });

    expect(addSecondsMock).toHaveBeenCalledTimes(2);

    consoleError.mockRestore();
  });

  it('recoverLiveContext_starts_tracking_from_the_focused_window', async () => {
    const { fake } = installFakeChromeWorker();
    const { applyResult, ready, recoverLiveContext } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const state: TrackerState = { segment: null, focusedWindowId: null, activeTab: null };
    await applyResult({ state, commits: [], segment: null });

    fake.windows.getLastFocused.mockResolvedValue({
      id: 7,
      focused: true,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });

    await recoverLiveContext();

    expect(fake.windows.getLastFocused).toHaveBeenCalledWith({ populate: true });
    expect(setSegmentMock).toHaveBeenLastCalledWith({
      domain: 'youtube.com',
      startedAt: expect.any(Number),
      lastCommitAt: expect.any(Number),
      tabId: 42,
      windowId: 7,
    });
  });

  it('recoverLiveContext_keeps_the_state_while_tracking', async () => {
    const { fake } = installFakeChromeWorker();
    const { applyResult, ready, recoverLiveContext } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const segment: Segment = {
      domain: 'youtube.com',
      startedAt: 1_000,
      lastCommitAt: 1_000,
      tabId: 42,
      windowId: 7,
    };
    const state: TrackerState = {
      segment,
      focusedWindowId: 7,
      activeTab: { tabId: 42, windowId: 7, domain: 'youtube.com' },
    };
    await applyResult({ state, commits: [], segment });
    setSegmentMock.mockClear();

    fake.windows.getLastFocused.mockResolvedValue({
      id: 7,
      focused: true,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });

    await recoverLiveContext();

    // The reconciliation continues the same segment: the domain and the
    // tab do not change.
    expect(fake.windows.getLastFocused).toHaveBeenCalledWith({ populate: true });
    expect(setSegmentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ domain: 'youtube.com', tabId: 42, windowId: 7 }),
    );
  });

  it('recoverLiveContext_keeps_the_state_without_a_focused_window', async () => {
    const { fake } = installFakeChromeWorker();
    const { applyResult, ready, recoverLiveContext } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const state: TrackerState = { segment: null, focusedWindowId: null, activeTab: null };
    await applyResult({ state, commits: [], segment: null });

    fake.windows.getLastFocused.mockResolvedValue({
      id: 7,
      focused: false,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });

    const callsBefore = setSegmentMock.mock.calls.length;
    await recoverLiveContext();

    expect(fake.windows.getLastFocused).toHaveBeenCalledWith({ populate: true });
    // A window without focus gives no segment: the recovery keeps the
    // state without a segment.
    expect(setSegmentMock.mock.calls.slice(callsBefore)).toEqual([[null]]);
  });

  it('recoverLiveContext_retries_on_the_next_alarm', async () => {
    const { fake, alarm } = installFakeChromeWorker();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { applyResult, ready } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const state: TrackerState = { segment: null, focusedWindowId: null, activeTab: null };
    await applyResult({ state, commits: [], segment: null });

    fake.windows.getLastFocused.mockRejectedValueOnce(new Error('no window')).mockResolvedValue({
      id: 7,
      focused: true,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });
    setSegmentMock.mockClear();

    // First alarm: the window read fails, so no segment appears and the
    // attempt repeats.
    alarm.listener!({ name: 'heartbeat' });
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        '[tabwatch] failed to read the last focused window',
        expect.any(Error),
      );
    });
    expect(setSegmentMock).toHaveBeenCalledWith(null);
    expect(setSegmentMock.mock.calls.every(([segment]) => segment === null)).toBe(true);

    // Second alarm: the window and the active tab are found, so the
    // tracking resumes.
    alarm.listener!({ name: 'heartbeat' });
    await vi.waitFor(() => {
      expect(setSegmentMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: 'youtube.com', tabId: 42, windowId: 7 }),
      );
    });

    consoleError.mockRestore();
  });

  it('focusChanged_with_a_fresh_popup_record_keeps_the_segment', async () => {
    const { fake, focus } = installFakeChromeWorker();
    const { applyResult, ready } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const segment: Segment = {
      domain: 'youtube.com',
      startedAt: 1_000,
      lastCommitAt: 1_000,
      tabId: 42,
      windowId: 7,
    };
    const state: TrackerState = {
      segment,
      focusedWindowId: 7,
      activeTab: { tabId: 42, windowId: 7, domain: 'youtube.com' },
    };
    await applyResult({ state, commits: [], segment });
    setSegmentMock.mockClear();

    // The mark is fresh: the extension popup took the focus, so the
    // segment continues.
    fake.storage.session.get.mockResolvedValue({ popupOpen: Date.now() });

    focus.listener!(fake.windows.WINDOW_ID_NONE);
    await vi.waitFor(() => {
      expect(fake.storage.session.get).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setSegmentMock).not.toHaveBeenCalledWith(null);
    expect(setSegmentMock).not.toHaveBeenCalled();
  });

  it('focusChanged_with_a_stale_popup_record_closes_the_segment', async () => {
    const { fake, focus } = installFakeChromeWorker();
    const { applyResult, ready } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const segment: Segment = {
      domain: 'youtube.com',
      startedAt: 1_000,
      lastCommitAt: 1_000,
      tabId: 42,
      windowId: 7,
    };
    const state: TrackerState = {
      segment,
      focusedWindowId: 7,
      activeTab: { tabId: 42, windowId: 7, domain: 'youtube.com' },
    };
    await applyResult({ state, commits: [], segment });
    setSegmentMock.mockClear();

    // The mark is stale: the popup is closed and the focus is really lost.
    fake.storage.session.get.mockResolvedValue({ popupOpen: Date.now() - 60_000 });

    focus.listener!(fake.windows.WINDOW_ID_NONE);
    await vi.waitFor(() => {
      expect(setSegmentMock).toHaveBeenCalledWith(null);
    });
  });

  it('focusChanged_polls_for_a_late_popup_record', async () => {
    const { fake, focus } = installFakeChromeWorker();
    const { applyResult, ready } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const segment: Segment = {
      domain: 'youtube.com',
      startedAt: 1_000,
      lastCommitAt: 1_000,
      tabId: 42,
      windowId: 7,
    };
    const state: TrackerState = {
      segment,
      focusedWindowId: 7,
      activeTab: { tabId: 42, windowId: 7, domain: 'youtube.com' },
    };
    await applyResult({ state, commits: [], segment });
    setSegmentMock.mockClear();

    // The first mark read finds nothing and the second finds a fresh
    // mark: the popup wrote it in time.
    fake.storage.session.get.mockResolvedValueOnce({}).mockResolvedValue({ popupOpen: Date.now() });

    focus.listener!(fake.windows.WINDOW_ID_NONE);
    await vi.waitFor(() => {
      expect(fake.storage.session.get.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    // The event queue finishes after the second read: the focus is not lost.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setSegmentMock).not.toHaveBeenCalled();
  });

  it('recoverLiveContext_resumes_tracking_through_the_popup_record', async () => {
    const { fake } = installFakeChromeWorker();
    const { applyResult, ready, recoverLiveContext } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const state: TrackerState = {
      segment: null,
      focusedWindowId: 7,
      activeTab: null,
    };
    await applyResult({ state, commits: [], segment: null });

    // The popup is open: the window lost focus but remains the one the
    // user was on.
    fake.storage.session.get.mockResolvedValue({ popupOpen: Date.now() });
    fake.windows.getLastFocused.mockResolvedValue({
      id: 7,
      focused: false,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });

    await recoverLiveContext();

    expect(fake.windows.getLastFocused).toHaveBeenCalledWith({ populate: true });
    expect(setSegmentMock).toHaveBeenLastCalledWith({
      domain: 'youtube.com',
      startedAt: expect.any(Number),
      lastCommitAt: expect.any(Number),
      tabId: 42,
      windowId: 7,
    });
  });

  it('recoverLiveContext_closes_a_stale_segment', async () => {
    const { fake } = installFakeChromeWorker();
    const { applyResult, ready, recoverLiveContext } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const segment: Segment = {
      domain: 'youtube.com',
      startedAt: 1_000,
      lastCommitAt: 1_000,
      tabId: 42,
      windowId: 7,
    };
    const state: TrackerState = {
      segment,
      focusedWindowId: 7,
      activeTab: { tabId: 42, windowId: 7, domain: 'youtube.com' },
    };
    await applyResult({ state, commits: [], segment });
    setSegmentMock.mockClear();

    // The mark is stale and the window has no focus: time outside the
    // browser does not enter the segment.
    fake.storage.session.get.mockResolvedValue({ popupOpen: Date.now() - 60_000 });
    fake.windows.getLastFocused.mockResolvedValue({
      id: 7,
      focused: false,
      tabs: [{ id: 42, active: true, url: 'https://www.youtube.com/watch?v=1' }],
    });

    await recoverLiveContext();

    expect(setSegmentMock).toHaveBeenLastCalledWith(null);
  });

  it('recoverLiveContext_logs_a_window_error', async () => {
    const { fake } = installFakeChromeWorker();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { applyResult, ready, recoverLiveContext } = await import('@/background/index');
    await ready;

    const setSegmentMock = vi.mocked(setSegment);
    const state: TrackerState = { segment: null, focusedWindowId: null, activeTab: null };
    await applyResult({ state, commits: [], segment: null });
    setSegmentMock.mockClear();

    fake.windows.getLastFocused.mockRejectedValue(new Error('no window'));

    await recoverLiveContext();

    expect(consoleError).toHaveBeenCalledWith(
      '[tabwatch] failed to read the last focused window',
      expect.any(Error),
    );
    expect(setSegmentMock).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('applyResult_defers_a_commit_held_by_a_bulk_write', async () => {
    installFakeChromeWorker();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { applyResult, ready } = await import('@/background/index');
    await ready;

    const addSecondsMock = vi.mocked(addSeconds);
    addSecondsMock.mockClear();
    const commit: Commit = { day: '2026-10-16', hour: 12, domain: 'youtube.com', seconds: 30 };
    const state: TrackerState = { segment: null, focusedWindowId: null, activeTab: null };

    // The interface rewrites the days: the commit waits without an error.
    addSecondsMock.mockRejectedValueOnce(new MaintenanceActiveError());
    await applyResult({ state, commits: [commit], segment: null });

    expect(consoleError).not.toHaveBeenCalled();

    // The bulk write ended: the next save writes the deferred commit.
    await applyResult({ state, commits: [], segment: null });

    expect(addSecondsMock).toHaveBeenCalledTimes(2);
    expect(addSecondsMock).toHaveBeenNthCalledWith(
      2,
      commit.day,
      commit.hour,
      commit.domain,
      commit.seconds,
    );

    consoleError.mockRestore();
  });
});
