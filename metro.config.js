// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are bundled as .sql files (src/db/migrations).
config.resolver.sourceExts.push('sql');

module.exports = config;
