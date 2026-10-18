import { addSeconds, getMeta, getSegment, setSegment } from '@/background/store';
import { HEARTBEAT_MS, reduce } from '@/background/tracker';
import type {
  ActiveTab,
  Commit,
  ReduceResult,
  TrackerEvent,
  TrackerState,
} from '@/background/tracker';
import { domainFromUrl } from '@/shared/domain';
import { MaintenanceActiveError } from '@/shared/maintenance';
import { POPUP_OPEN_KEY, isPopupOpen } from '@/shared/presence';

/** Name of the alarm that wakes the worker every 30 s. */
const HEARTBEAT_ALARM = 'heartbeat';

/** Poll step for the "popup open" mark on focus loss. */
const POPUP_POLL_STEP_MS = 100;

/** Total wait time for the mark on focus loss. */
const POPUP_POLL_TOTAL_MS = 500;

/** Tracking state before the recovery ends and after a failed recovery. */
const EMPTY_STATE: TrackerState = {
  segment: null,
  focusedWindowId: null,
  activeTab: null,
};

/** Current tracking state. */
let state: TrackerState = EMPTY_STATE;

/** Commits whose write failed. They are retried at the next result save. */
let pendingCommits: Commit[] = [];

/** Event queue. Two events do not change the state at the same time. */
let eventChain: Promise<void> = Promise.resolve();

/**
 * State recovery at module load. A failed recovery leaves the empty state,
 * so the next event starts tracking again. Exported for the unit test.
 */
export const ready: Promise<void> = init().catch((error) => {
  console.error('[tabwatch] failed to restore the tracking state', error);
});

/** Restores the state after worker start and creates the heartbeat alarm. */
async function init(): Promise<void> {
  const segment = await getSegment();
  await getMeta();

  let focusedWindowId: number | null = null;
  let activeTab: ActiveTab | null = null;
  try {
    const window = await chrome.windows.getLastFocused({ populate: true });
    if (window.focused && window.id !== undefined) {
      focusedWindowId = window.id;
      activeTab = toActiveTab(
        window.tabs?.find((candidate) => candidate.active),
        window.id,
      );
    }
  } catch {
    // No window: the browser starts or no window exists yet. Tracking starts
    // with the first event.
  }

  const result = reduce({ segment, focusedWindowId, activeTab }, { type: 'swStart' }, Date.now());
  await applyResult(result);

  const alarm = await chrome.alarms.get(HEARTBEAT_ALARM);
  if (alarm === undefined) {
    await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_MS / 60_000 });
  }
}

/** Handles a Chrome event. It computes the new state and saves the result. */
async function handle(event: TrackerEvent): Promise<void> {
  await ready;
  const result = reduce(state, event, Date.now());
  await applyResult(result);
}

/**
 * Queues the event so that two events do not change the state at the same
 * time.
 */
function enqueue(event: TrackerEvent): void {
  eventChain = eventChain
    .then(() => handle(event))
    .catch((error) => {
      console.error('[tabwatch] failed to handle event', error);
    });
}

/**
 * Aligns the live context with the browser. It reads the focused window and
 * its active tab again and sends a focus event. Exported for the unit test.
 */
export async function recoverLiveContext(): Promise<void> {
  await ready;
  const popupOpen = await readPopupOpen();
  let lastFocused: chrome.windows.Window;
  try {
    lastFocused = await chrome.windows.getLastFocused({ populate: true });
  } catch (error) {
    console.error('[tabwatch] failed to read the last focused window', error);
    return;
  }
  // The extension popup takes focus from the window, but the window stays
  // active. While the mark is fresh, the window is used regardless of the
  // focused flag.
  const windowId = popupOpen
    ? (lastFocused.id ?? null)
    : lastFocused.focused && lastFocused.id !== undefined
      ? lastFocused.id
      : null;
  const activeTab =
    windowId === null
      ? null
      : toActiveTab(
          lastFocused.tabs?.find((tab) => tab.active),
          windowId,
        );
  if (popupOpen && windowId === null) {
    // The popup is open, but no window exists. There is nothing to resume.
    return;
  }
  await handle({ type: 'focusChanged', windowId, activeTab });
}

/** Fresh "popup open" mark. A read error means that no mark exists. */
async function readPopupOpen(): Promise<boolean> {
  try {
    const stored = await chrome.storage.session.get(POPUP_OPEN_KEY);
    return isPopupOpen(stored[POPUP_OPEN_KEY], Date.now());
  } catch (error) {
    console.error('[tabwatch] failed to read the popup mark', error);
    return false;
  }
}

/**
 * Waits for a fresh "popup open" mark no longer than POPUP_POLL_TOTAL_MS. When
 * the popup opens, focus goes away before React writes the mark. Without this
 * wait, the worker would close the segment at popup open.
 */
async function waitForPopupOpen(): Promise<boolean> {
  const deadline = Date.now() + POPUP_POLL_TOTAL_MS;
  for (;;) {
    if (await readPopupOpen()) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, POPUP_POLL_STEP_MS));
  }
}

/** Queues tracking recovery after the events that are already accepted. */
function enqueueRecovery(): void {
  eventChain = eventChain
    .then(() => recoverLiveContext())
    .catch((error) => {
      console.error('[tabwatch] failed to recover live context', error);
    });
}

/**
 * Focus loss. In the event queue, it waits for the popup mark and closes the
 * segment only if the popup did not open.
 */
function enqueueFocusLoss(): void {
  eventChain = eventChain
    .then(async () => {
      if (await waitForPopupOpen()) {
        return;
      }
      await handle({ type: 'focusChanged', windowId: null, activeTab: null });
    })
    .catch((error) => {
      console.error('[tabwatch] failed to handle event', error);
    });
}

/**
 * Applies the result. It retries unsaved commits first, then writes new
 * commits, and saves the segment at the end. Exported for the unit test.
 */
export async function applyResult(result: ReduceResult): Promise<void> {
  state = result.state;
  const retries = pendingCommits;
  pendingCommits = [];
  for (const commit of retries) {
    await writeCommit(commit);
  }
  for (const commit of result.commits) {
    await writeCommit(commit);
  }
  try {
    await setSegment(result.segment);
  } catch (error) {
    // The segment stays in the worker memory until the worker stops. The next
    // heartbeat writes it again.
    console.error('[tabwatch] failed to save segment', error);
  }
}

/**
 * Writes the commit into the day. A failed write and a commit deferred by a
 * bulk write stay for a retry at the next result save.
 */
async function writeCommit(commit: Commit): Promise<void> {
  try {
    await addSeconds(commit.day, commit.hour, commit.domain, commit.seconds);
  } catch (error) {
    if (!(error instanceof MaintenanceActiveError)) {
      console.error('[tabwatch] failed to write commit', error);
    }
    pendingCommits.push(commit);
  }
}

/** Active tab for the tracker. Null if no tab or tab id exists. */
function toActiveTab(tab: chrome.tabs.Tab | undefined, windowId: number): ActiveTab | null {
  if (tab?.id === undefined) {
    return null;
  }
  return { tabId: tab.id, windowId, domain: domainFromUrl(tab.url) };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) {
    return;
  }
  enqueue({ type: 'heartbeat' });
  enqueueRecovery();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    enqueueFocusLoss();
    return;
  }
  void chrome.tabs
    .query({ active: true, windowId })
    .then((tabs) => {
      enqueue({ type: 'focusChanged', windowId, activeTab: toActiveTab(tabs[0], windowId) });
    })
    .catch((error) => {
      console.error('[tabwatch] failed to read the active tab of the focused window', error);
    });
});

chrome.tabs.onActivated.addListener((info) => {
  void chrome.tabs
    .get(info.tabId)
    .then((tab) => {
      enqueue({
        type: 'tabActivated',
        tabId: info.tabId,
        windowId: info.windowId,
        domain: domainFromUrl(tab.url),
      });
    })
    .catch((error) => {
      console.error('[tabwatch] failed to read the activated tab', error);
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url === undefined) {
    return;
  }
  enqueue({ type: 'tabUpdated', tabId, domain: domainFromUrl(changeInfo.url) });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue({ type: 'tabRemoved', tabId });
});

chrome.windows.onRemoved.addListener((windowId) => {
  enqueue({ type: 'windowRemoved', windowId });
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  enqueue({ type: 'tabUpdated', tabId: details.tabId, domain: domainFromUrl(details.url) });
});
