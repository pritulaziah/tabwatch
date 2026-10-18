import { describe, expect, it } from 'vitest';

import { reduce } from '@/background/tracker';
import type { ActiveTab, TrackerState } from '@/background/tracker';
import type { Segment } from '@/shared/types';

const MINUTE = 60_000;

/** Fixed base: local noon. Minute offsets do not cross midnight. */
const BASE = new Date(2026, 5, 15, 12, 0, 0).getTime();

/** Expected day key: the local date of the moment ts in YYYY-MM-DD format. */
function expectedDayKey(ts: number): string {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Default tracking state: no segment, the pause is off, no live context. */
function makeState(overrides: Partial<TrackerState> = {}): TrackerState {
  return {
    segment: null,
    focusedWindowId: null,
    activeTab: null,
    ...overrides,
  };
}

/** Segment with typical values. Fields are overridden at the call site. */
function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    domain: 'youtube.com',
    startedAt: BASE,
    lastCommitAt: BASE,
    tabId: 1,
    windowId: 1,
    ...overrides,
  };
}

/** Active tab with typical values. */
function makeTab(overrides: Partial<ActiveTab> = {}): ActiveTab {
  return {
    tabId: 1,
    windowId: 1,
    domain: 'youtube.com',
    ...overrides,
  };
}

describe('tracker', () => {
  it('swStart_starts_segment_when_focus_and_domain_present', () => {
    const state = makeState({
      focusedWindowId: 2,
      activeTab: makeTab({ tabId: 5, windowId: 2 }),
    });

    const result = reduce(state, { type: 'swStart' }, BASE);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 5,
      windowId: 2,
    };
    expect(result.commits).toEqual([]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('swStart_stays_idle_without_focus', () => {
    const state = makeState();

    const result = reduce(state, { type: 'swStart' }, BASE);

    expect(result).toEqual({ state, commits: [], segment: null });
  });

  it('swStart_continues_fresh_segment_on_same_domain', () => {
    // The gap is exactly at the staleness boundary: the segment is
    // still fresh and no time is lost.
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 120_000, lastCommitAt: BASE - 90_000 }),
      focusedWindowId: 2,
      activeTab: makeTab({ tabId: 5, windowId: 2 }),
    });

    const result = reduce(state, { type: 'swStart' }, BASE);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: BASE - 120_000,
      lastCommitAt: BASE - 90_000,
      tabId: 5,
      windowId: 2,
    };
    expect(result.commits).toEqual([]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('swStart_truncates_stale_segment_at_last_commit_plus_heartbeat', () => {
    // Local 23:50:05: now is already the next day, but the truncated end
    // (23:50:35) is still the current day, so the commit day shows it
    // comes from the truncation end, not from now.
    const lastCommitAt = new Date(2026, 9, 16, 23, 50, 5).getTime();
    const now = lastCommitAt + 10 * MINUTE;
    const state = makeState({
      segment: makeSegment({ startedAt: lastCommitAt, lastCommitAt }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(state, { type: 'swStart' }, now);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: now,
      lastCommitAt: now,
      tabId: 1,
      windowId: 1,
    };
    expect(result.commits).toEqual([
      { day: '2026-10-16', hour: 23, domain: 'youtube.com', seconds: 30 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('swStart_stale_restart_does_not_count_the_gap_on_the_next_heartbeat', () => {
    // Stale segment: the worker starts 10 minutes after the last commit.
    const state = makeState({
      segment: makeSegment({ startedAt: BASE, lastCommitAt: BASE }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const restarted = reduce(state, { type: 'swStart' }, BASE + 10 * MINUTE);
    const heartbeat = reduce(restarted.state, { type: 'heartbeat' }, BASE + 15 * MINUTE);

    // The commit is truncated to 30 s and the 10-minute gap does not
    // count: the heartbeat adds only 5 minutes.
    expect(restarted.commits).toEqual([
      { day: expectedDayKey(BASE + 30_000), hour: 12, domain: 'youtube.com', seconds: 30 },
    ]);
    expect(heartbeat.commits).toEqual([
      { day: expectedDayKey(BASE + 15 * MINUTE), hour: 12, domain: 'youtube.com', seconds: 300 },
    ]);
  });

  it('swStart_commits_fresh_segment_when_domain_changed', () => {
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 10_000, lastCommitAt: BASE - 10_000 }),
      focusedWindowId: 1,
      activeTab: makeTab({ domain: 'github.com' }),
    });

    const result = reduce(state, { type: 'swStart' }, BASE);

    const expectedSegment: Segment = {
      domain: 'github.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 1,
      windowId: 1,
    };
    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 10 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('swStart_ends_segment_when_no_active_domain', () => {
    const lastCommitAt = BASE - 10 * MINUTE;
    const end = lastCommitAt + 30_000;
    const state = makeState({
      segment: makeSegment({ startedAt: lastCommitAt, lastCommitAt }),
      focusedWindowId: 1,
      activeTab: makeTab({ domain: null }),
    });

    const result = reduce(state, { type: 'swStart' }, BASE);

    expect(result.commits).toEqual([
      { day: expectedDayKey(end), hour: 11, domain: 'youtube.com', seconds: 30 },
    ]);
    expect(result.segment).toBeNull();
    expect(result.state).toEqual({ ...state, segment: null });
  });

  it('focusChanged_to_window_starts_segment_from_active_tab', () => {
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 20_000, lastCommitAt: BASE - 20_000 }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(
      state,
      {
        type: 'focusChanged',
        windowId: 2,
        activeTab: makeTab({ tabId: 5, windowId: 2, domain: 'github.com' }),
      },
      BASE,
    );

    const expectedSegment: Segment = {
      domain: 'github.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 5,
      windowId: 2,
    };
    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 20 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({
      segment: expectedSegment,
      focusedWindowId: 2,
      activeTab: makeTab({ tabId: 5, windowId: 2, domain: 'github.com' }),
    });
  });

  it('focusChanged_to_none_commits_and_ends_segment', () => {
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 45_000, lastCommitAt: BASE - 45_000 }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    // The tab in the event is not empty: the focus loss resets it and
    // does not take it from the event.
    const result = reduce(
      state,
      { type: 'focusChanged', windowId: null, activeTab: makeTab() },
      BASE,
    );

    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 45 },
    ]);
    expect(result.segment).toBeNull();
    expect(result.state).toEqual({ segment: null, focusedWindowId: null, activeTab: null });
  });

  it('tabActivated_in_focused_window_commits_and_switches_domain', () => {
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 15_000, lastCommitAt: BASE - 15_000, windowId: 2 }),
      focusedWindowId: 2,
      activeTab: makeTab({ windowId: 2 }),
    });

    const result = reduce(
      state,
      { type: 'tabActivated', tabId: 5, windowId: 2, domain: 'github.com' },
      BASE,
    );

    const expectedSegment: Segment = {
      domain: 'github.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 5,
      windowId: 2,
    };
    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 15 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({
      segment: expectedSegment,
      focusedWindowId: 2,
      activeTab: makeTab({ tabId: 5, windowId: 2, domain: 'github.com' }),
    });
  });

  it('tabActivated_in_unfocused_window_is_ignored', () => {
    const tracking = makeState({
      segment: makeSegment({ startedAt: BASE - 15_000, lastCommitAt: BASE - 15_000 }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const trackingResult = reduce(
      tracking,
      { type: 'tabActivated', tabId: 9, windowId: 2, domain: 'github.com' },
      BASE,
    );
    expect(trackingResult).toEqual({ state: tracking, commits: [], segment: tracking.segment });

    const idle = makeState();
    const idleResult = reduce(
      idle,
      { type: 'tabActivated', tabId: 9, windowId: 2, domain: 'github.com' },
      BASE,
    );
    expect(idleResult).toEqual({ state: idle, commits: [], segment: null });
  });

  it('tabUpdated_same_domain_keeps_segment_running', () => {
    const state = makeState({
      segment: makeSegment({
        domain: 'github.com',
        startedAt: BASE - 30_000,
        lastCommitAt: BASE - 30_000,
        tabId: 5,
      }),
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: 'github.com' }),
    });

    const result = reduce(state, { type: 'tabUpdated', tabId: 5, domain: 'github.com' }, BASE);

    expect(result).toEqual({ state, commits: [], segment: state.segment });
  });

  it('tabUpdated_new_domain_commits_and_restarts_segment', () => {
    const state = makeState({
      segment: makeSegment({
        domain: 'github.com',
        startedAt: BASE - 10_000,
        lastCommitAt: BASE - 10_000,
        tabId: 5,
      }),
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: 'github.com' }),
    });

    const result = reduce(state, { type: 'tabUpdated', tabId: 5, domain: 'notion.com' }, BASE);

    const expectedSegment: Segment = {
      domain: 'notion.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 5,
      windowId: 1,
    };
    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'github.com', seconds: 10 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({
      segment: expectedSegment,
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: 'notion.com' }),
    });
  });

  it('tabUpdated_non_http_url_commits_and_ends_segment', () => {
    const state = makeState({
      segment: makeSegment({
        domain: 'github.com',
        startedAt: BASE - 45_000,
        lastCommitAt: BASE - 45_000,
        tabId: 5,
      }),
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: 'github.com' }),
    });

    const result = reduce(state, { type: 'tabUpdated', tabId: 5, domain: null }, BASE);

    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'github.com', seconds: 45 },
    ]);
    expect(result.segment).toBeNull();
    expect(result.state).toEqual({
      segment: null,
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: null }),
    });
  });

  it('tabUpdated_other_tab_is_ignored', () => {
    const tracking = makeState({
      segment: makeSegment({ startedAt: BASE - 20_000, lastCommitAt: BASE - 20_000, tabId: 5 }),
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5 }),
    });

    const trackingResult = reduce(
      tracking,
      { type: 'tabUpdated', tabId: 7, domain: 'notion.com' },
      BASE,
    );
    expect(trackingResult).toEqual({ state: tracking, commits: [], segment: tracking.segment });

    const idle = makeState({ focusedWindowId: 1, activeTab: makeTab({ tabId: 5, domain: null }) });
    const idleResult = reduce(idle, { type: 'tabUpdated', tabId: 7, domain: 'notion.com' }, BASE);
    expect(idleResult).toEqual({ state: idle, commits: [], segment: null });
  });

  it('tabUpdated_starts_segment_when_active_tab_becomes_trackable', () => {
    const state = makeState({
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: null }),
    });

    const result = reduce(state, { type: 'tabUpdated', tabId: 5, domain: 'youtube.com' }, BASE);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 5,
      windowId: 1,
    };
    expect(result.commits).toEqual([]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({
      segment: expectedSegment,
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5, domain: 'youtube.com' }),
    });
  });

  it('tabRemoved_current_tab_commits_and_ends_segment', () => {
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 45_000, lastCommitAt: BASE - 45_000, tabId: 5 }),
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5 }),
    });

    const result = reduce(state, { type: 'tabRemoved', tabId: 5 }, BASE);

    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 45 },
    ]);
    expect(result.segment).toBeNull();
    expect(result.state).toEqual({ segment: null, focusedWindowId: 1, activeTab: null });
  });

  it('tabRemoved_other_tab_is_ignored', () => {
    const tracking = makeState({
      segment: makeSegment({ tabId: 5 }),
      focusedWindowId: 1,
      activeTab: makeTab({ tabId: 5 }),
    });

    const trackingResult = reduce(tracking, { type: 'tabRemoved', tabId: 7 }, BASE);
    expect(trackingResult).toEqual({ state: tracking, commits: [], segment: tracking.segment });

    const idle = makeState({ focusedWindowId: 1, activeTab: makeTab({ tabId: 5 }) });
    const idleResult = reduce(idle, { type: 'tabRemoved', tabId: 7 }, BASE);
    expect(idleResult).toEqual({ state: idle, commits: [], segment: null });
  });

  it('windowRemoved_current_window_commits_and_ends_segment', () => {
    const state = makeState({
      segment: makeSegment({
        startedAt: BASE - 45_000,
        lastCommitAt: BASE - 45_000,
        tabId: 5,
        windowId: 2,
      }),
      focusedWindowId: 2,
      activeTab: makeTab({ tabId: 5, windowId: 2 }),
    });

    const result = reduce(state, { type: 'windowRemoved', windowId: 2 }, BASE);

    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 45 },
    ]);
    expect(result.segment).toBeNull();
    expect(result.state).toEqual({ segment: null, focusedWindowId: null, activeTab: null });
  });

  it('windowRemoved_other_window_is_ignored', () => {
    const tracking = makeState({
      segment: makeSegment({ tabId: 5, windowId: 2 }),
      focusedWindowId: 2,
      activeTab: makeTab({ tabId: 5, windowId: 2 }),
    });

    const trackingResult = reduce(tracking, { type: 'windowRemoved', windowId: 3 }, BASE);
    expect(trackingResult).toEqual({ state: tracking, commits: [], segment: tracking.segment });

    const idle = makeState({ focusedWindowId: 2, activeTab: makeTab({ tabId: 5, windowId: 2 }) });
    const idleResult = reduce(idle, { type: 'windowRemoved', windowId: 3 }, BASE);
    expect(idleResult).toEqual({ state: idle, commits: [], segment: null });
  });

  it('heartbeat_commits_elapsed_and_continues_from_now', () => {
    const state = makeState({
      segment: makeSegment({ startedAt: BASE - 60_000, lastCommitAt: BASE - 60_000 }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(state, { type: 'heartbeat' }, BASE);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: BASE,
      lastCommitAt: BASE,
      tabId: 1,
      windowId: 1,
    };
    expect(result.commits).toEqual([
      { day: expectedDayKey(BASE), hour: 12, domain: 'youtube.com', seconds: 60 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('heartbeat_without_segment_does_nothing', () => {
    const state = makeState({ focusedWindowId: 1, activeTab: makeTab() });

    const result = reduce(state, { type: 'heartbeat' }, BASE);

    expect(result).toEqual({ state, commits: [], segment: null });
  });

  it('heartbeat_after_clock_moved_back_restarts_without_commit', () => {
    const movedBack = BASE - 5_000;
    const state = makeState({
      segment: makeSegment(),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(state, { type: 'heartbeat' }, movedBack);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: movedBack,
      lastCommitAt: movedBack,
      tabId: 1,
      windowId: 1,
    };
    expect(result.commits).toEqual([]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('commit_attributes_cross_midnight_segment_to_end_day', () => {
    const startedAt = new Date(2026, 9, 16, 23, 59, 50).getTime();
    const now = new Date(2026, 9, 17, 0, 0, 20).getTime();
    const state = makeState({
      segment: makeSegment({ startedAt, lastCommitAt: startedAt }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(state, { type: 'heartbeat' }, now);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: now,
      lastCommitAt: now,
      tabId: 1,
      windowId: 1,
    };
    expect(result.commits).toEqual([
      { day: '2026-10-17', hour: 0, domain: 'youtube.com', seconds: 30 },
    ]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('commit_attributes_a_segment_crossing_an_hour_to_the_end_hour', () => {
    const startedAt = new Date(2026, 5, 15, 10, 59, 50).getTime();
    const now = new Date(2026, 5, 15, 11, 0, 20).getTime();
    const state = makeState({
      segment: makeSegment({ startedAt, lastCommitAt: startedAt }),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(state, { type: 'heartbeat' }, now);

    // The whole segment goes to the end hour: 30 seconds from 10:59:50
    // to 11:00:20 go to hour 11.
    expect(result.commits).toEqual([
      { day: expectedDayKey(now), hour: 11, domain: 'youtube.com', seconds: 30 },
    ]);
    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: now,
      lastCommitAt: now,
      tabId: 1,
      windowId: 1,
    };
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });

  it('heartbeat_below_one_second_writes_no_commit', () => {
    const state = makeState({
      segment: makeSegment(),
      focusedWindowId: 1,
      activeTab: makeTab(),
    });

    const result = reduce(state, { type: 'heartbeat' }, BASE + 400);

    const expectedSegment: Segment = {
      domain: 'youtube.com',
      startedAt: BASE + 400,
      lastCommitAt: BASE + 400,
      tabId: 1,
      windowId: 1,
    };
    expect(result.commits).toEqual([]);
    expect(result.segment).toEqual(expectedSegment);
    expect(result.state).toEqual({ ...state, segment: expectedSegment });
  });
});
