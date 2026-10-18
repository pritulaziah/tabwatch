import { useState } from 'react';

import { cn } from 'cn';

import { faviconUrl, tileColor } from '@/ui/display';

/**
 * Site icon: the favicon from the Chrome cache. At a load error, a tile
 * with the first letter of the domain and the color from the hash. The
 * class sets the size, 20 px by default. The page address goes to the
 * icon cache if it is known. Chrome gives an icon only for the address
 * that it has seen, so the tile is drawn at once without an address.
 */
export function SiteIcon({
  domain,
  pageUrl,
  className,
}: {
  domain: string;
  pageUrl?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (pageUrl === undefined || pageUrl === '' || failed) {
    return (
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold text-white',
          className,
        )}
        style={{ backgroundColor: tileColor(domain) }}
        aria-hidden="true"
      >
        {domain.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={faviconUrl(pageUrl, (path) => chrome.runtime.getURL(path))}
      alt=""
      className={cn('size-5 shrink-0 rounded-sm', className)}
      onError={() => setFailed(true)}
    />
  );
}
