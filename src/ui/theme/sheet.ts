import { useTheme } from './ThemeProvider';

/**
 * Screen options for a log or edit sheet: the platform modal, with the
 * sheet, its header and content on the Sage card colour.
 *
 * The design's bottom sheet has 32 top corners. A native formSheet could
 * draw them (sheetCornerRadius), but it could not be checked on devices
 * with the keyboard open and at 200% text, so the modal stays (D5 fallback).
 */
export function useSheetOptions() {
  const { palette } = useTheme();
  return {
    presentation: 'modal' as const,
    contentStyle: { backgroundColor: palette.card },
    headerStyle: { backgroundColor: palette.card },
  };
}
