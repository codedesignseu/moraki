import { CHUNK_SIZE, chunkedStorage, type SecureKeyValueStore } from './chunkedStorage';

/** An in-memory SecureStore that refuses values over 2048 bytes and keys it wouldn't accept. */
function fakeSecureStore() {
  const items = new Map<string, string>();
  const store: SecureKeyValueStore = {
    getItemAsync: async (key) => items.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (!/^[\w.-]+$/.test(key)) throw new Error(`invalid key ${key}`);
      if (new TextEncoder().encode(value).length > 2048) throw new Error('value too large');
      items.set(key, value);
    },
    deleteItemAsync: async (key) => {
      items.delete(key);
    },
  };
  return { store, items };
}

const KEY = 'sb-127-auth-token';

describe('chunkedStorage', () => {
  it('round-trips a value too large for one SecureStore item', async () => {
    const { store, items } = fakeSecureStore();
    const storage = chunkedStorage(store);
    const value = 'x'.repeat(5000);
    await storage.setItem(KEY, value);
    expect(await storage.getItem(KEY)).toBe(value);
    // 5000 characters: pieces of 1800, 1800 and 1400, plus the count.
    expect(items.get(KEY)).toBe('3');
    expect(items.get(`${KEY}.2`)).toHaveLength(5000 - 2 * CHUNK_SIZE);
  });

  it('keeps multi-byte text intact across piece boundaries', async () => {
    const { store } = fakeSecureStore();
    const storage = chunkedStorage(store);
    // Greek letters are two bytes each, the emoji four: 1800 characters would be far too big.
    const value = 'μωράκι 👶 '.repeat(400);
    await storage.setItem(KEY, value);
    expect(await storage.getItem(KEY)).toBe(value);
  });

  it('reads nothing before anything is stored', async () => {
    expect(await chunkedStorage(fakeSecureStore().store).getItem(KEY)).toBeNull();
  });

  it('leaves no stale pieces when a value shrinks', async () => {
    const { store, items } = fakeSecureStore();
    const storage = chunkedStorage(store);
    await storage.setItem(KEY, 'a'.repeat(4000));
    await storage.setItem(KEY, 'short');
    expect(await storage.getItem(KEY)).toBe('short');
    expect([...items.keys()].sort()).toEqual([KEY, `${KEY}.0`]);
  });

  it('removes every piece', async () => {
    const { store, items } = fakeSecureStore();
    const storage = chunkedStorage(store);
    await storage.setItem(KEY, 'a'.repeat(4000));
    await storage.removeItem(KEY);
    expect(items.size).toBe(0);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('reads a value with a missing piece, or a garbled count, as nothing', async () => {
    const { store, items } = fakeSecureStore();
    const storage = chunkedStorage(store);
    await storage.setItem(KEY, 'a'.repeat(4000));
    items.delete(`${KEY}.1`);
    expect(await storage.getItem(KEY)).toBeNull();
    items.set(KEY, 'two');
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('stores an empty value', async () => {
    const { store } = fakeSecureStore();
    const storage = chunkedStorage(store);
    await storage.setItem(KEY, '');
    expect(await storage.getItem(KEY)).toBe('');
  });
});
