import type { ReactNode } from 'react';

import { useDevicePref } from '@/db/react';
import i18n from '@/i18n';

import { resolveLanguage } from './useLanguage';

/**
 * Puts the app in this phone's chosen language before its first screen renders
 * (P4-04). i18next starts in the phone's own language, which is right until
 * someone has chosen otherwise; the choice lives in SQLite, so it is only
 * readable once the database is open.
 *
 * The change is applied during render on purpose. Resources are bundled, so
 * changing language is synchronous, and nothing below has rendered yet — the
 * first frame is already in the right language, with no flash of English. A
 * later change comes from Settings, in an event handler, and finds this equal.
 */
export function PreferredLanguage({ children }: { children: ReactNode }) {
  const [choice] = useDevicePref('language');
  const wanted = resolveLanguage(choice);
  if (i18n.language !== wanted) void i18n.changeLanguage(wanted);
  return <>{children}</>;
}
