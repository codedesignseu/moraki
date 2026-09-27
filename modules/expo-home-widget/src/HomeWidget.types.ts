/**
 * Mirrors src/domain/liveActivity/liveActivityPayload.ts's
 * `LiveActivityPayload` — the same "time since last feed" value P5-01's
 * Live Activity reads, one shared shape for both native surfaces.
 * Duplicated rather than imported, same reason as expo-live-activity's own
 * copy: this module ships to the app bundle like any other package, and
 * stays buildable on its own rather than reaching back into the app's
 * `src/`.
 */
export type HomeWidgetPayload = {
  /** UTC epoch ms of the last feed, or null if none has been logged yet. */
  lastFeedAt: number | null;
};

export type HomeWidgetModule = {
  /** Writes the payload to shared storage and asks the OS to redraw the widget. */
  reload(payload: HomeWidgetPayload): Promise<void>;
};
