// require, not import: withLiveActivity.js is the plain CommonJS a config
// plugin has to be (Expo loads it outside Metro/babel, see app.plugin.js),
// and importing it typed would type-check this test against
// @expo/config-plugins' generic plugin signature rather than what the
// module actually exports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withLiveActivity = require('./withLiveActivity');

describe('withLiveActivity', () => {
  it('sets the Info.plist flag ActivityKit requires, keeping the rest of the plist', () => {
    const result = withLiveActivity.setNSSupportsLiveActivities({ CFBundleName: 'Moraki' });
    expect(result).toEqual({ CFBundleName: 'Moraki', NSSupportsLiveActivities: true });
  });

  it('registers an iOS Info.plist mod on the config, run-once tagged by name and version', () => {
    const config = withLiveActivity({ name: 'moraki', slug: 'moraki' });
    expect(typeof config.mods.ios.infoPlist).toBe('function');
    expect(config._internal.pluginHistory['expo-live-activity']).toEqual(
      expect.objectContaining({ name: 'expo-live-activity' }),
    );
  });
});
