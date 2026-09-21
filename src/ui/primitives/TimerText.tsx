import { StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  /** Already formatted, e.g. `2h 18m`. Formatting is domain logic, not UI. */
  text: string;
  /** Spoken form, e.g. "2 hours 18 minutes". Defaults to `text`. */
  accessibilityLabel?: string;
};

/**
 * The large elapsed-time display. Tabular figures keep digits the same width,
 * the text is centred in a full-width line so a change in length never moves
 * anything around it, and it stays on one line, shrinking rather than wrapping
 * at very large font scales.
 */
export function TimerText({ text, accessibilityLabel }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel ?? text}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[theme.text.timer, s.timer]}
    >
      {text}
    </Text>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    timer: {
      alignSelf: 'stretch',
      textAlign: 'center',
      includeFontPadding: false,
      color: t.colors.text,
    },
  });
