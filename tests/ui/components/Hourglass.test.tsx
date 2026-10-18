import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Hourglass } from '@/ui/components/Hourglass';

/** 2D context stub: jsdom does not draw, so the stub only records calls. */
function stubContext(): string[] {
  const calls: string[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (typeof key !== 'string') {
          return undefined;
        }
        return () => {
          calls.push(key);
        };
      },
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return calls;
}

describe('hourglass', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hourglass_draws_the_glass_and_the_sand_on_a_canvas', () => {
    const calls = stubContext();
    const { container } = render(<Hourglass running />);

    expect(container.querySelector('canvas')).not.toBeNull();
    // The sand fills the flask and the silhouette is stroked.
    // The canvas draws without assets.
    expect(calls).toContain('clip');
    expect(calls).toContain('fillRect');
    expect(calls).toContain('stroke');
  });

  it('hourglass_stays_a_canvas_when_the_context_is_missing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = render(<Hourglass running={false} />);

    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('hourglass_restarts_the_animation_when_tracking_comes_back', () => {
    stubContext();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const { rerender } = render(<Hourglass running />);

    expect(frames).toHaveBeenCalled();

    // Tracking stops: the cleanup of the effect ends the frame loop.
    frames.mockClear();
    rerender(<Hourglass running={false} />);

    expect(frames).not.toHaveBeenCalled();

    // Tracking comes back: the sand falls again.
    rerender(<Hourglass running />);

    expect(frames).toHaveBeenCalled();
  });
});
