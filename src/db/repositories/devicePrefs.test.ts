import { eq } from 'drizzle-orm';

import { readIdentity } from '../identity';
import { meta, outbox } from '../schema';
import { createMemoryDb } from '../testing/memoryDb';
import { createDevicePrefsRepository } from './devicePrefs';

describe('device prefs repository', () => {
  it('reads the default before anything is stored', async () => {
    const { db } = await createMemoryDb();
    expect(createDevicePrefsRepository(db).get('nightMode')).toBe('auto');
  });

  it('stores a value that survives reopening the database, as after an app kill', async () => {
    const { db, sqlite } = await createMemoryDb();
    createDevicePrefsRepository(db).set('nightMode', 'on');

    const reopened = await createMemoryDb(sqlite.export());
    expect(createDevicePrefsRepository(reopened.db).get('nightMode')).toBe('on');
  });

  it('overwrites the previous value', async () => {
    const { db } = await createMemoryDb();
    const prefs = createDevicePrefsRepository(db);
    prefs.set('nightMode', 'on');
    prefs.set('nightMode', 'off');
    expect(prefs.get('nightMode')).toBe('off');
    expect(db.select().from(meta).where(eq(meta.key, 'pref.night_mode')).all()).toEqual([
      { key: 'pref.night_mode', value: '"off"' },
    ]);
  });

  it('is never queued for sync and leaves the local identity alone', async () => {
    const { db } = await createMemoryDb();
    const identity = readIdentity(db);
    createDevicePrefsRepository(db).set('nightMode', 'on');
    expect(db.select().from(outbox).all()).toEqual([]);
    expect(readIdentity(db)).toEqual(identity);
  });

  it.each([['"dusk"'], ['not json'], ['null']])(
    'reads an unreadable stored value %s as the default',
    async (value) => {
      const { db } = await createMemoryDb();
      db.insert(meta).values({ key: 'pref.night_mode', value }).run();
      expect(createDevicePrefsRepository(db).get('nightMode')).toBe('auto');
    },
  );

  it('refuses to store a value outside the schema', async () => {
    const { db } = await createMemoryDb();
    const prefs = createDevicePrefsRepository(db);
    expect(() => prefs.set('nightMode', 'dusk' as 'on')).toThrow();
    expect(prefs.get('nightMode')).toBe('auto');
  });

  it('notifies subscribers after a change, and not after unsubscribing', async () => {
    const { db } = await createMemoryDb();
    const prefs = createDevicePrefsRepository(db);
    const listener = jest.fn();
    const unsubscribe = prefs.subscribe(listener);
    prefs.get('nightMode');
    prefs.set('nightMode', 'on');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(prefs.get('nightMode')).toBe('on');
    unsubscribe();
    prefs.set('nightMode', 'off');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
