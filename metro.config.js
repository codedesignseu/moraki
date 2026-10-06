// https://docs.expo.dev/guides/customizing-metro/
// Sentry's wrapper around Expo's default config adds debug IDs to the bundle,
// so a crash's stack trace can be matched to the uploaded source map (P4-F4).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Drizzle migrations are bundled as .sql files (src/db/migrations).
config.resolver.sourceExts.push('sql');

module.exports = config;
