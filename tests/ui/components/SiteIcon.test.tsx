import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteIcon } from '@/ui/components/SiteIcon';

describe('site icon', () => {
  it('site_icon_shows_the_favicon_for_a_known_page_url', () => {
    const { container } = render(
      <SiteIcon domain="youtube.com" pageUrl="https://www.youtube.com/watch?v=1" />,
    );

    // The page URL goes into the icon cache in full and encoded.
    const icon = container.querySelector('img');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('src')).toContain(
      encodeURIComponent('https://www.youtube.com/watch?v=1'),
    );
    expect(icon?.getAttribute('src')).toContain('size=32');
  });

  it('site_icon_shows_the_letter_tile_without_a_page_url', () => {
    const { container } = render(<SiteIcon domain="youtube.com" />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Y')).toBeTruthy();
  });
});
