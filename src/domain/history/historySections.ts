import { getActivity, type Event, type HistoryGroup } from '../activities';
import { dayBucket } from '../time/zoned';

export type HistorySection = {
  /** Local calendar date, `YYYY-MM-DD`: the section key. */
  day: string;
  /** 0 today, 1 yesterday, and so on, in `tz`. */
  daysAgo: number;
  events: Event<unknown>[];
};

/**
 * The history timeline (SDD 7): live events newest first, grouped by local day
 * in `tz`, keeping only the chosen filter groups (none chosen means all).
 * Expects events newest first, as the repository lists them.
 */
export function selectHistory(
  events: readonly Event<unknown>[],
  now: number,
  tz: string,
  groups: ReadonlySet<HistoryGroup>,
): HistorySection[] {
  const sections: HistorySection[] = [];
  for (const e of events) {
    if (e.deletedAt !== null) continue;
    const group = getActivity(e.type)?.historyGroup;
    if (groups.size > 0 && (group === undefined || !groups.has(group))) continue;
    const { key, daysAgo } = dayBucket(e.occurredAt, now, tz);
    const last = sections[sections.length - 1];
    if (last?.day === key) last.events.push(e);
    else sections.push({ day: key, daysAgo, events: [e] });
  }
  return sections;
}
