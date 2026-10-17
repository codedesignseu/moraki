import { StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  /** Already formatted, e.g. `2 h 18 min`. Formatting is domain logic and copy, not UI. */
  text: string;
  /** Spoken form, e.g. "2 hours 18 minutes". Defaults to `text`. */
  accessibilityLabel?: string;
  /**
   * `display` (default): the 54 running timer, centred in its line.
   * `hero`: the Home hero's 38 number, from the start of its line (G tabs/home).
   */
  variant?: 'display' | 'hero';
};

/**
 * The large elapsed-time display. Tabular figures keep digits the same width,
 * the text fills its line so a change in length never moves anything around
 * it, and it stays on one line, shrinking rather than wrapping at very large
 * font scales.
 */
export function TimerText({ text, accessibilityLabel, variant = 'display' }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel ?? text}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={
        variant === 'hero' ? [theme.type.heroNumber, s.timer, s.hero] : [theme.text.timer, s.timer]
      }
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
    hero: { textAlign: 'left', fontVariant: ['tabular-nums'] },
  });
