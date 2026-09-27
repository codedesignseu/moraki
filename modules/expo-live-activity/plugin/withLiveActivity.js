const { withInfoPlist, createRunOncePlugin } = require('@expo/config-plugins');

const pkg = require('../package.json');

/**
 * The one piece of this module that actually runs today (see the module
 * README): `NSSupportsLiveActivities` is Apple's own required Info.plist
 * flag for any app that starts a Live Activity, widget extension or not
 * (https://developer.apple.com/documentation/activitykit). Everything else
 * a Live Activity needs — the widget extension target itself — has to be
 * added in Xcode; a config plugin can rewrite Info.plist, entitlements and
 * the pbxproj's existing targets, but it can't safely fabricate a whole new
 * target blind, with no way to open the project and check.
 *
 * Exported separately from the plugin itself (below) so the mutation can be
 * tested directly against a plain object, without needing the rest of
 * Expo's mod-compilation pipeline and a real prebuilt iOS project on disk —
 * see withLiveActivity.test.js.
 */
function setNSSupportsLiveActivities(infoPlist) {
  return { ...infoPlist, NSSupportsLiveActivities: true };
}

function withLiveActivity(config) {
  return withInfoPlist(config, (config) => {
    config.modResults = setNSSupportsLiveActivities(config.modResults);
    return config;
  });
}

module.exports = createRunOncePlugin(withLiveActivity, pkg.name, pkg.version);
module.exports.setNSSupportsLiveActivities = setNSSupportsLiveActivities;
