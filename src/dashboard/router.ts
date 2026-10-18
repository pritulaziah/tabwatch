/** Screen of the page that the hash selects. */
export type Route = { screen: 'stats' } | { screen: 'settings'; domain: string | null };

/** Hash route of the statistics screen. */
export function statsHash(): string {
  return '#/stats';
}

/**
 * Hash route of the settings screen. Without a domain it opens the
 * common screen. With a domain it opens the limit form of that domain.
 */
export function settingsHash(domain?: string): string {
  if (domain === undefined) {
    return '#/settings';
  }
  return `#/settings?${new URLSearchParams({ domain }).toString()}`;
}

/**
 * Parses the page hash: `#/settings` with parameters after `?`. The domain
 * comes from the `domain` parameter. An empty, absent, or unreadable
 * parameter gives `null`. A domain with a percent-encoding remainder or a
 * replacement character is unreadable. A real domain does not contain them.
 * Any unknown or incomplete hash opens statistics.
 */
export function parseHash(hash: string): Route {
  const stats: Route = { screen: 'stats' };
  if (!hash.startsWith('#/')) {
    return stats;
  }

  const rest = hash.slice(2);
  const queryStart = rest.indexOf('?');
  const screen = queryStart === -1 ? rest : rest.slice(0, queryStart);
  if (screen !== 'settings') {
    return stats;
  }

  const query = queryStart === -1 ? '' : rest.slice(queryStart + 1);
  const domain = new URLSearchParams(query).get('domain');
  if (domain === null || domain === '' || domain.includes('%') || domain.includes('\uFFFD')) {
    return { screen: 'settings', domain: null };
  }
  return { screen: 'settings', domain };
}
