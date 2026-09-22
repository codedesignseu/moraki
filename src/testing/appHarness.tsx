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
import SignIn from '../../app/onboarding/sign-in';
import { DevicePrefsProvider, EventsRepositoryProvider } from '@/db/react';
import { UndoProvider } from '@/db/undo';
import {
  createDevicePrefsRepository,
  type DevicePrefsRepository,
} from '@/db/repositories/devicePrefs';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb, type MemoryDb } from '@/db/testing/memoryDb';
import { newId } from '@/domain/ids';
import type { Auth } from '@/sync/auth';
import { AuthProvider } from '@/sync/AuthProvider';
import { PreferredNightModeTheme } from '@/features/settings/NightModeTheme';
import { UndoToast } from '@/features/undo/UndoToast';
import '@/i18n';

export type Harness = { repo: EventsRepository; prefs: DevicePrefsRepository; mem: MemoryDb };

// Each harness's prefs, so renderApp(repo) finds the ones on the same database.
const prefsFor = new WeakMap<EventsRepository, DevicePrefsRepository>();

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
  prefsFor.set(repo, prefs);
  return { repo, prefs, mem };
}

/**
 * Renders the app's routes, starting on home, themed by the night mode setting
 * as in the app. Without `auth`, the build has no Supabase settings and sign
 * in isn't offered.
 */
export function renderApp(repo: EventsRepository, { auth = null }: { auth?: Auth | null } = {}) {
  const prefs = prefsFor.get(repo);
  if (!prefs) throw new Error('renderApp needs a repository from createHarness');
  function TestLayout() {
    return (
      <EventsRepositoryProvider repository={repo}>
        <DevicePrefsProvider repository={prefs!}>
          <PreferredNightModeTheme>
            <AuthProvider auth={auth}>
              <UndoProvider>
                <Stack />
                <UndoToast />
              </UndoProvider>
            </AuthProvider>
          </PreferredNightModeTheme>
        </DevicePrefsProvider>
      </EventsRepositoryProvider>
    );
  }
  return renderRouter({
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
  });
}
