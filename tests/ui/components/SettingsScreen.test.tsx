import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/dashboard/App';

vi.mock('@/background/store', () => ({
  getDays: vi.fn(async () => ({})),
  getLimits: vi.fn(async () => ({})),
  getSegment: vi.fn(async () => null),
  getSettings: vi.fn(async () => ({ theme: 'dark' })),
  setSettings: vi.fn(async () => undefined),
  setLimits: vi.fn(async () => undefined),
  getAllDays: vi.fn(async () => ({})),
  getDayKeys: vi.fn(async () => []),
  setDays: vi.fn(async () => undefined),
  removeDays: vi.fn(async () => undefined),
}));

describe('settings screen', () => {
  beforeEach(() => {
    window.location.hash = '#/settings';
  });

  // The app has no pause. The settings screen shows only the theme,
  // limits, and data.
  it('settings_screen_has_no_pause_control', async () => {
    render(<App />);

    expect(await screen.findByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Limits')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.queryByText('Tracking')).toBeNull();
    expect(screen.queryByText('Pause tracking')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
