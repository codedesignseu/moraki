import { requireNativeModule } from 'expo-modules-core';

import type { LiveActivityModule } from './LiveActivity.types';

// Unverified: requireNativeModule throws if the native side ('LiveActivity',
// matching expo-module.config.json) was never linked and built, which is
// true of every build so far (README.md). Not wrapped in a try/catch here —
// a module that silently pretends to be there when it isn't would be worse
// than an honest crash the first time something actually calls it.
export default requireNativeModule<LiveActivityModule>('LiveActivity');
