import { useMemo, useSyncExternalStore } from 'react';

import { useOutboxRepository } from '@/db/react';
import type { SyncErrorRow } from '@/db/repositories/outbox';

/** Ops the server refused for good (SDD 5.2). They never block the queue. */
export function useSyncErrors(): SyncErrorRow[] {
  const outbox = useOutboxRepository();
  const version = useSyncExternalStore(outbox.subscribe, outbox.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => outbox.errors(), [outbox, version]);
}
