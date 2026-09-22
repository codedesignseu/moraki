/// <reference types="node" />
// Test-only: the real app routes over a migrated in-memory SQLite database
// (sql.js) instead of expo-sqlite, with fake timers controlling the clock.
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { randomBytes } from 'node:crypto';

import History from '../../app/(tabs)/history';
import Home from '../../app/(tabs)/index';
import TabsLayout from '../../app/(tabs)/_layout';
import LogDiaper from '../../app/log/diaper';
import LogFeed from '../../app/log/feed';
import LogHealth from '../../app/log/health';
import LogMedication from '../../app/log/medication';
import LogSleep from '../../app/log/sleep';
import { EventsRepositoryProvider } from '@/db/react';
import { UndoProvider } from '@/db/undo';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb, type MemoryDb } from '@/db/testing/memoryDb';
import { newId } from '@/domain/ids';
import { UndoToast } from '@/features/undo/UndoToast';
import '@/i18n';
import { ThemeProvider } from '@/ui/theme';

export type Harness = { repo: EventsRepository; mem: MemoryDb };

/** A fresh database and repository, with fake timers starting at `now`. */
export async function createHarness(now: number, bytes?: Uint8Array): Promise<Harness> {
  jest.useRealTimers();
  const mem = await createMemoryDb(bytes);
  jest.useFakeTimers({ now });
  const repo = createEventsRepository(mem.db, {
    now: Date.now,
    newId: (at) => newId(at, () => new Uint8Array(randomBytes(16))),
  });
  return { repo, mem };
}

/** Renders the app's routes, starting on home. */
export function renderApp(repo: EventsRepository) {
  function TestLayout() {
    return (
      <ThemeProvider scheme="light">
        <EventsRepositoryProvider repository={repo}>
          <UndoProvider>
            <Stack />
            <UndoToast />
          </UndoProvider>
        </EventsRepositoryProvider>
      </ThemeProvider>
    );
  }
  return renderRouter({
    _layout: TestLayout,
    '(tabs)/_layout': TabsLayout,
    '(tabs)/index': Home,
    '(tabs)/history': History,
    'log/feed': LogFeed,
    'log/diaper': LogDiaper,
    'log/sleep': LogSleep,
    'log/health': LogHealth,
    'log/medication': LogMedication,
  });
}
