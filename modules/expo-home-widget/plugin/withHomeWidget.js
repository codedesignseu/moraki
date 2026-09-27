const { withEntitlementsPlist, createRunOncePlugin } = require('@expo/config-plugins');

const pkg = require('../package.json');

/**
 * The App Group id both the host app and the widget extension have to be
 * entitled with — it's how they share the small store of data
 * HomeWidgetModule writes into and the widget's TimelineProvider reads
 * from. A group id is a name the developer picks and registers in the
 * Apple Developer account's App Groups capability, not a credential Apple
 * issues, so this is a real value, not a placeholder standing in for one
 * (CLAUDE.md's secrets rule doesn't apply to it).
 */
const APP_GROUP = 'group.eu.codedesigns.moraki';

/**
 * The one piece of this module that actually runs today (see the module
 * README): the App Group entitlement itself. Adding the Widget Extension
 * target that would actually use it needs Xcode, same limitation as
 * P5-01's Live Activity.
 */
function addAppGroup(entitlements) {
  const existing = Array.isArray(entitlements['com.apple.security.application-groups'])
    ? entitlements['com.apple.security.application-groups']
    : [];
  return {
    ...entitlements,
    'com.apple.security.application-groups': existing.includes(APP_GROUP)
      ? existing
      : [...existing, APP_GROUP],
  };
}

function withHomeWidget(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults = addAppGroup(config.modResults);
    return config;
  });
}

module.exports = createRunOncePlugin(withHomeWidget, pkg.name, pkg.version);
module.exports.addAppGroup = addAppGroup;
module.exports.APP_GROUP = APP_GROUP;
