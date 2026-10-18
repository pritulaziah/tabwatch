import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDays } from '@/background/store';
import { App } from '@/dashboard/App';

// recharts gets no container size in jsdom and does not draw bars, so
// a stub replaces the module: containers render children, the rest is empty.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

vi.mock('@/background/store', () => {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const key = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const now = new Date();
  const today = key(now);
  const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return {
    getDays: vi.fn(async () => ({
      [today]: { '9': { 'youtube.com': 600, 'github.com': 300 } },
      [yesterday]: { '10': { 'github.com': 300 } },
    })),
    getLimits: vi.fn(async () => ({ 'youtube.com': 300 })),
    getSegment: vi.fn(async () => null),
    getSettings: vi.fn(async () => ({ theme: 'dark' })),
    setSettings: vi.fn(async () => undefined),
    setLimits: vi.fn(async () => undefined),
    getAllDays: vi.fn(async () => ({})),
    getDayKeys: vi.fn(async () => []),
    setDays: vi.fn(async () => undefined),
    removeDays: vi.fn(async () => undefined),
  };
});

/** The chrome stub from setup.ts plus an API it does not have: open tabs. */
const chromeGlobal = globalThis as unknown as {
  chrome: { tabs: { query: ReturnType<typeof vi.fn> } };
};

/**
 * English month abbreviations: the expected date chip is computed, not
 * hard-coded.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Card by label: the same values repeat in different screen blocks. */
function cardByLabel(label: string): HTMLElement {
  const card = screen.getByText(label).closest('[data-slot="card"]');
  if (card === null) {
    throw new Error(`card not found: ${label}`);
  }
  return card as HTMLElement;
}

describe('stats screen', () => {
  beforeEach(() => {
    window.location.hash = '#/stats';
    chromeGlobal.chrome.tabs = {
      query: vi.fn(async () => [
        { id: 42, windowId: 7, active: true, url: 'https://www.youtube.com/watch?v=1' },
      ]),
    };
  });

  it('stats_screen_renders_the_sidebar_and_the_heading', async () => {
    render(<App />);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Statistics' });
    expect(heading).toBeTruthy();

    const sidebar = screen.getByRole('complementary');
    const overview = within(sidebar).getByRole('button', { name: 'Overview' });
    expect(overview.getAttribute('aria-current')).toBe('page');
    expect(within(sidebar).getByRole('button', { name: 'Settings' })).toBeTruthy();

    const now = new Date();
    expect(screen.getByText(`${MONTHS[now.getMonth()]} ${now.getDate()}`)).toBeTruthy();

    const periods = screen.getByRole('group', { name: 'Period' });
    for (const label of ['Day', 'Week', 'Month', 'Year']) {
      expect(within(periods).getByRole('button', { name: label })).toBeTruthy();
    }
    const day = within(periods).getByRole('button', { name: 'Day' });
    expect(day.getAttribute('aria-pressed')).toBe('true');
  });

  it('stats_screen_renders_the_metric_cards', async () => {
    render(<App />);

    // The wait is based on a number from the data, not on the card label.
    await screen.findByText('+10m vs previous period');

    const total = cardByLabel('Total time');
    expect(within(total).getByText('15m')).toBeTruthy();
    expect(within(total).getByText('+10m vs previous period')).toBeTruthy();

    const avg = cardByLabel('Avg per day');
    expect(within(avg).getByText('15m')).toBeTruthy();

    const sites = cardByLabel('Sites visited');
    expect(within(sites).getByText('2')).toBeTruthy();
    expect(within(sites).getByText('1 new')).toBeTruthy();

    const days = cardByLabel('Days tracked');
    expect(within(days).getByText('1')).toBeTruthy();
  });

  it('stats_screen_keeps_the_today_panel_on_today_data', async () => {
    render(<App />);

    await screen.findByText('+10m vs previous period');

    const todayPanel = cardByLabel('Today');
    expect(within(todayPanel).getByText('youtube.com')).toBeTruthy();
    expect(within(todayPanel).getByText('10m')).toBeTruthy();
    expect(within(todayPanel).getByText('github.com')).toBeTruthy();
    expect(within(todayPanel).getByText('5m')).toBeTruthy();

    const overLimit = within(todayPanel).getByText('Over limit').parentElement;
    expect(overLimit).not.toBeNull();
    expect(within(overLimit!).getByText('1')).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Period' })).getByRole('button', { name: 'Week' }),
    );

    // The Today panel is always about the current day: after a period
    // change its numbers stay the same.
    expect(within(todayPanel).getByText('youtube.com')).toBeTruthy();
    expect(within(todayPanel).getByText('10m')).toBeTruthy();
    expect(within(todayPanel).getByText('github.com')).toBeTruthy();
    expect(within(todayPanel).getByText('5m')).toBeTruthy();
    expect(within(todayPanel).getByText('Over limit')).toBeTruthy();

    // The week starts on Monday: yesterday is in it on any day except Monday.
    const weekTotal = new Date().getDay() === 1 ? '15m' : '20m';
    expect(within(cardByLabel('Total time')).getByText(weekTotal)).toBeTruthy();
  });

  it('stats_screen_filters_the_table_by_domain', async () => {
    render(<App />);

    const table = await screen.findByRole('table');
    const input = screen.getByLabelText('Search domain');

    fireEvent.change(input, { target: { value: 'git' } });

    expect(within(table).queryByText('youtube.com')).toBeNull();
    expect(within(table).getByText('github.com')).toBeTruthy();
    // The search narrows only the table: the Today panel is not filtered.
    expect(within(cardByLabel('Today')).getByText('youtube.com')).toBeTruthy();

    fireEvent.click(screen.getByText('Reset'));

    expect(within(table).getByText('youtube.com')).toBeTruthy();
    expect(within(table).getByText('github.com')).toBeTruthy();
  });

  it('stats_screen_opens_limit_settings_from_a_row', async () => {
    render(<App />);

    const table = await screen.findByRole('table');
    const row = within(table).getByText('youtube.com').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(within(row!).getByRole('button'));

    expect(window.location.hash).toBe('#/settings?domain=youtube.com');
  });

  it('stats_screen_switches_the_chart_granularity', async () => {
    render(<App />);

    const group = await screen.findByRole('group', { name: 'Granularity' });
    const hour = within(group).getByRole('button', { name: 'Hour' });
    expect(hour.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(group).getByRole('button', { name: 'Day' }));

    expect(within(group).getByRole('button', { name: 'Day' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Hour' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('stats_screen_shows_favicons_only_from_open_tabs', async () => {
    render(<App />);

    const table = await screen.findByRole('table');
    const youtubeRow = within(table).getByText('youtube.com').closest('tr');
    expect(youtubeRow).not.toBeNull();
    const icon = youtubeRow!.querySelector('img');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('src')).toContain(
      encodeURIComponent('https://www.youtube.com/watch?v=1'),
    );

    const githubRow = within(table).getByText('github.com').closest('tr');
    expect(githubRow).not.toBeNull();
    expect(githubRow!.querySelector('img')).toBeNull();
  });

  it('stats_screen_shows_no_activity_when_the_period_is_empty', async () => {
    // Empty days are given once: the other cases see the shared fixture.
    vi.mocked(getDays).mockResolvedValueOnce({});

    render(<App />);

    // The cards and the Today panel stay: the empty period replaces
    // only the lower block.
    expect(await screen.findByText('Total time')).toBeTruthy();
    expect(await screen.findByText('No activity yet')).toBeTruthy();
    expect(screen.queryByText('Top sites')).toBeNull();
  });

  it('stats_screen_opens_settings_from_the_sidebar', () => {
    render(<App />);

    const sidebar = screen.getByRole('complementary');
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Settings' }));

    expect(window.location.hash).toBe('#/settings');
  });
});
