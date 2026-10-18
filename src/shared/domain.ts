import { getDomain } from 'tldts';

/**
 * Returns the second-level domain for an http(s) URL. Returns null for other
 * schemes, strings that do not parse, and addresses without a registrable
 * domain.
 */
export function domainFromUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  return getDomain(parsed.hostname, { allowPrivateDomains: true });
}
