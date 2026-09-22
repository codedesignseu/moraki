import type { ReactNode } from 'react';

import { useDevicePref } from '@/db/react';
import type { NightMode } from '@/domain/time/night';
import { ThemeProvider } from '@/ui/theme';

import { useNightScheme } from './useNightScheme';

/** Themes its children for `mode`, switching live at 21:00 and 06:00 in auto. */
export function NightModeTheme({ mode, children }: { mode: NightMode; children: ReactNode }) {
  return <ThemeProvider scheme={useNightScheme(mode)}>{children}</ThemeProvider>;
}

/** Themes its children by this phone's night mode setting (P1-16). */
export function PreferredNightModeTheme({ children }: { children: ReactNode }) {
  const [mode] = useDevicePref('nightMode');
  return <NightModeTheme mode={mode}>{children}</NightModeTheme>;
}
