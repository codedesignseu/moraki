import { readFileSync } from 'node:fs';

import { CODE_LENGTH, inviteLink } from './invites';

/**
 * P2-F6: an invite link only opens the app if three things agree — the link the
 * app builds, what `app.json` claims, and what the domain serves. Nothing at
 * runtime checks that, and a mismatch fails silently: the link opens a browser
 * and nobody finds out until a caregiver cannot join.
 *
 * Both platforms are covered here, from the same link, so neither can drift
 * without the suite noticing.
 */

type IntentFilter = {
  action: string;
  autoVerify?: boolean;
  category?: string[];
  data?: { scheme?: string; host?: string; pathPrefix?: string }[];
};

const appConfig = JSON.parse(readFileSync('app.json', 'utf8')) as {
  expo: {
    ios: { bundleIdentifier: string; associatedDomains?: string[] };
    android: { package: string; intentFilters?: IntentFilter[] };
  };
};

const aasa = JSON.parse(readFileSync('public/.well-known/apple-app-site-association', 'utf8')) as {
  applinks: {
    apps: unknown[];
    details: { appIDs: string[]; components: { '/': string }[] }[];
  };
};

const assetLinks = JSON.parse(readFileSync('public/.well-known/assetlinks.json', 'utf8')) as {
  relation: string[];
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
}[];

const link = new URL(inviteLink('A'.repeat(CODE_LENGTH)));
const detail = aasa.applinks.details[0]!;
const statement = assetLinks[0]!;
const filter = (appConfig.expo.android.intentFilters ?? []).find((entry) =>
  entry.data?.some((data) => data.host === link.host),
);

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

describe('the same link on Android', () => {
  it('is claimed by an intent filter for this host and path', () => {
    expect(filter).toBeDefined();
    expect(filter?.action).toBe('VIEW');
    expect(filter?.category).toEqual(expect.arrayContaining(['BROWSABLE', 'DEFAULT']));
    const data = filter?.data?.find((entry) => entry.host === link.host);
    expect(data?.scheme).toBe('https');
    expect(link.pathname.startsWith(data?.pathPrefix ?? '\u0000')).toBe(true);
  });

  it('is verified at install time, not left as a chooser', () => {
    // Without autoVerify, Android never fetches assetlinks.json and the link
    // only ever offers "open with", which is not what an invite should do.
    expect(filter?.autoVerify).toBe(true);
  });

  it('is granted by the hosted statement, for this package', () => {
    expect(statement.relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(statement.target.namespace).toBe('android_app');
    expect(statement.target.package_name).toBe(appConfig.expo.android.package);
  });

  it('lists every signing certificate as 32 hex pairs', () => {
    expect(statement.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    for (const fingerprint of statement.target.sha256_cert_fingerprints) {
      // SHA-256, upper case, colon separated — how both Google and EAS print it.
      // A SHA-1 fingerprint is 20 pairs and would be silently useless here.
      expect(fingerprint.split(':')).toHaveLength(32);
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });
});
