import { describe, expect, it } from 'vitest';

import { parseHash, settingsHash, statsHash } from '@/dashboard/router';

describe('router', () => {
  it('parseHash_unknown_hash_opens_stats', () => {
    for (const hash of ['', '#', '#/', '#/nope', '#stats']) {
      expect(parseHash(hash)).toEqual({ screen: 'stats' });
    }
  });

  it('parseHash_stats_hash_opens_stats', () => {
    expect(parseHash('#/stats')).toEqual({ screen: 'stats' });
  });

  it('parseHash_settings_hash_opens_settings', () => {
    expect(parseHash('#/settings')).toEqual({ screen: 'settings', domain: null });
  });

  it('parseHash_reads_the_domain_from_the_query', () => {
    expect(parseHash('#/settings?domain=youtube.com')).toEqual({
      screen: 'settings',
      domain: 'youtube.com',
    });
    expect(parseHash('#/settings?domain=')).toEqual({ screen: 'settings', domain: null });
    expect(parseHash('#/settings?other=1')).toEqual({ screen: 'settings', domain: null });
    expect(parseHash('#/settings?domain=youtube%2Ecom')).toEqual({
      screen: 'settings',
      domain: 'youtube.com',
    });
  });

  it('parseHash_rejects_a_malformed_percent_escape', () => {
    expect(parseHash('#/settings?domain=%E0%A4%A')).toEqual({ screen: 'settings', domain: null });
    expect(parseHash('#/settings?domain=bad%25domain.com')).toEqual({
      screen: 'settings',
      domain: null,
    });
    expect(parseHash('#/settings?domain=youtube%2Ecom')).toEqual({
      screen: 'settings',
      domain: 'youtube.com',
    });
  });

  it('statsHash_builds_the_stats_route', () => {
    expect(statsHash()).toBe('#/stats');
  });

  it('settingsHash_builds_the_settings_route', () => {
    expect(settingsHash()).toBe('#/settings');
    expect(settingsHash('youtube.com')).toBe('#/settings?domain=youtube.com');
    expect(settingsHash('a&b.com')).toBe('#/settings?domain=a%26b.com');
  });
});
