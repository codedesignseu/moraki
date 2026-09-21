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
/** Replaced when the home grid gets icons (P1-06). */
export type IconName = Placeholder<'IconName'>;
/** Replaced by the log sheets (P1-07 onwards). */
export type LogSheetProps<P> = Placeholder<'LogSheetProps'> & { readonly __payload?: P };
/** Replaced by the today strip and insights (P1-06, P1-17). */
export type Stats = Placeholder<'Stats'>;
/** Replaced by the milk stock fold (SDD 6.3). */
export type Stock = Placeholder<'Stock'>;
/** Replaced by reports (SDD 6.5). */
export type Range = Placeholder<'Range'>;
/** Replaced by reports (SDD 6.5). */
export type ReportSection = Placeholder<'ReportSection'>;
/** Replaced by reminder computation (P1-13). */
export type Settings = Placeholder<'Settings'>;
/** Replaced by reminder computation (P1-13). */
export type ScheduledReminder = Placeholder<'ScheduledReminder'>;

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
 * `icon`, `LogSheet` and `summarize` are required by 15.2 but optional here
 * until the tasks that build them (P1-06, P1-07 onwards) fill every module in.
 * The registry completeness test tightens as they land.
 */
export type ActivityModule<P> = {
  type: EventType;
  /** Validation for forms, writes and pulls. */
  schema: ZodType<P>;
  /** Label key in src/i18n, never a literal string. */
  i18nKey: string;
  icon?: IconName;
  /** Present when the module appears on the home grid. */
  quickAction?: { order: number };
  LogSheet?: LogSheetComponent<P>;
  /** History and home rows. */
  summarize?(e: Event<P>): { title: string; detail?: string };
  contributes?: {
    /** Today strip and insights. */
    stats?(acc: Stats, e: Event<P>): Stats;
    /** Milk stock fold. */
    stock?(acc: Stock, e: Event<P>): Stock;
    report?(events: Event<P>[], range: Range): ReportSection | null;
  };
  reminders?(events: Event<P>[], settings: Settings, now: number): ScheduledReminder[];
};
