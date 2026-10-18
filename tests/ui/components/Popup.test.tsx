import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Popup } from '@/popup/Popup';

vi.mock('@/background/store', () => {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const key = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const now = new Date();
  const today = key(now);
  const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return {
    // Today 3h 49m 05s, yesterday 3h 24m 10s: delta +12%,
    // the sixth domain is outside the top 5.
    getDays: vi.fn(async () => ({
      [today]: {
        '9': {
          'youtube.com': 5045,
          'github.com': 3120,
          'notion.so': 2280,
          'google.com': 1560,
          'reddit.com': 1140,
          'example.com': 600,
        },
      },
      [yesterday]: { '9': { 'youtube.com': 12250 } },
    })),
    getLimits: vi.fn(async () => ({})),
    getSegment: vi.fn(async () => null),
    getSettings: vi.fn(async () => ({ theme: 'dark' })),
    setSettings: vi.fn(async () => undefined),
  };
});

/**
 * The chrome stub from setup.ts plus APIs it does not have: active tabs,
 * page navigation, and session storage for the "popup open" mark.
 */
const chromeGlobal = globalThis as unknown as {
  chrome: {
    tabs: { query: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    storage: { session: { set: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } };
  };
};

beforeEach(() => {
  chromeGlobal.chrome.tabs = {
    query: vi.fn(async () => [
      { id: 42, windowId: 7, active: true, url: 'https://www.youtube.com/watch?v=1' },
    ]),
    create: vi.fn(async () => undefined),
  };
  chromeGlobal.chrome.storage.session = {
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
});

describe('popup', () => {
  it('popup_shows_todays_total_with_seconds_and_the_delta', async () => {
    render(<Popup />);

    expect(await screen.findByText('Today')).toBeTruthy();
    expect(screen.getByText('3h 49m 05s')).toBeTruthy();
    expect(screen.getByText('12%')).toBeTruthy();
  });

  it('popup_shows_the_top_five_sites_without_ranks', async () => {
    const { container } = render(<Popup />);

    expect(await screen.findByText('youtube.com')).toBeTruthy();
    for (const domain of ['youtube.com', 'github.com', 'notion.so', 'google.com', 'reddit.com']) {
      expect(screen.getByText(domain)).toBeTruthy();
    }
    expect(screen.queryByText('example.com')).toBeNull();

    // The rows have seconds, a share of today's total, and a share bar.
    expect(screen.getByText('1h 24m 05s')).toBeTruthy();
    expect(screen.getByText('37%')).toBeTruthy();
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(5);

    // Ranks 1-5 are absent. The numbers in the popup are only percentages.
    for (const rank of ['1', '2', '3', '4', '5']) {
      expect(screen.queryByText(rank)).toBeNull();
    }
  });

  it('popup_opens_the_statistics_page_from_the_button', async () => {
    render(<Popup />);

    fireEvent.click(await screen.findByRole('button', { name: 'View all sites' }));

    expect(chromeGlobal.chrome.tabs.create).toHaveBeenCalledWith({ url: 'dashboard.html#/stats' });
  });
});
