import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValueStore } from './chunkedStorage';

type NativeStore = {
  getItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
};

/**
 * Where the session lives now: its own keychain service, readable after the
 * first unlock, and never in a backup or moved to a new phone (`THIS_DEVICE_ONLY`).
 * A restored or migrated phone signs in again; the session token stays here.
 */
export const THIS_DEVICE_ONLY: SecureStore.SecureStoreOptions = {
  keychainService: 'moraki.session',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * The session storage, kept on this device only.
 *
 * Items written by earlier versions sit in the default service with the
 * default accessibility, which a backup includes. Re-setting them in place
 * would not help: expo-secure-store updates an existing item's value and
 * keeps its old accessibility. So the new items live under their own service.
 * An old item is moved the first time it is read: written under the new
 * service first, deleted from the old one after, so a crash in between loses
 * nothing. Every write and delete also clears the old copy, so none is left.
 */
export function thisDeviceOnly(native: NativeStore): SecureKeyValueStore {
  return {
    async getItemAsync(key) {
      const value = await native.getItemAsync(key, THIS_DEVICE_ONLY);
      if (value !== null) return value;
      const legacy = await native.getItemAsync(key);
      if (legacy === null) return null;
      await native.setItemAsync(key, legacy, THIS_DEVICE_ONLY);
      await native.deleteItemAsync(key);
      return legacy;
    },

    async setItemAsync(key, value) {
      await native.setItemAsync(key, value, THIS_DEVICE_ONLY);
      await native.deleteItemAsync(key);
    },

    async deleteItemAsync(key) {
      await native.deleteItemAsync(key, THIS_DEVICE_ONLY);
      await native.deleteItemAsync(key);
    },
  };
}

/** The device keychain (iOS) or keystore-backed storage (Android). */
export const sessionStore: SecureKeyValueStore = thisDeviceOnly(SecureStore);
