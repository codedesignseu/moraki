/** The part of expo-secure-store the session storage uses; injected so tests can fake it. */
export type SecureKeyValueStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/**
 * Most UTF-8 bytes per stored piece. SecureStore has warned that values over
 * 2048 bytes may be refused, and a Supabase session (two tokens and the user)
 * often passes that, so each piece stays well under it.
 */
export const CHUNK_SIZE = 1800;

/** Splits text into pieces of at most CHUNK_SIZE UTF-8 bytes, never inside a character. */
function split(value: string): string[] {
  const pieces: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of value) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > CHUNK_SIZE) {
      pieces.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  pieces.push(current);
  return pieces;
}

/**
 * Supabase auth storage kept entirely in SecureStore (SDD 8). A value is
 * split into pieces `key.0`, `key.1`, …; `key` itself holds the piece count.
 * A missing piece, or a count that isn't a number, reads as no value: the
 * user is signed out rather than handed a broken session.
 */
export function chunkedStorage(store: SecureKeyValueStore) {
  const piece = (key: string, i: number) => `${key}.${i}`;

  async function count(key: string): Promise<number> {
    const raw = await store.getItemAsync(key);
    const n = raw === null ? 0 : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const n = await count(key);
      if (n === 0) return null;
      const pieces = await Promise.all(
        Array.from({ length: n }, (_, i) => store.getItemAsync(piece(key, i))),
      );
      return pieces.some((p) => p === null) ? null : pieces.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      const before = await count(key);
      const pieces = split(value);
      for (const [i, p] of pieces.entries()) await store.setItemAsync(piece(key, i), p);
      await store.setItemAsync(key, String(pieces.length));
      // A shorter value leaves no stale pieces behind.
      for (let i = pieces.length; i < before; i += 1) await store.deleteItemAsync(piece(key, i));
    },

    async removeItem(key: string): Promise<void> {
      const n = await count(key);
      await store.deleteItemAsync(key);
      for (let i = 0; i < n; i += 1) await store.deleteItemAsync(piece(key, i));
    },
  };
}
