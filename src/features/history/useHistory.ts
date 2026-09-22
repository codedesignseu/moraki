import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEvents, useEventsRepository } from '@/db/react';
import type { HistoryGroup } from '@/domain/activities';
import { describeEntry, type EntryRow } from '@/domain/entries/describeEntry';
import { selectHistory } from '@/domain/history/historySections';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

import { useNow } from '@/ui/useNow';

export type HistoryDay = {
  day: string;
  /** "Today", "Yesterday" or a local date such as "Friday 23 October". */
  title: string;
  data: EntryRow[];
};

const DAY_TICK_MS = 60_000;

/**
 * The history view model (SDD 15.4): live events grouped by local day, with
 * multi-select filter chips (none selected means everything).
 */
export function useHistory() {
  const repository = useEventsRepository();
  const events = useEvents();
  // Only needed so "Today" rolls over at midnight; a minute is plenty.
  const now = useNow(DAY_TICK_MS);
  const tz = deviceTimeZone();
  const { t, i18n } = useTranslation();
  const [groups, setGroups] = useState<ReadonlySet<HistoryGroup>>(new Set());

  const days = useMemo(() => {
    const me = repository.currentUserId();
    const dateFormat = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: tz,
    });
    return selectHistory(events, now, tz, groups).map((section): HistoryDay => ({
      day: section.day,
      title:
        section.daysAgo === 0
          ? t('history.today')
          : section.daysAgo === 1
            ? t('history.yesterday')
            : dateFormat.format(section.events[0]?.occurredAt ?? now),
      data: section.events.map((e) => describeEntry(e, now, tz, me)),
    }));
  }, [events, now, tz, groups, repository, t, i18n.language]);

  return {
    days,
    groups,
    hasAnyEvents: events.length > 0,
    toggle: (group: HistoryGroup) =>
      setGroups((current) => {
        const next = new Set(current);
        if (next.has(group)) next.delete(group);
        else next.add(group);
        return next;
      }),
  };
}
