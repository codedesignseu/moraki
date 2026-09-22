import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { openAppDatabase } from './client.web';
import migrations from './migrations/migrations';
import { createEventsRepository } from './repositories/events';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));
// Spy on the shared pieces without changing them, to prove the web path uses
// the device's migrator, migrations bundle and repository factory.
jest.mock('drizzle-orm/expo-sqlite/migrator', () => {
  const actual = jest.requireActual('drizzle-orm/expo-sqlite/migrator');
  return { ...actual, migrate: jest.fn(actual.migrate) };
});
jest.mock('./repositories/events', () => {
  const actual = jest.requireActual('./repositories/events');
  return { ...actual, createEventsRepository: jest.fn(actual.createEventsRepository) };
});

let warn: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('web preview database stand-in (client.web.ts)', () => {
  it('opens a migrated in-memory database behind the real repositories', async () => {
    const { events: repo, devicePrefs } = await openAppDatabase();
    expect(repo.list()).toEqual([]);
    const event = repo.insert({
      type: 'feed_bottle',
      occurredAt: Date.UTC(2026, 6, 1, 9),
      payload: { ml: 90, milk: 'formula' },
    });
    expect(repo.list()).toEqual([event]);
    devicePrefs.set('nightMode', 'on');
    expect(devicePrefs.get('nightMode')).toBe('on');
  });

  it('uses the same migrator, migrations bundle and repository factory as the device', async () => {
    await openAppDatabase();
    expect(migrate).toHaveBeenCalledWith(expect.anything(), migrations);
    expect(createEventsRepository).toHaveBeenCalledTimes(1);
  });

  it('warns in the console that the data is a stand-in', async () => {
    await openAppDatabase();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('in-memory stand-in database'));
  });

  it('starts empty every time: nothing is saved', async () => {
    const { events: first } = await openAppDatabase();
    first.insert({ type: 'diaper', occurredAt: 0, payload: { kind: 'wet' } });
    const { events: second } = await openAppDatabase();
    expect(second.list()).toEqual([]);
  });
});
