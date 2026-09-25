import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { DEFAULT_NIGHT_MODE, NIGHT_MODES } from '@/domain/time/night';

import type { SyncDb } from '../identity';
import { meta } from '../schema';

/**
 * Settings that belong to this phone, not the household: night mode here, and
 * the reminders toggle when P1-15 lands. Each is a `pref.`-prefixed row in the
 * local meta table, which is never synced, so one caregiver's choice never
 * changes another's phone. A new pref is one entry here: its key, schema and
 * default. A missing or unreadable value (say, written by a newer app) reads
 * as the default.
 */
export const DEVICE_PREFS = {
  nightMode: { key: 'pref.night_mode', schema: z.enum(NIGHT_MODES), default: DEFAULT_NIGHT_MODE },
  /**
   * What language the app is read in on this phone (P4-04): `device` follows
   * the phone's own setting, `en` or `el` overrides it. Per phone and never
   * synced, so one caregiver reading Greek never changes anyone else's screen.
   */
  language: { key: 'pref.language', schema: z.enum(['device', 'en', 'el']), default: 'device' },
  /**
   * The server household the signed-in account belongs to (P2-05), so Settings
   * can show it without the network. Only a record: this phone keeps logging
   * under its local ids until P2-11 moves its entries into this household.
   */
  accountHousehold: {
    key: 'pref.account_household',
    schema: z
      .object({
        userId: z.uuid(),
        householdId: z.uuid(),
        babyId: z.uuid(),
        babyName: z.string().min(1),
        // The birth details the weight view reads against (P3-05). Older
        // records were written without them, so both are optional.
        bornAt: z.number().int().optional(),
        birthWeightG: z.number().int().nullable().optional(),
        role: z.enum(['owner', 'caregiver', 'viewer']),
      })
      .nullable(),
    default: null,
  },
  /**
   * What a joiner said about the entries they made before joining (P2-11,
   * decision D1): move them into the household, or keep this phone as it is
   * for now. Null until they answer, and the question keeps being asked.
   */
  localEntries: {
    key: 'pref.local_entries',
    schema: z.enum(['move', 'keep']).nullable(),
    default: null,
  },
  /**
   * How long after a feed the reminder is due, in minutes (SDD 4.2: 60 to
   * 480, default 180). The household owns this number; this is the phone's
   * copy, and the one the reminders and the home line are computed from.
   */
  reminderIntervalMin: {
    key: 'pref.reminder_interval_min',
    schema: z.int().min(60).max(480),
    default: 180,
  },
  /**
   * A second reminder this many minutes after the first, or null for none
   * (SDD 4.2: 15 to 120).
   */
  secondReminderMin: {
    key: 'pref.second_reminder_min',
    schema: z.int().min(15).max(120).nullable(),
    default: null,
  },
  /**
   * Feed reminders on for this phone (SDD 6.2: per user, per device, so one
   * caregiver turning them off never touches anyone else). Off until someone
   * asks for them, because a notification nobody asked for is an intrusion.
   */
  reminders: { key: 'pref.reminders', schema: z.boolean(), default: false },
  /**
   * Feeds this phone has been asked about as possible duplicates and told to
   * keep (SDD 5.6, P4-01). Per phone and never synced: it records an answer
   * given here, not anything about the baby. Only the most recent are kept,
   * since an old answer can never be asked again.
   */
  keptDuplicates: { key: 'pref.kept_duplicates', schema: z.array(z.string()).max(50), default: [] },
  /**
   * This account's consent to health data being processed (P3-09, SDD 12).
   * The server holds the real record; this is the phone's copy, so the app
   * knows without the network whether to ask.
   */
  consent: {
    key: 'pref.consent',
    schema: z
      .object({ userId: z.uuid(), version: z.string().min(1), grantedAt: z.number().int() })
      .nullable(),
    default: null,
  },
} as const;

export type DevicePrefName = keyof typeof DEVICE_PREFS;
export type DevicePrefValue<N extends DevicePrefName> = z.infer<(typeof DEVICE_PREFS)[N]['schema']>;

export function createDevicePrefsRepository(db: SyncDb) {
  const listeners = new Set<() => void>();
  const cache = new Map<DevicePrefName, unknown>();

  // Untyped inside; get() gives each pref its own type.
  function read(name: DevicePrefName): unknown {
    const pref = DEVICE_PREFS[name];
    const row = db.select().from(meta).where(eq(meta.key, pref.key)).get();
    if (!row) return pref.default;
    try {
      const parsed = pref.schema.safeParse(JSON.parse(row.value));
      return parsed.success ? parsed.data : pref.default;
    } catch {
      return pref.default;
    }
  }

  return {
    /** The stored value, or the default. Cached, so React can call it on every render. */
    get<N extends DevicePrefName>(name: N): DevicePrefValue<N> {
      if (!cache.has(name)) cache.set(name, read(name));
      return cache.get(name) as DevicePrefValue<N>;
    },

    /** Validates and stores a value, then notifies subscribers. */
    set<N extends DevicePrefName>(name: N, value: DevicePrefValue<N>): void {
      const pref = DEVICE_PREFS[name];
      const stored = JSON.stringify(pref.schema.parse(value));
      db.insert(meta)
        .values({ key: pref.key, value: stored })
        .onConflictDoUpdate({ target: meta.key, set: { value: stored } })
        .run();
      cache.delete(name);
      for (const listener of listeners) listener();
    },

    /** Called after every change. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type DevicePrefsRepository = ReturnType<typeof createDevicePrefsRepository>;
