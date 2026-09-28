import { useLayoutEffect, type ReactNode } from 'react';

import { useDevicePref } from '@/db/react';
import i18n from '@/i18n';

import { resolveLanguage } from './useLanguage';

/**
 * Puts the app in this phone's chosen language before its first screen paints
 * (P4-04). i18next starts in the phone's own language, which is right until
 * someone has chosen otherwise; the choice lives in SQLite, so it is only
 * readable once the database is open.
 *
 * The change runs in a layout effect, not during render: resources are
 * bundled, so it's still synchronous and still lands before the frame is
 * presented, no flash of English — but changing i18n's language mid-render
 * fires react-i18next's `languageChanged` listeners synchronously too,
 * forcing a re-render of *other*, unrelated components (anything else with
 * `useTranslation()`, e.g. `DatabaseGate`) while React is still in the
 * middle of rendering this one. React warns loudly about exactly that
 * ("Cannot update a component while rendering a different component") for
 * good reason — a layout effect runs after commit, so the same change lands
 * just as fast without reaching into a sibling's render.
 */
export function PreferredLanguage({ children }: { children: ReactNode }) {
  const [choice] = useDevicePref('language');
  const wanted = resolveLanguage(choice);
  useLayoutEffect(() => {
    if (i18n.language !== wanted) void i18n.changeLanguage(wanted);
  }, [wanted]);
  return <>{children}</>;
}
