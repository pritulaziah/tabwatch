import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TodayPanel } from '@/ui/components/TodayPanel';

/** Six top rows: the panel shows only the first five. */
const ROWS = [
  { domain: 'a.com', seconds: 600 },
  { domain: 'b.com', seconds: 500 },
  { domain: 'c.com', seconds: 400 },
  { domain: 'd.com', seconds: 300 },
  { domain: 'e.com', seconds: 200 },
  { domain: 'f.com', seconds: 100 },
];

describe('today panel', () => {
  it('today_panel_shows_the_top_five_sites', () => {
    render(
      <TodayPanel rows={ROWS} overLimit={0} pageUrls={new Map()} onOpenLimit={() => undefined} />,
    );

    for (const domain of ['a.com', 'b.com', 'c.com', 'd.com', 'e.com']) {
      expect(screen.getByText(domain)).toBeTruthy();
    }
    expect(screen.queryByText('f.com')).toBeNull();
  });

  it('today_panel_shows_the_over_limit_count', () => {
    render(
      <TodayPanel rows={ROWS} overLimit={2} pageUrls={new Map()} onOpenLimit={() => undefined} />,
    );

    const line = screen.getByText('Over limit').parentElement;
    expect(line).not.toBeNull();
    expect(within(line!).getByText('2')).toBeTruthy();
  });

  it('today_panel_opens_limit_settings_from_a_row', () => {
    const onOpenLimit = vi.fn();

    render(<TodayPanel rows={ROWS} overLimit={0} pageUrls={new Map()} onOpenLimit={onOpenLimit} />);

    fireEvent.click(screen.getByText('a.com'));

    expect(onOpenLimit).toHaveBeenCalledWith('a.com');
  });
});
