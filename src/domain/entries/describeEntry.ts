import { getActivity, type Event, type EventType, type Summary } from '../activities';
import { formatClock } from '../time/formatClock';
import { dayBucket } from '../time/zoned';

/** One entry as a list row: home's recent list and the history timeline. */
export type EntryRow = {
  id: string;
  type: EventType;
  /** The activity's label key. */
  labelKey: string;
  summary: Summary | null;
  /** Local 24-hour time it happened, e.g. `14:05`. */
  time: string;
  /** 0 today, 1 yesterday, and so on, in `tz`. */
  daysAgo: number;
  byYou: boolean;
};

export function describeEntry(e: Event<unknown>, now: number, tz: string, me: string): EntryRow {
  const module = getActivity(e.type);
  return {
    id: e.id,
    type: e.type,
    labelKey: module?.i18nKey ?? '',
    summary: module?.summarize?.(e) ?? null,
    time: formatClock(e.occurredAt, tz),
    daysAgo: dayBucket(e.occurredAt, now, tz).daysAgo,
    byYou: e.createdBy === me,
  };
}
