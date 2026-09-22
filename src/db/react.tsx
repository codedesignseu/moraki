import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { Event } from '@/domain/activities';

import type {
  DevicePrefName,
  DevicePrefsRepository,
  DevicePrefValue,
} from './repositories/devicePrefs';
import type { EventsRepository } from './repositories/events';

/** What the app gets once the database is open and migrated. */
export type AppRepositories = { events: EventsRepository; devicePrefs: DevicePrefsRepository };

const EventsRepositoryContext = createContext<EventsRepository | null>(null);

export function EventsRepositoryProvider({
  repository,
  children,
}: {
  repository: EventsRepository;
  children: ReactNode;
}) {
  return (
    <EventsRepositoryContext.Provider value={repository}>
      {children}
    </EventsRepositoryContext.Provider>
  );
}

export function useEventsRepository(): EventsRepository {
  const repository = useContext(EventsRepositoryContext);
  if (!repository) throw new Error('useEventsRepository needs an EventsRepositoryProvider');
  return repository;
}

/**
 * Live events for the current baby, newest first, straight from SQLite (rule 1).
 * Re-reads after every committed write through the repository, so a screen
 * updates the moment something is logged.
 */
export function useEvents(): Event<unknown>[] {
  const repository = useEventsRepository();
  const version = useSyncExternalStore(repository.subscribe, repository.version);
  // `version` is the change signal: re-read after every committed write.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => repository.list(), [repository, version]);
}

const DevicePrefsContext = createContext<DevicePrefsRepository | null>(null);

export function DevicePrefsProvider({
  repository,
  children,
}: {
  repository: DevicePrefsRepository;
  children: ReactNode;
}) {
  return <DevicePrefsContext.Provider value={repository}>{children}</DevicePrefsContext.Provider>;
}

/** A per-device setting, live from SQLite, and a setter that stores it. */
export function useDevicePref<N extends DevicePrefName>(
  name: N,
): [DevicePrefValue<N>, (value: DevicePrefValue<N>) => void] {
  const prefs = useContext(DevicePrefsContext);
  if (!prefs) throw new Error('useDevicePref needs a DevicePrefsProvider');
  const value = useSyncExternalStore(prefs.subscribe, () => prefs.get(name));
  const set = useCallback((next: DevicePrefValue<N>) => prefs.set(name, next), [prefs, name]);
  return [value, set];
}
