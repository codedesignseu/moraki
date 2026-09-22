import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { EventChanges, EventsRepository, NewEvent } from './repositories/events';
import { UNDO_WINDOW_MS } from './repositories/events';

/** A save that can still be undone: what to say, and how to reverse it. */
export type PendingUndo = { key: number; messageKey: string; undo: () => void };

type UndoContext = {
  pending: PendingUndo | null;
  offer: (messageKey: string, undo: () => void) => void;
  runUndo: () => void;
};

const Context = createContext<UndoContext | null>(null);

/**
 * Holds the one save that can currently be undone (P1-12), for UNDO_WINDOW_MS.
 * A new save replaces it. The repository enforces the same window, so an undo
 * pressed in time always works and one that isn't offered can't slip through.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const counter = useRef(0);
  // The live undo, read in the Undo handler rather than in a state updater, so
  // it runs exactly once even when React replays updaters (strict mode).
  const live = useRef<PendingUndo | null>(null);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      live.current = null;
      setPending(null);
    }, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const offer = useCallback((messageKey: string, undo: () => void) => {
    counter.current += 1;
    const next = { key: counter.current, messageKey, undo };
    live.current = next;
    setPending(next);
  }, []);

  const runUndo = useCallback(() => {
    const current = live.current;
    if (!current) return;
    live.current = null;
    setPending(null);
    current.undo();
  }, []);

  const value = useMemo(() => ({ pending, offer, runUndo }), [pending, offer, runUndo]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useUndoContext(): UndoContext {
  const context = useContext(Context);
  if (!context) throw new Error('useUndo needs an UndoProvider');
  return context;
}

/** The pending undo for the toast. */
export function useUndoState() {
  const { pending, runUndo } = useUndoContext();
  return { pending, runUndo };
}

/**
 * Saves that offer an undo. Each writes through the repository as usual, then
 * offers its exact reverse: a new entry is soft-deleted, an edit or a delete is
 * reverted to its snapshot (see EventsRepository.revert).
 */
export function useUndoableSaves(repository: EventsRepository) {
  const { offer } = useUndoContext();
  return useMemo(
    () => ({
      insert(messageKey: string, inputs: NewEvent | NewEvent[]) {
        const saved = Array.isArray(inputs)
          ? repository.insertGroup(inputs)
          : [repository.insert(inputs)];
        offer(messageKey, () => repository.softDelete(saved.map((e) => e.id)));
        return saved;
      },
      patch(messageKey: string, edits: { id: string; changes: EventChanges }[]) {
        const before = repository.snapshot(edits.map((edit) => edit.id));
        for (const { id, changes } of edits) repository.patch(id, changes);
        offer(messageKey, () => repository.revert(before));
      },
      remove(messageKey: string, ids: string[]) {
        const before = repository.snapshot(ids);
        repository.softDelete(ids);
        offer(messageKey, () => repository.revert(before));
      },
    }),
    [repository, offer],
  );
}
