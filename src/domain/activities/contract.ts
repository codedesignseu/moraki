import type { ZodType } from 'zod';

/**
 * Every event type in SDD 4.1. Additive only: a type string is never renamed
 * or repurposed, because old events live on other people's phones forever.
 */
export const EVENT_TYPES = [
  'feed_bottle',
  'feed_breast',
  'diaper',
  'sleep',
  'pump',
  'stock_adjust',
  'health',
  'medication',
  'weight',
  'appointment',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** The history filter chips (P1-11). Each activity says which one it belongs to. */
export const HISTORY_GROUPS = ['feeds', 'diapers', 'sleep', 'health', 'other'] as const;

export type HistoryGroup = (typeof HISTORY_GROUPS)[number];

/**
 * One row of the events table (SDD 4.2) as the domain sees it. Times are UTC
 * epoch milliseconds (rule 5); the db layer maps columns to this shape.
 */
export type Event<P> = {
  id: string;
  householdId: string;
  babyId: string;
  type: EventType;
  occurredAt: number;
  endedAt: number | null;
  payload: P;
  groupId: string | null;
  createdBy: string;
  updatedBy: string;
  clientCreatedAt: number;
  deletedAt: number | null;
};

// Placeholders for types owned by later tasks. Branded so nothing can satisfy
// them by accident; each is replaced by the real shape when its task lands.
type Placeholder<Name extends string> = { readonly __placeholder: Name };
/**
 * The badge icon of each activity, as a key of the UI icon set
 * (src/ui/icons.ts, one PNG in assets/icons each). Plain strings, because the
 * domain imports nothing from the UI; a UI test checks each one exists.
 */
export const ACTIVITY_ICONS = [
  'feed',
  'sleep',
  'diaper',
  'pump',
  'health',
  'weight',
  'visit',
] as const;

export type IconName = (typeof ACTIVITY_ICONS)[number];

/**
 * The colour behind an activity's badge (direction G history and recent
 * rows), as a palette name the UI resolves per scheme, never a colour value.
 */
export const BADGE_TONES = ['feed', 'sleep', 'diaper', 'pump'] as const;

export type BadgeTone = (typeof BADGE_TONES)[number];

/** The four activity tiles on Home, in the order the grid shows them (direction G). */
export const HOME_TILES = ['feed', 'sleep', 'diaper', 'pump'] as const;

export type HomeTile = (typeof HOME_TILES)[number];
/** Replaced by the log sheets (P1-07 onwards). */
export type LogSheetProps<P> = Placeholder<'LogSheetProps'> & { readonly __payload?: P };
/**
 * Totals one day's events add up to (home today strip, SDD 6.1). A feed logged
 * as a bottle plus a breast event shares a group id and counts once, so feeds
 * are collected as ids and counted when read. Bottle millilitres and
 * breastfeeding time are separate totals, each from its own side of a combined
 * feed, and never added together. Insights (P1-17) may extend this.
 */
export type Stats = {
  feedIds: readonly string[];
  /** Bottle millilitres only. */
  ml: number;
  /** Breastfeeding time only, in milliseconds. */
  breastMs: number;
  wet: number;
  dirty: number;
  /** Diaper changes, each once whatever was in it (Home "Today"). */
  diapers: number;
};

export const EMPTY_STATS: Stats = {
  feedIds: [],
  ml: 0,
  breastMs: 0,
  wet: 0,
  dirty: 0,
  diapers: 0,
};
/**
 * Milk kept in each place, oldest first (SDD 6.3). Stock is never stored, only
 * folded from the events, so two caregivers taking milk at the same moment
 * can't corrupt it. A batch with a negative amount is milk taken that wasn't
 * there yet: entries logged out of order leave one behind, and the next
 * addition cancels it before anything else.
 */
export type StockBatch = { at: number; ml: number };
export type Stock = { fridge: StockBatch[]; freezer: StockBatch[] };
export type StockPlace = keyof Stock;

export const EMPTY_STOCK: Stock = { fridge: [], freezer: [] };

/** Adds milk to a place, cancelling anything owed there first. */
export function addMilk(stock: Stock, place: StockPlace, at: number, ml: number): Stock {
  const batches = [...stock[place]];
  let left = ml;
  while (left > 0 && batches[0] && batches[0].ml < 0) {
    const owed = -batches[0].ml;
    if (owed > left) {
      batches[0] = { ...batches[0], ml: batches[0].ml + left };
      left = 0;
    } else {
      batches.shift();
      left -= owed;
    }
  }
  if (left > 0) batches.push({ at, ml: left });
  return { ...stock, [place]: batches };
}

/** Takes milk from a place, oldest batch first. */
export function takeMilk(stock: Stock, place: StockPlace, at: number, ml: number): Stock {
  const batches = [...stock[place]];
  let left = ml;
  while (left > 0 && batches[0] && batches[0].ml > 0) {
    if (batches[0].ml > left) {
      batches[0] = { ...batches[0], ml: batches[0].ml - left };
      left = 0;
    } else {
      left -= batches[0].ml;
      batches.shift();
    }
  }
  if (left > 0) {
    // More was taken than this phone knows about; the rest is owed.
    const last = batches[batches.length - 1];
    if (last && last.ml < 0) batches[batches.length - 1] = { ...last, ml: last.ml - left };
    else batches.push({ at, ml: -left });
  }
  return { ...stock, [place]: batches };
}
/** Replaced by reports (SDD 6.5). */
export type Range = Placeholder<'Range'>;
/** Replaced by reports (SDD 6.5). */
export type ReportSection = Placeholder<'ReportSection'>;
/** What reminder computation needs (SDD 6.2, P1-13). */
export type Settings = {
  /** Reminders on for this user on this device (P1-15 toggle). */
  enabled: boolean;
  /** Household feed interval in minutes (SDD 4.2, 60..480, default 180). */
  intervalMin: number;
  /** Optional second reminder after the first, in minutes (15..120), or null. */
  secondReminderMin: number | null;
};

/**
 * A local notification to schedule (SDD 6.2). Text is an i18n key plus values
 * and never carries amounts or health data: it shows on a lock screen (rule 8).
 */
export type ScheduledReminder = {
  /** Stable, so the scheduler replaces rather than duplicates (e.g. `feed:first`). */
  id: string;
  /** Cancelled and rescheduled together on every change. */
  category: 'feed' | 'appointment';
  /** UTC epoch ms. */
  at: number;
  bodyKey: string;
  values?: Record<string, string>;
};

/** An i18n key and its interpolation values. */
export type Summary = { key: string; values?: Record<string, string | number> };

/**
 * A component that renders a module's log form. Declared structurally so the
 * domain layer stays free of React; a React function component fits it.
 * Method syntax keeps the parameter bivariant, like React's own ComponentType,
 * so a module for one payload still fits the registry's ActivityModule<unknown>.
 */
export type LogSheetComponent<P> = {
  bivarianceHack(props: LogSheetProps<P>): unknown;
}['bivarianceHack'];

/**
 * The activity module contract, SDD 15.2. Every trackable thing declares
 * everything about itself; nothing outside `domain/activities/` branches on
 * event type.
 *
 * `LogSheet` and `summarize` are required by 15.2 but optional here until
 * the tasks that build them fill every module in. The registry completeness
 * test tightens as they land.
 */
export type ActivityModule<P> = {
  type: EventType;
  /** Validation for forms, writes and pulls. */
  schema: ZodType<P>;
  /** Label key in src/i18n, never a literal string. */
  i18nKey: string;
  /** The badge on history and recent rows: an icon and the tone behind it. */
  icon: IconName;
  tone: BadgeTone;
  /** Which history filter chip shows it (P1-11). Checked by the completeness test. */
  historyGroup?: HistoryGroup;
  /**
   * Present when the module appears on the home grid: the tile that logs it,
   * and whose "Last 21:40" line it sets. Bottle and breast share the feed tile.
   */
  quickAction?: { tile: HomeTile };
  LogSheet?: LogSheetComponent<P>;
  /**
   * The detail line for history and home rows, as an i18n key plus values.
   * The row title is the module's label (`i18nKey`). A key, not text, so no
   * user-facing string lives outside src/i18n (rule 9).
   */
  summarize?(e: Event<P>): Summary;
  contributes?: {
    /** Today strip and insights. */
    stats?(acc: Stats, e: Event<P>): Stats;
    /** Milk stock fold. */
    stock?(acc: Stock, e: Event<P>): Stock;
    report?(events: Event<P>[], range: Range): ReportSection | null;
  };
  /**
   * What this activity wants on the lock screen. The values are only ever a
   * clock time: never a title, a note or an amount, because anyone holding the
   * phone can read them (rule 8).
   */
  reminders?(events: Event<P>[], settings: Settings, now: number, tz: string): ScheduledReminder[];
};
