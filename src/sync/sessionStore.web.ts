// WEB PREVIEW ONLY (P1-F7). expo-secure-store has no browser implementation,
// so the web preview keeps the session in localStorage. Metro picks this file
// for web bundles only; device builds use SecureStore (sessionStore.ts).
import type { SecureKeyValueStore } from './chunkedStorage';

export const sessionStore: SecureKeyValueStore = {
  getItemAsync: async (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItemAsync: async (key, value) => globalThis.localStorage?.setItem(key, value),
  deleteItemAsync: async (key) => globalThis.localStorage?.removeItem(key),
};
