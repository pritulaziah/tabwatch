import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricCards } from '@/ui/components/MetricCards';

describe('metric cards', () => {
  it('metric_cards_show_the_values', () => {
    render(
      <MetricCards
        total={900}
        previousTotal={0}
        avgPerDay={300}
        sites={3}
        newSites={0}
        daysTracked={3}
      />,
    );

    expect(screen.getByText('Total time')).toBeTruthy();
    expect(screen.getByText('15m')).toBeTruthy();
    expect(screen.getByText('Avg per day')).toBeTruthy();
    expect(screen.getByText('5m')).toBeTruthy();
    expect(screen.getByText('Sites visited')).toBeTruthy();
    expect(screen.getByText('Days tracked')).toBeTruthy();
    // Both counters are three: "Sites visited" and "Days tracked".
    expect(screen.getAllByText('3')).toHaveLength(2);
  });

  it('metric_cards_show_the_comparison_with_the_previous_period', () => {
    const { unmount } = render(
      <MetricCards
        total={900}
        previousTotal={300}
        avgPerDay={300}
        sites={3}
        newSites={0}
        daysTracked={3}
      />,
    );

    expect(screen.getByText('+10m vs previous period')).toBeTruthy();
    unmount();

    render(
      <MetricCards
        total={300}
        previousTotal={900}
        avgPerDay={300}
        sites={3}
        newSites={0}
        daysTracked={3}
      />,
    );

    expect(screen.getByText('-10m vs previous period')).toBeTruthy();
  });

  it('metric_cards_show_the_new_sites_count', () => {
    render(
      <MetricCards
        total={900}
        previousTotal={900}
        avgPerDay={300}
        sites={3}
        newSites={2}
        daysTracked={3}
      />,
    );

    expect(screen.getByText('2 new')).toBeTruthy();
  });
});
