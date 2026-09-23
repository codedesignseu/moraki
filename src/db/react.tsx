import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { Event } from '@/domain/activities';

import type { CaregiversRepository } from './repositories/caregivers';
import type { Adoption, AdoptionTarget } from './adoptHousehold';
import type { OutboxRepository } from './repositories/outbox';
import type {
  DevicePrefName,
  DevicePrefsRepository,
  DevicePrefValue,
} from './repositories/devicePrefs';
import type { EventsRepository } from './repositories/events';

/** What the app gets once the database is open and migrated. */
export type AppRepositories = {
  events: EventsRepository;
  devicePrefs: DevicePrefsRepository;
  outbox: OutboxRepository;
  caregivers: CaregiversRepository;
  /** The server household and user this phone is linked to, null before P2-11. */
  linked: () => { householdId: string; userId: string } | null;
  /** Entries made before this phone had an account (P2-11). */
  localOnly: () => number;
  /** Takes those entries into the household, and links the phone to it. */
  adopt: (target: AdoptionTarget, now: number) => Adoption;
};

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

const OutboxContext = createContext<AppRepositories | null>(null);

export function SyncRepositoriesProvider({
  repositories,
  children,
}: {
  repositories: AppRepositories;
  children: ReactNode;
}) {
  return <OutboxContext.Provider value={repositories}>{children}</OutboxContext.Provider>;
}

function useRepositories(): AppRepositories {
  const repositories = useContext(OutboxContext);
  if (!repositories) throw new Error('useOutboxRepository needs a SyncRepositoriesProvider');
  return repositories;
}

export function useOutboxRepository(): OutboxRepository {
  return useRepositories().outbox;
}

/** Reads the linked identity fresh each time; P2-11 writes it. */
export function useLinkedIdentity(): AppRepositories['linked'] {
  return useRepositories().linked;
}

export function useCaregiversRepository(): CaregiversRepository {
  return useRepositories().caregivers;
}

const NO_NAMES: ReadonlyMap<string, string> = new Map();
const noStore = { subscribe: () => () => {}, version: () => 0 };

/**
 * Caregiver names by user id, refreshed whenever the household changes.
 * A screen rendered without the sync repositories simply has no names to
 * show: entries then read as "You" or as another caregiver, as they did
 * before a household existed.
 */
export function useCaregiverNames(): ReadonlyMap<string, string> {
  const repositories = useContext(OutboxContext);
  const caregivers = repositories?.caregivers;
  const version = useSyncExternalStore(
    caregivers?.subscribe ?? noStore.subscribe,
    caregivers?.version ?? noStore.version,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => caregivers?.names() ?? NO_NAMES, [caregivers, version]);
}

/** What P2-11 needs: how much is local-only, and the move itself. */
export function useAdoption(): Pick<AppRepositories, 'localOnly' | 'adopt'> {
  const { localOnly, adopt } = useRepositories();
  return { localOnly, adopt };
}
