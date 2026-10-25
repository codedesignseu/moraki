import type { CaregiversRepository } from '@/db/repositories/caregivers';
import type { HouseholdAccess } from '@/domain/consent/consent';
import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import type { OutboxRepository } from '@/db/repositories/outbox';

import type { Auth } from './auth';
import type { AuthState } from './AuthProvider';
import { backoffMs } from './backoff';
import type { LinkedIdentity, PushBlock } from './pushEngine';
import { pushBlock } from './pushEngine';
import type { PulledEvent } from '@/domain/sync/pendingProtection';

import type { MembershipStatus } from './membershipStatus';
import { pullCaregivers } from './pullCaregivers';
import { pullHousehold, type PulledHousehold } from './pullHousehold';
import { pullPage, PULL_PAGE, PullTransportError } from './pullEvents';

/** Why the server says this phone no longer belongs to its household (P0.5). */
export type Revocation = 'not_member' | 'household_gone';

export type PullOutcome =
  | { kind: 'blocked'; by: PushBlock }
  | { kind: 'revoked'; reason: Revocation }
  | { kind: 'pulled'; stored: number; skipped: number; cursor: number }
  | { kind: 'failed'; failures: number; retryInMs: number };

type Deps = {
  linked: () => LinkedIdentity;
  events: EventsRepository;
  outbox: OutboxRepository;
  caregivers?: CaregiversRepository;
  /** Where the household's own settings are kept on this phone (P1-F16). */
  devicePrefs?: DevicePrefsRepository;
  auth: Auth | null;
  state: AuthState;
  /** Swapped in tests; the real one reads the events table. */
  fetchPage?: (
    auth: Auth,
    householdId: string,
    cursor: number,
    limit: number,
  ) => Promise<PulledEvent[]>;
  fetchCaregivers?: typeof pullCaregivers;
  fetchHousehold?: typeof pullHousehold;
  /**
   * Asks the server where this account stands with the household (P0.2,
   * `my_membership_status`) before each pull. Without it, as in tests of the
   * pull alone, access is taken as granted.
   */
  fetchStatus?: (auth: Auth, householdId: string) => Promise<MembershipStatus>;
  /**
   * The server said plainly that this account is no longer a member, or the
   * household is gone (P0.5): clear the household from the phone. Never
   * called for an error, a timeout or an answer that isn't clear.
   */
  onRevoked?: (reason: Revocation) => Promise<void> | void;
};

/**
 * Brings this phone up to date with its household (SDD 5.3): pages of 500 by
 * seq, from wherever it last got to, until a short page says there is no more.
 * The cursor moves only after its rows are stored, so an interrupted pull
 * repeats a page rather than losing one. Sending and reading are gated the
 * same way (P2-08): until the phone is linked to the household it signed in
 * to, pulled rows would belong to no baby it knows.
 */
/**
 * Stores what the household says about itself. The settings replace whatever
 * this phone had: the household owns them (SDD 4.2), so the server's copy is
 * the one that counts, and only an owner can have changed it there.
 */
function applyHousehold(
  prefs: DevicePrefsRepository,
  householdId: string,
  household: PulledHousehold,
): void {
  prefs.set('reminderIntervalMin', household.reminderIntervalMin);
  prefs.set('secondReminderMin', household.secondReminderMin);

  const record = prefs.get('accountHousehold');
  // Only this phone's own household, and only once it knows which baby: the
  // record belongs to an account, and replacing another account's would be
  // rewriting someone else's phone (P2-F4 point 4).
  if (!record || record.householdId !== householdId || !household.baby) return;
  prefs.set('accountHousehold', {
    ...record,
    babyId: household.baby.id,
    babyName: household.baby.name,
    bornAt: household.baby.bornAt,
    birthWeightG: household.baby.birthWeightG,
  });
}

/** Why reading stops, for each answer that isn't `granted` (P0.2, P0.3). */
const ACCESS_BLOCK = {
  needs_consent: 'no_consent',
  needs_agreement: 'no_agreement',
  frozen: 'frozen',
} as const satisfies Record<Exclude<HouseholdAccess, 'granted'>, PushBlock>;

export function createPullEngine(deps: Deps) {
  const fetchPage = deps.fetchPage ?? pullPage;
  let failures = 0;
  let running: Promise<PullOutcome> | null = null;

  async function drain(): Promise<PullOutcome> {
    // Consent (P3-09) gates writing, not reading: the server's select policy
    // asks only for membership, so a caregiver who withdrew can still see
    // what is already there, to export or delete it.
    const blocked = pushBlock(deps.linked(), deps.auth, deps.state);
    if (blocked) return { kind: 'blocked', by: blocked };
    const { householdId, userId } = deps.linked()!;

    // P0.2: reading needs the caregiver agreement, or a guardian's consent.
    // The server filters the rows either way; asking first is how the phone
    // knows to stop and say what is missing, rather than seeing nothing new.
    // Nothing here is cleared: what the phone has stays readable.
    if (deps.fetchStatus) {
      let status: MembershipStatus;
      try {
        status = await deps.fetchStatus(deps.auth!, householdId);
      } catch {
        failures += 1;
        return { kind: 'failed', failures, retryInMs: backoffMs(failures) };
      }
      if (status.status === 'member') {
        const record = {
          userId,
          householdId,
          access: status.access,
          isGuardian: status.isGuardian,
        };
        const known = deps.devicePrefs?.get('householdAccess');
        if (JSON.stringify(known) !== JSON.stringify(record)) {
          deps.devicePrefs?.set('householdAccess', record);
        }
        if (status.access !== 'granted') {
          return { kind: 'blocked', by: ACCESS_BLOCK[status.access] };
        }
      } else {
        // Only about the household and account asked about: a phone that was
        // linked elsewhere meanwhile is left alone.
        const now = deps.linked();
        if (now?.householdId !== householdId || now.userId !== userId) {
          return { kind: 'blocked', by: 'not_linked' };
        }
        await deps.onRevoked?.(status.status);
        return { kind: 'revoked', reason: status.status };
      }
    }

    let stored = 0;
    let skipped = 0;
    for (;;) {
      const cursor = deps.outbox.cursor();
      let page: PulledEvent[];
      try {
        page = await fetchPage(deps.auth!, householdId, cursor, PULL_PAGE);
      } catch (error) {
        failures += 1;
        void error;
        return { kind: 'failed', failures, retryInMs: backoffMs(failures) };
      }

      if (page.length > 0) {
        const applied = deps.events.applyFromServer(page);
        stored += applied.stored;
        skipped += applied.skipped;
        // Only now: every row up to here is stored, so a pull that stops next
        // page asks for the same rows again instead of stepping over them.
        deps.outbox.setCursor(Math.max(...page.map((row) => row.seq ?? cursor)));
      }
      failures = 0;
      if (page.length < PULL_PAGE) break;
    }
    // A phone that stays open for weeks still empties its old tombstones
    // (P0.6), including any a pull could not bring because it skipped them.
    deps.events.purgeOldTombstones();

    // Who is in the household comes with the same trip: a pull of events
    // carries no names (P2-F11), and without them another phone's entries
    // would read as a stranger's.
    if (deps.caregivers) {
      const who = await (deps.fetchCaregivers ?? pullCaregivers)(deps.auth!, householdId);
      if (who.length > 0) deps.caregivers.replace(householdId, who);
    }

    // The household's own row comes too (P1-F16): the feed interval belongs
    // to the household, so a phone that didn't make the change still has to
    // end up computing the same reminder times as the one that did.
    if (deps.devicePrefs) {
      const household = await (deps.fetchHousehold ?? pullHousehold)(deps.auth!, householdId);
      if (household) applyHousehold(deps.devicePrefs, householdId, household);
    }

    return { kind: 'pulled', stored, skipped, cursor: deps.outbox.cursor() };
  }

  return {
    /** One pull at a time; a second call joins the one in flight. */
    pull(): Promise<PullOutcome> {
      running ??= drain().finally(() => {
        running = null;
      });
      return running;
    },
    resetBackoff(): void {
      failures = 0;
    },
  };
}

export type PullEngine = ReturnType<typeof createPullEngine>;
export { PullTransportError };
