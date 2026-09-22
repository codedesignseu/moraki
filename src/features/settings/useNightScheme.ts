import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { nextNightChange, nightScheme, type NightMode } from '@/domain/time/night';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

/**
 * Longest wait between clock checks. The timer normally fires at the next
 * 21:00 or 06:00, but a changed clock or timezone could move that boundary.
 */
export const MAX_NIGHT_CHECK_MS = 60 * 60_000;

/**
 * The palette for `mode`, switched live at 21:00 and 06:00 local while the app
 * is open: a timer wakes at the next boundary, and returning to the foreground
 * re-reads the clock. The timer runs in every mode, so switching to auto is
 * never judged by a stale time.
 */
export function useNightScheme(mode: NightMode): 'night' | 'light' {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      const at = Date.now();
      setNow(at);
      const wait = Math.min(nextNightChange(at, deviceTimeZone()) - at, MAX_NIGHT_CHECK_MS);
      timer = setTimeout(check, wait);
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return nightScheme(mode, now, deviceTimeZone());
}
