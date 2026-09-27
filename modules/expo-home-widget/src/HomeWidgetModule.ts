import { requireNativeModule } from 'expo-modules-core';

import type { HomeWidgetModule } from './HomeWidget.types';

// Unverified: requireNativeModule throws if the native side ('HomeWidget',
// matching expo-module.config.json) was never linked and built, which is
// true of every build so far (README.md). Not wrapped in a try/catch here,
// same reasoning as expo-live-activity's own module wrapper: an honest
// crash on first real use beats silently pretending the module is there.
export default requireNativeModule<HomeWidgetModule>('HomeWidget');
