import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DailyTotal, HourlyTotal } from '@/shared/period';
import { ActivityChart } from '@/ui/components/ActivityChart';

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

/** 24 zero hour buckets: a series without activity. */
const ZERO_HOURLY: HourlyTotal[] = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  seconds: 0,
  perDomain: new Map<string, number>(),
}));

/** One zero day: a series without activity. */
const ZERO_DAILY: DailyTotal[] = [{ day: '2026-10-16', seconds: 0, perDomain: new Map() }];

/** One non-empty hour bucket: the chart renders, the switcher works. */
const FILLED_HOURLY: HourlyTotal[] = [
  { hour: 9, seconds: 600, perDomain: new Map([['youtube.com', 600]]) },
];

describe('activity chart', () => {
  it('activity_chart_shows_no_activity_when_every_bucket_is_zero', () => {
    render(
      <ActivityChart
        granularity="hour"
        daily={ZERO_DAILY}
        hourly={ZERO_HOURLY}
        topDomains={[]}
        onGranularityChange={() => undefined}
      />,
    );

    expect(screen.getByText('No activity yet')).toBeTruthy();
    // The switcher stays in place even with a zero series.
    expect(screen.getByRole('group', { name: 'Granularity' })).toBeTruthy();
  });

  it('activity_chart_switches_granularity', () => {
    const onGranularityChange = vi.fn();

    render(
      <ActivityChart
        granularity="hour"
        daily={ZERO_DAILY}
        hourly={FILLED_HOURLY}
        topDomains={['youtube.com']}
        onGranularityChange={onGranularityChange}
      />,
    );

    const group = screen.getByRole('group', { name: 'Granularity' });
    const hour = within(group).getByRole('button', { name: 'Hour' });
    expect(hour.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(group).getByRole('button', { name: 'Day' }));

    expect(onGranularityChange).toHaveBeenCalledWith('day');
  });
});
