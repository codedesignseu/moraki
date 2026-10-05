import { inArray } from 'drizzle-orm';

import type { SyncDb } from './identity';
import { META_KEYS } from './meta';
import type { CaregiversRepository } from './repositories/caregivers';
import { DEVICE_PREFS, type DevicePrefsRepository } from './repositories/devicePrefs';
import type { EventsRepository } from './repositories/events';
import type { OutboxRepository } from './repositories/outbox';
import { babies, events, memberships, meta, outbox, syncErrors } from './schema';

export type ResetScope = {
  /** Also forget this account's consent record: true when the account itself is gone. */
  forgetAccount: boolean;
};

/**
 * Returns this phone to a first launch (P4-06), in one transaction: after
 * leaving or deleting a household, or deleting the account, nothing of that
 * household may stay behind on the phone.
 *
 * Gone: every entry, the outbox, refused ops, the baby, the caregivers, the
 * link to the server household and its pull cursor, and the prefs that
 * describe the household (its record, the adoption answer, kept duplicates).
 * Fresh placeholder ids replace the old ones, so the phone works signed out
 * straight away and nothing it logs next can be mistaken for the old
 * household's.
 *
 * Kept: how this phone looks and reads (night mode, language) and its
 * reminder settings, which describe the phone rather than the household.
 */
export function resetPhone(db: SyncDb, scope: ResetScope, newId: () => string): void {
  const prefs = [
    DEVICE_PREFS.accountHousehold.key,
    DEVICE_PREFS.localEntries.key,
    DEVICE_PREFS.keptDuplicates.key,
    ...(scope.forgetAccount ? [DEVICE_PREFS.consent.key] : []),
  ];

  db.transaction((tx) => {
    tx.delete(events).run();
    tx.delete(outbox).run();
    tx.delete(syncErrors).run();
    tx.delete(memberships).run();
    tx.delete(babies).run();
    tx.delete(meta)
      .where(
        inArray(meta.key, [
          META_KEYS.householdId,
          META_KEYS.userId,
          META_KEYS.pullCursor,
          META_KEYS.localHouseholdId,
          META_KEYS.localBabyId,
          META_KEYS.localUserId,
          ...prefs,
        ]),
      )
      .run();
    tx.insert(meta)
      .values([
        { key: META_KEYS.localHouseholdId, value: newId() },
        { key: META_KEYS.localBabyId, value: newId() },
        { key: META_KEYS.localUserId, value: newId() },
      ])
      .run();
  });
}

/**
 * resetPhone, then every repository told to read again: the events repository
 * forgets the ids it cached, and each screen re-renders from the empty tables.
 */
export function createResetPhone(
  db: SyncDb,
  repositories: {
    events: EventsRepository;
    devicePrefs: DevicePrefsRepository;
    outbox: OutboxRepository;
    caregivers: CaregiversRepository;
  },
  newId: () => string,
): (scope: ResetScope) => void {
  return (scope) => {
    resetPhone(db, scope, newId);
    repositories.events.forgetIdentity();
    repositories.devicePrefs.reload();
    repositories.outbox.reload();
    repositories.caregivers.reload();
  };
}
