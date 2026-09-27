// require, not import: same reason as expo-live-activity's plugin test —
// withHomeWidget.js is the plain CommonJS a config plugin has to be, and
// importing it typed would check this test against @expo/config-plugins'
// generic plugin signature rather than what the module actually exports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withHomeWidget = require('./withHomeWidget');

describe('withHomeWidget', () => {
  it('adds the App Group entitlement both the app and the widget extension need', () => {
    const result = withHomeWidget.addAppGroup({ 'com.apple.developer.something-else': true });
    expect(result).toEqual({
      'com.apple.developer.something-else': true,
      'com.apple.security.application-groups': [withHomeWidget.APP_GROUP],
    });
  });

  it('does not add the App Group twice on a second run', () => {
    const once = withHomeWidget.addAppGroup({});
    const twice = withHomeWidget.addAppGroup(once);
    expect(twice).toEqual(once);
  });

  it('keeps any App Group already entitled for another reason', () => {
    const result = withHomeWidget.addAppGroup({
      'com.apple.security.application-groups': ['group.something.else'],
    });
    expect(result['com.apple.security.application-groups']).toEqual([
      'group.something.else',
      withHomeWidget.APP_GROUP,
    ]);
  });

  it('registers an entitlements mod on the config, run-once tagged by name and version', () => {
    const config = withHomeWidget({ name: 'moraki', slug: 'moraki' });
    expect(typeof config.mods.ios.entitlements).toBe('function');
    expect(config._internal.pluginHistory['expo-home-widget']).toEqual(
      expect.objectContaining({ name: 'expo-home-widget' }),
    );
  });
});
