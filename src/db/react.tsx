import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import type { Event } from '@/domain/activities';

import type { EventsRepository } from './repositories/events';

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
