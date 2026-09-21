import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { Scheme } from '../tokens';
import type { Theme } from './theme';
import { themes } from './theme';

const ThemeContext = createContext<Theme>(themes.light);

type Props = {
  scheme: Scheme;
  children: ReactNode;
};

/**
 * Supplies the active theme. Which scheme is active (system, forced, or the
 * 21:00 to 06:00 automatic rule) is decided by the caller, not here.
 */
export function ThemeProvider({ scheme, children }: Props) {
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
