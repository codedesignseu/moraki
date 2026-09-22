/// <reference types="node" />
// Test-only: the real app routes over a migrated in-memory SQLite database
// (sql.js) instead of expo-sqlite, with fake timers controlling the clock.
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { randomBytes } from 'node:crypto';

import History from '../../app/(tabs)/history';
import Home from '../../app/(tabs)/index';
import Insights from '../../app/(tabs)/insights';
import Settings from '../../app/(tabs)/settings';
import TabsLayout from '../../app/(tabs)/_layout';
import EditEntry from '../../app/entry/[id]';
import LogDiaper from '../../app/log/diaper';
import LogFeed from '../../app/log/feed';
import LogHealth from '../../app/log/health';
import LogMedication from '../../app/log/medication';
import LogSleep from '../../app/log/sleep';
import Invite from '../../app/invite';
import Join from '../../app/join/[code]';
import HouseholdSetup from '../../app/onboarding/household';
import JoinWithCode from '../../app/onboarding/join';
import SignIn from '../../app/onboarding/sign-in';
import {
  DevicePrefsProvider,
  EventsRepositoryProvider,
  SyncRepositoriesProvider,
} from '@/db/react';
import { UndoProvider } from '@/db/undo';
import { readLinkedIdentity } from '@/db/identity';
import {
  createDevicePrefsRepository,
  type DevicePrefsRepository,
} from '@/db/repositories/devicePrefs';
import { createOutboxRepository, type OutboxRepository } from '@/db/repositories/outbox';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb, type MemoryDb } from '@/db/testing/memoryDb';
import { newId } from '@/domain/ids';
import type { Auth } from '@/sync/auth';
import { AuthProvider } from '@/sync/AuthProvider';
import { SyncProvider } from '@/sync/SyncProvider';
import { PreferredNightModeTheme } from '@/features/settings/NightModeTheme';
import { UndoToast } from '@/features/undo/UndoToast';
import '@/i18n';

export type Harness = {
  repo: EventsRepository;
  prefs: DevicePrefsRepository;
  outbox: OutboxRepository;
  mem: MemoryDb;
};

// Each harness's prefs, so renderApp(repo) finds the ones on the same database.
const prefsFor = new WeakMap<EventsRepository, DevicePrefsRepository>();
const dbFor = new WeakMap<EventsRepository, MemoryDb>();

/** A fresh database and repository, with fake timers starting at `now`. */
export async function createHarness(now: number, bytes?: Uint8Array): Promise<Harness> {
  jest.useRealTimers();
  const mem = await createMemoryDb(bytes);
  jest.useFakeTimers({ now });
  const repo = createEventsRepository(mem.db, {
    now: Date.now,
    newId: (at) => newId(at, () => new Uint8Array(randomBytes(16))),
  });
  const prefs = createDevicePrefsRepository(mem.db);
  const outbox = createOutboxRepository(mem.db);
  prefsFor.set(repo, prefs);
  dbFor.set(repo, mem);
  return { repo, prefs, outbox, mem };
}

/**
 * Renders the app's routes, starting on home, themed by the night mode setting
 * as in the app. Without `auth`, the build has no Supabase settings and sign
 * in isn't offered.
 */
export function renderApp(
  repo: EventsRepository,
  { auth = null, initialUrl }: { auth?: Auth | null; initialUrl?: string } = {},
) {
  const prefs = prefsFor.get(repo);
  const mem = dbFor.get(repo);
  if (!prefs || !mem) throw new Error('renderApp needs a repository from createHarness');
  const repositories = {
    events: repo,
    devicePrefs: prefs,
    outbox: createOutboxRepository(mem.db),
    linked: () => readLinkedIdentity(mem.db),
  };
  function TestLayout() {
    return (
      <EventsRepositoryProvider repository={repo}>
        <DevicePrefsProvider repository={prefs!}>
          <SyncRepositoriesProvider repositories={repositories}>
            <PreferredNightModeTheme>
              <AuthProvider auth={auth}>
                <SyncProvider>
                  <UndoProvider>
                    <Stack />
                    <UndoToast />
                  </UndoProvider>
                </SyncProvider>
              </AuthProvider>
            </PreferredNightModeTheme>
          </SyncRepositoriesProvider>
        </DevicePrefsProvider>
      </EventsRepositoryProvider>
    );
  }
  return renderRouter(
    {
      _layout: TestLayout,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': Home,
      '(tabs)/history': History,
      '(tabs)/insights': Insights,
      '(tabs)/settings': Settings,
      'log/feed': LogFeed,
      'log/diaper': LogDiaper,
      'entry/[id]': EditEntry,
      'log/sleep': LogSleep,
      'log/health': LogHealth,
      'log/medication': LogMedication,
      'onboarding/sign-in': SignIn,
      'onboarding/household': HouseholdSetup,
      'onboarding/join': JoinWithCode,
      'join/[code]': Join,
      invite: Invite,
    },
    initialUrl ? { initialUrl } : {},
  );
}
