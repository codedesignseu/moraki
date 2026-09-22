import { getCalendars } from 'expo-localization';

/** The device timezone now. Read at render time, so day buckets follow travel (SDD 6.6). */
export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
