import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCaregiverNames, useDevicePref } from '@/db/react';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

/**
 * A log sheet's subtitle (G: "Now · 22:40 · Parent 1"): the time the sheet
 * opened and who is logging. The name is this account's caregiver name, the
 * same one Home's greeting uses; without one the subtitle is just the time.
 */
export function useNowSubtitle(): string {
  const { t } = useTranslation();
  const [openedAt] = useState(Date.now);
  const names = useCaregiverNames();
  const [household] = useDevicePref('accountHousehold');
  const name = household ? (names.get(household.userId) ?? null) : null;
  const time = formatClock(openedAt, deviceTimeZone());
  return name ? t('log.subtitle.named', { time, name }) : t('log.subtitle.now', { time });
}
