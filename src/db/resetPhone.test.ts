import { randomUUID } from 'node:crypto';

import { adoptHousehold } from './adoptHousehold';
import { readIdentity, readLinkedIdentity } from './identity';
import { createDevicePrefsRepository } from './repositories/devicePrefs';
import { createEventsRepository } from './repositories/events';
import { resetPhone } from './resetPhone';
import { babies, events, memberships, outbox, syncErrors } from './schema';
import { createMemoryDb, testDeps } from './testing/memoryDb';

const NOW = Date.UTC(2026, 9, 5, 12, 0);
const TARGET = {
  userId: '0190a0b0-0000-7000-8000-0000000000a1',
  householdId: '0190a0b0-0000-7000-8000-0000000000a2',
  babyId: '0190a0b0-0000-7000-8000-0000000000b2',
  babyName: 'Ella',
};

async function linkedPhone() {
  const { db } = await createMemoryDb();
  const repo = createEventsRepository(db, testDeps(NOW));
  const prefs = createDevicePrefsRepository(db);
  repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
  adoptHousehold(db, TARGET, NOW);
  repo.forgetIdentity();
  repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'dirty' } });
  db.insert(syncErrors)
    .values({
      entity: 'event',
      entityId: 'x',
      op: 'insert',
      body: '{}',
      reason: 'forbidden',
      failedAt: NOW,
    })
    .run();
  db.insert(memberships)
    .values({
      householdId: TARGET.householdId,
      userId: TARGET.userId,
      role: 'owner',
      displayName: 'Me',
      joinedAt: NOW,
    })
    .run();
  prefs.set('accountHousehold', { ...TARGET, role: 'owner' });
  prefs.set('keptDuplicates', ['a']);
  prefs.set('consent', { userId: TARGET.userId, version: '1', grantedAt: NOW });
  prefs.set('nightMode', 'on');
  prefs.set('language', 'el');
  return { db, repo };
}

describe('returning a phone to a first launch', () => {
  it('removes everything the household left on the phone', async () => {
    const { db } = await linkedPhone();
    const before = readIdentity(db);

    resetPhone(db, { forgetAccount: false }, randomUUID);

    expect(db.select().from(events).all()).toEqual([]);
    expect(db.select().from(outbox).all()).toEqual([]);
    expect(db.select().from(syncErrors).all()).toEqual([]);
    expect(db.select().from(memberships).all()).toEqual([]);
    expect(db.select().from(babies).all()).toEqual([]);
    expect(readLinkedIdentity(db)).toBeNull();
    const prefs = createDevicePrefsRepository(db);
    expect(prefs.get('accountHousehold')).toBeNull();
    expect(prefs.get('keptDuplicates')).toEqual([]);

    // Fresh placeholders: the phone works signed out, under new ids.
    const after = readIdentity(db);
    expect(after.householdId).not.toBe(before.householdId);
    expect(after.babyId).not.toBe(TARGET.babyId);
    expect(after.userId).not.toBe(TARGET.userId);
  });

  it('keeps how the phone looks and reads', async () => {
    const { db } = await linkedPhone();
    resetPhone(db, { forgetAccount: false }, randomUUID);
    const prefs = createDevicePrefsRepository(db);
    expect(prefs.get('nightMode')).toBe('on');
    expect(prefs.get('language')).toBe('el');
  });

  it('forgets the consent record only when the account is gone', async () => {
    const left = await linkedPhone();
    resetPhone(left.db, { forgetAccount: false }, randomUUID);
    expect(createDevicePrefsRepository(left.db).get('consent')).not.toBeNull();

    const deleted = await linkedPhone();
    resetPhone(deleted.db, { forgetAccount: true }, randomUUID);
    expect(createDevicePrefsRepository(deleted.db).get('consent')).toBeNull();
  });

  it('lets the phone log again straight away', async () => {
    const { db } = await linkedPhone();
    resetPhone(db, { forgetAccount: true }, randomUUID);
    const repo = createEventsRepository(db, testDeps(NOW));
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    expect(repo.list()).toHaveLength(1);
    expect(repo.list()[0]?.householdId).toBe(readIdentity(db).householdId);
  });
});
