import { useTheme } from './ThemeProvider';

/**
 * Screen options for a log or edit sheet: the iOS page sheet (`modal`), a card
 * that slides up over Home with Home peeking above it and swipe-down to close;
 * on Android a full-screen slide-up. The native header is off: each sheet
 * draws SheetHandle and SheetHeader itself, as every G sheet does.
 *
 * Not the native `formSheet` (decision G1, built in #157): on device (build 8)
 * it laid the sheet's header and body on top of each other, while a page sheet
 * lays out its content like any screen.
 */
export function useSheetOptions() {
  const { palette } = useTheme();
  return {
    presentation: 'modal' as const,
    headerShown: false,
    contentStyle: { backgroundColor: palette.card },
  };
}
