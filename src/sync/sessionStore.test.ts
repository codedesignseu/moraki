import { THIS_DEVICE_ONLY, thisDeviceOnly } from './sessionStore';

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after-first-unlock-this-device-only',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

type Options = { keychainService?: string; keychainAccessible?: unknown };

/**
 * A keychain the way expo-secure-store treats it on iOS: an item is found by
 * service and key, and setting an existing item keeps its accessibility.
 */
function fakeKeychain() {
  const items = new Map<string, { value: string; accessible: unknown }>();
  const id = (key: string, options?: Options) => `${options?.keychainService ?? 'app'}/${key}`;
  return {
    items,
    native: {
      getItemAsync: jest.fn(async (key: string, options?: Options) => {
        return items.get(id(key, options))?.value ?? null;
      }),
      setItemAsync: jest.fn(async (key: string, value: string, options?: Options) => {
        const existing = items.get(id(key, options));
        items.set(id(key, options), {
          value,
          accessible: existing ? existing.accessible : (options?.keychainAccessible ?? 'default'),
        });
      }),
      deleteItemAsync: jest.fn(async (key: string, options?: Options) => {
        items.delete(id(key, options));
      }),
    },
  };
}

describe('the session store', () => {
  it('keeps the session on this device only, out of backups', async () => {
    const { items, native } = fakeKeychain();
    await thisDeviceOnly(native).setItemAsync('moraki.auth', '2');

    expect(THIS_DEVICE_ONLY.keychainAccessible).toBe('after-first-unlock-this-device-only');
    expect([...items.entries()]).toEqual([
      [
        'moraki.session/moraki.auth',
        { value: '2', accessible: 'after-first-unlock-this-device-only' },
      ],
    ]);
  });

  it('reads a session an earlier version wrote, and moves it on the way', async () => {
    const { items, native } = fakeKeychain();
    // Written before this change: default service, default accessibility.
    await native.setItemAsync('moraki.auth.0', '{"access_token":"t"}');

    const store = thisDeviceOnly(native);
    expect(await store.getItemAsync('moraki.auth.0')).toBe('{"access_token":"t"}');

    expect([...items.entries()]).toEqual([
      [
        'moraki.session/moraki.auth.0',
        { value: '{"access_token":"t"}', accessible: 'after-first-unlock-this-device-only' },
      ],
    ]);
    // Read again, it comes from the new place.
    expect(await store.getItemAsync('moraki.auth.0')).toBe('{"access_token":"t"}');
  });

  it('writes the new copy before deleting the old one, so a crash loses nothing', async () => {
    const { native } = fakeKeychain();
    await native.setItemAsync('moraki.auth', '1');
    const order: string[] = [];
    native.setItemAsync.mockImplementationOnce(async () => {
      order.push('set');
    });
    native.deleteItemAsync.mockImplementationOnce(async () => {
      order.push('delete');
    });

    await thisDeviceOnly(native).getItemAsync('moraki.auth');
    expect(order).toEqual(['set', 'delete']);
  });

  it('leaves no old copy behind when a key is written or deleted', async () => {
    const { items, native } = fakeKeychain();
    await native.setItemAsync('moraki.auth.1', 'old piece');
    await native.setItemAsync('moraki.auth.2', 'stale piece');
    const store = thisDeviceOnly(native);

    await store.setItemAsync('moraki.auth.1', 'new piece');
    await store.deleteItemAsync('moraki.auth.2');

    expect([...items.keys()]).toEqual(['moraki.session/moraki.auth.1']);
    expect(await store.getItemAsync('moraki.auth.1')).toBe('new piece');
  });

  it('has nothing when nothing was ever stored', async () => {
    const { native } = fakeKeychain();
    expect(await thisDeviceOnly(native).getItemAsync('moraki.auth')).toBeNull();
  });
});
