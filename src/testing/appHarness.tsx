/// <reference types="node" />
// Test-only: the real app routes over a migrated in-memory SQLite database
// (sql.js) instead of expo-sqlite, with fake timers controlling the clock.
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { randomBytes } from 'node:crypto';

import Home from '../../app/index';
import LogDiaper from '../../app/log/diaper';
import LogFeed from '../../app/log/feed';
import { EventsRepositoryProvider } from '@/db/react';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb, type MemoryDb } from '@/db/testing/memoryDb';
import { newId } from '@/domain/ids';
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
          <Stack />
        </EventsRepositoryProvider>
      </ThemeProvider>
    );
  }
  return renderRouter({
    _layout: TestLayout,
    index: Home,
    'log/feed': LogFeed,
    'log/diaper': LogDiaper,
  });
}
