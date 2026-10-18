import { describe, expect, it } from 'vitest';

import { domainFromUrl } from '@/shared/domain';

describe('domainFromUrl', () => {
  it('domainFromUrl_maps_www_and_subdomains_to_registrable_domain', () => {
    expect(domainFromUrl('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(domainFromUrl('https://mail.google.com/')).toBe('google.com');
    expect(domainFromUrl('https://docs.google.com/')).toBe('google.com');
  });

  it('domainFromUrl_keeps_private_suffixes_separate', () => {
    expect(domainFromUrl('https://user.github.io/page')).toBe('user.github.io');
  });

  it('domainFromUrl_drops_port_path_and_query', () => {
    expect(domainFromUrl('http://example.com:8080/a/b?x=1#h')).toBe('example.com');
  });

  it('domainFromUrl_punycodes_idn', () => {
    expect(domainFromUrl('https://bücher.de/katalog')).toBe('xn--bcher-kva.de');
    expect(domainFromUrl('https://xn--bcher-kva.de/katalog')).toBe('xn--bcher-kva.de');
  });

  it('domainFromUrl_returns_null_for_non_http_schemes', () => {
    expect(domainFromUrl('chrome://extensions')).toBeNull();
    expect(domainFromUrl('file:///C:/x.html')).toBeNull();
    expect(domainFromUrl('about:blank')).toBeNull();
    expect(domainFromUrl('chrome-extension://abc/page.html')).toBeNull();
    expect(domainFromUrl('ftp://example.com/file')).toBeNull();
  });

  it('domainFromUrl_returns_null_for_garbage', () => {
    expect(domainFromUrl('')).toBeNull();
    expect(domainFromUrl('not a url')).toBeNull();
    expect(domainFromUrl(undefined)).toBeNull();
    expect(domainFromUrl('https://')).toBeNull();
  });

  it('domainFromUrl_returns_null_without_registrable_domain', () => {
    expect(domainFromUrl('http://localhost:3000/')).toBeNull();
  });
});
