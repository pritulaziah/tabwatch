import { useEffect, useState } from 'react';

import { domainFromUrl } from '@/shared/domain';

/**
 * URL of the open tabs by domain: the site icon is built only from a
 * known address. It is read once at mount. A request error gives an empty
 * map, and then the tiles with the domain letter are drawn.
 */
export function useTabUrls(): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let disposed = false;

    const read = async (): Promise<void> => {
      try {
        const tabs = await chrome.tabs.query({});
        if (disposed) {
          return;
        }
        const byDomain = new Map<string, string>();
        for (const tab of tabs) {
          const url = tab.url;
          if (typeof url !== 'string' || url === '') {
            continue;
          }
          const domain = domainFromUrl(url);
          // The first tab of a domain sets the address. Chrome does not
          // always give an icon for one domain.
          if (domain !== null && !byDomain.has(domain)) {
            byDomain.set(domain, url);
          }
        }
        setUrls(byDomain);
      } catch (error) {
        if (disposed) {
          return;
        }
        console.error('[tabwatch] failed to read open tabs', error);
        setUrls(new Map());
      }
    };

    void read();

    return () => {
      disposed = true;
    };
  }, []);

  return urls;
}
