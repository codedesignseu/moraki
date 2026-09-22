import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValueStore } from './chunkedStorage';

/** The device keychain (iOS) or keystore-backed storage (Android). */
export const sessionStore: SecureKeyValueStore = SecureStore;
