import type { DayKey, Segment } from '@/shared/types';

/**
 * Alarm period and tolerance bound. The segment is committed at least once
 * every 30 s.
 */
export const HEARTBEAT_MS = 30_000;

/**
 * Gap after which the segment is stale. The browser was closed or the
 * machine slept.
 */
export const STALE_MS = 90_000;

/** Active tab of the window that is in focus now. */
export interface ActiveTab {
  tabId: number;
  windowId: number;
  domain: string | null;
}

/** Tracking state: the current segment and the live context. */
export interface TrackerState {
  segment: Segment | null;
  focusedWindowId: number | null;
  activeTab: ActiveTab | null;
}

/**
 * A finished piece of time: seconds of one domain for an hour of the local
 * day.
 */
export interface Commit {
  day: DayKey;
  hour: number;
  domain: string;
  seconds: number;
}

/** Event handling result: the new state, commits, and the segment to save. */
export interface ReduceResult {
  state: TrackerState;
  commits: Commit[];
  segment: Segment | null;
}

/** Events that the tracker reacts to. */
export type TrackerEvent =
  | { type: 'swStart' }
  | { type: 'focusChanged'; windowId: number | null; activeTab: ActiveTab | null }
  | { type: 'tabActivated'; tabId: number; windowId: number; domain: string | null }
  | { type: 'tabUpdated'; tabId: number; domain: string | null }
  | { type: 'tabRemoved'; tabId: number }
  | { type: 'windowRemoved'; windowId: number }
  | { type: 'heartbeat' };

/** Live context: the focus and active tab values after the event. */
interface LiveContext {
  focusedWindowId: number | null;
  activeTab: ActiveTab | null;
}

/**
 * Handles the event and returns the new state, commits, and the segment for
 * saving.
 */
export function reduce(state: TrackerState, event: TrackerEvent, now: number): ReduceResult {
  switch (event.type) {
    case 'swStart':
      return reduceSwStart(state, now);
    case 'focusChanged':
      return transition(
        state,
        {
          focusedWindowId: event.windowId,
          activeTab: event.windowId === null ? null : event.activeTab,
        },
        now,
      );
    case 'tabActivated':
      return reduceTabActivated(state, event.tabId, event.windowId, event.domain, now);
    case 'tabUpdated':
      return reduceTabUpdated(state, event.tabId, event.domain, now);
    case 'tabRemoved':
      return reduceTabRemoved(state, event.tabId, now);
    case 'windowRemoved':
      return reduceWindowRemoved(state, event.windowId, now);
    case 'heartbeat':
      return reduceHeartbeat(state, now);
  }
}

/**
 * Worker start. A fresh segment on the same domain continues. Other segments
 * are committed with the gap cut off.
 */
function reduceSwStart(state: TrackerState, now: number): ReduceResult {
  const segment = state.segment;
  const live = currentLive(state);
  if (segment === null) {
    return transition(state, live, now);
  }
  const activeTab = live.activeTab;
  if (
    now - segment.lastCommitAt <= STALE_MS &&
    live.focusedWindowId !== null &&
    activeTab !== null &&
    activeTab.domain === segment.domain
  ) {
    // Tracking was not interrupted. The time between commits is not lost.
    // Only the tab of the segment is updated.
    const continued: Segment = { ...segment, tabId: activeTab.tabId, windowId: activeTab.windowId };
    return { state: { ...state, segment: continued }, commits: [], segment: continued };
  }
  // A gap larger than the tolerance bound is not counted. The commit is cut
  // to lastCommitAt + HEARTBEAT_MS, and the new segment starts at now. The
  // span between the cut-off part and now is not tracked.
  return transition(state, live, now, Math.min(now, segment.lastCommitAt + HEARTBEAT_MS));
}

/** Tab activation. The event is counted only in the focused window. */
function reduceTabActivated(
  state: TrackerState,
  tabId: number,
  windowId: number,
  domain: string | null,
  now: number,
): ReduceResult {
  if (windowId !== state.focusedWindowId) {
    return unchanged(state);
  }
  const activeTab: ActiveTab = { tabId, windowId, domain };
  return transition(state, { focusedWindowId: state.focusedWindowId, activeTab }, now);
}

/**
 * Tab URL change. The current tab is committed and gets a new segment. Other
 * tabs are ignored.
 */
function reduceTabUpdated(
  state: TrackerState,
  tabId: number,
  domain: string | null,
  now: number,
): ReduceResult {
  const segment = state.segment;
  const isCurrent =
    segment !== null
      ? tabId === segment.tabId
      : state.focusedWindowId !== null &&
        state.activeTab !== null &&
        tabId === state.activeTab.tabId;
  if (!isCurrent) {
    return unchanged(state);
  }
  const activeTab =
    state.activeTab !== null && state.activeTab.tabId === tabId
      ? { ...state.activeTab, domain }
      : state.activeTab;
  if (segment !== null && domain === segment.domain) {
    // A transition inside the domain (SPA) does not interrupt the segment.
    return unchanged({ ...state, activeTab });
  }
  return transition(state, { focusedWindowId: state.focusedWindowId, activeTab }, now);
}

/** Tab close. The segment of the current tab is committed and ends. */
function reduceTabRemoved(state: TrackerState, tabId: number, now: number): ReduceResult {
  const activeTab =
    state.activeTab !== null && state.activeTab.tabId === tabId ? null : state.activeTab;
  if (state.segment === null || state.segment.tabId !== tabId) {
    return unchanged({ ...state, activeTab });
  }
  return endSegment(state, { activeTab }, now);
}

/**
 * Window close. The segment of the current window is committed and ends.
 * References to the window are reset.
 */
function reduceWindowRemoved(state: TrackerState, windowId: number, now: number): ReduceResult {
  const focusedWindowId = state.focusedWindowId === windowId ? null : state.focusedWindowId;
  const activeTab =
    state.activeTab !== null && state.activeTab.windowId === windowId ? null : state.activeTab;
  if (state.segment === null || state.segment.windowId !== windowId) {
    return unchanged({ ...state, focusedWindowId, activeTab });
  }
  return endSegment(state, { focusedWindowId, activeTab }, now);
}

/** Heartbeat. It commits the elapsed time. The segment continues from now. */
function reduceHeartbeat(state: TrackerState, now: number): ReduceResult {
  const segment = state.segment;
  if (segment === null) {
    return unchanged(state);
  }
  const commits: Commit[] = [];
  const commit = commitSegment(segment, now);
  if (commit !== null) {
    commits.push(commit);
  }
  const continued: Segment = { ...segment, startedAt: now, lastCommitAt: now };
  return { state: { ...state, segment: continued }, commits, segment: continued };
}

/**
 * Common transition. It commits the old segment up to end (now by default),
 * then makes a new segment at now or deletes the segment.
 */
function transition(
  state: TrackerState,
  live: LiveContext,
  now: number,
  end: number = now,
): ReduceResult {
  const commits: Commit[] = [];
  if (state.segment !== null) {
    const commit = commitSegment(state.segment, end);
    if (commit !== null) {
      commits.push(commit);
    }
  }
  const segment = segmentFor(live, now);
  return {
    state: { segment, focusedWindowId: live.focusedWindowId, activeTab: live.activeTab },
    commits,
    segment,
  };
}

/** Commits the whole segment and deletes it. Tracking stops. */
function endSegment(
  state: TrackerState,
  updates: Partial<TrackerState>,
  end: number,
): ReduceResult {
  const commits: Commit[] = [];
  if (state.segment !== null) {
    const commit = commitSegment(state.segment, end);
    if (commit !== null) {
      commits.push(commit);
    }
  }
  return { state: { ...state, ...updates, segment: null }, commits, segment: null };
}

/**
 * New segment from the live context. Tracking does not run without focus or
 * domain.
 */
function segmentFor(live: LiveContext, at: number): Segment | null {
  const tab = live.activeTab;
  if (live.focusedWindowId === null || tab === null || tab.domain === null) {
    return null;
  }
  return {
    domain: tab.domain,
    startedAt: at,
    lastCommitAt: at,
    tabId: tab.tabId,
    windowId: tab.windowId,
  };
}

/**
 * Commit of the segment up to end. Seconds are rounded down. Less than one
 * second is not committed. The day and hour come from the end moment.
 */
function commitSegment(segment: Segment, end: number): Commit | null {
  const seconds = Math.floor(Math.max(0, end - segment.startedAt) / 1000);
  if (seconds < 1) {
    return null;
  }
  return { day: localDayKey(end), hour: new Date(end).getHours(), domain: segment.domain, seconds };
}

/** Local date of the moment ts in the format YYYY-MM-DD. */
function localDayKey(ts: number): DayKey {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Live context from the state without changes. */
function currentLive(state: TrackerState): LiveContext {
  return { focusedWindowId: state.focusedWindowId, activeTab: state.activeTab };
}

/** Result without changes: no commits and no new segment. */
function unchanged(state: TrackerState): ReduceResult {
  return { state, commits: [], segment: state.segment };
}
