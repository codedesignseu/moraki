import { useTheme } from './ThemeProvider';

/**
 * Screen options for a log or edit sheet (decision G1): the native form
 * sheet of react-native-screens, with G's 32 top corners, on the card
 * colour, swiped down to close. The native header and grabber are off; each
 * sheet draws SheetHandle and SheetHeader itself, as every G sheet does.
 *
 * One detent, the full height ([1]), for every sheet. `fitToContents` would
 * suit the short diaper and sleep sheets, but their bodies scroll
 * (ScrollView), and a scrolling body has no fixed height for the sheet to
 * fit to. Revisit when those bodies are restyled (MAPPING_G steps 10, 11).
 */
export function useSheetOptions() {
  const { palette, radius } = useTheme();
  return {
    presentation: 'formSheet' as const,
    headerShown: false,
    sheetAllowedDetents: [1],
    sheetCornerRadius: radius.sheet,
    sheetGrabberVisible: false,
    contentStyle: { backgroundColor: palette.card },
  };
}
