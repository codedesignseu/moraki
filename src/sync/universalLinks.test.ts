import { readFileSync } from 'node:fs';

import { CODE_LENGTH, inviteLink } from './invites';

/**
 * P2-F6: an invite link only opens the app if three things agree — the link the
 * app builds, what `app.json` claims, and what the domain serves. Nothing at
 * runtime checks that, and a mismatch fails silently: the link opens a browser
 * and nobody finds out until a caregiver cannot join.
 *
 * Android's half (`assetlinks.json`) needs the signing certificate's SHA-256
 * fingerprint and lands with it.
 */

const appConfig = JSON.parse(readFileSync('app.json', 'utf8')) as {
  expo: {
    ios: { bundleIdentifier: string; associatedDomains?: string[] };
    android: { package: string };
  };
};

const aasa = JSON.parse(readFileSync('public/.well-known/apple-app-site-association', 'utf8')) as {
  applinks: {
    apps: unknown[];
    details: { appIDs: string[]; components: { '/': string }[] }[];
  };
};

const link = new URL(inviteLink('A'.repeat(CODE_LENGTH)));
const detail = aasa.applinks.details[0]!;

describe('the invite link', () => {
  it('points at the domain iOS is told to claim', () => {
    expect(appConfig.expo.ios.associatedDomains).toContain(`applinks:${link.host}`);
  });

  it('never ships Apple developer mode, which bypasses their CDN', () => {
    for (const domain of appConfig.expo.ios.associatedDomains ?? []) {
      expect(domain).not.toContain('mode=developer');
    }
  });

  it('is covered by a path the hosted file claims', () => {
    const patterns = detail.components.map((component) => component['/']);
    const matches = patterns.some((pattern) => {
      const expanded = new RegExp(
        `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
      );
      return expanded.test(link.pathname);
    });
    expect({ path: link.pathname, patterns, matches }).toEqual({
      path: link.pathname,
      patterns,
      matches: true,
    });
  });

  it('claims this build, with a team id and this bundle id', () => {
    expect(detail.appIDs).toHaveLength(1);
    const [teamId, ...bundle] = detail.appIDs[0]!.split('.');
    expect(teamId).toMatch(/^[A-Z0-9]{10}$/);
    expect(bundle.join('.')).toBe(appConfig.expo.ios.bundleIdentifier);
  });

  it('keeps the empty legacy `apps` key Apple still expects', () => {
    expect(aasa.applinks.apps).toEqual([]);
  });
});
