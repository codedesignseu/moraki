/**
 * Mirrors src/domain/liveActivity/liveActivityPayload.ts's `LiveActivityPayload`.
 * Duplicated rather than imported: a native module's TypeScript side ships
 * to the app bundle same as any other package, and this scaffold is meant
 * to stay buildable on its own once it's a real local dependency, not
 * reach back into the app's own `src/` (the app depends on this module,
 * never the other way around).
 */
export type LiveActivityPayload = {
  /** UTC epoch ms of the last feed, or null if none has been logged yet. */
  lastFeedAt: number | null;
};

export type LiveActivityModule = {
  /** True on iOS 16.1+, where Live Activities exist at all. */
  isAvailableAsync(): Promise<boolean>;
  /** Starts the lock-screen activity. No-ops if one is already running. */
  start(payload: LiveActivityPayload): Promise<void>;
  /** Updates the running activity's content. No-ops if none is running. */
  update(payload: LiveActivityPayload): Promise<void>;
  /** Ends the running activity, if any. */
  end(): Promise<void>;
};
