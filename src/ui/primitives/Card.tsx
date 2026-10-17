import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GlyphName, IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { CircleTone } from './IconCircle';
import { IconCircle } from './IconCircle';

/**
 * Card fills: white, chip, a tile colour for a card that stands out, or
 * `warning` (butter by day) for a card that needs attention, never for a
 * health number.
 */
export type CardTone = 'card' | 'chip' | 'feed' | 'sleep' | 'diaper' | 'pump' | 'warning';

type Props = {
  children?: ReactNode;
  tone?: CardTone;
  /** `hero`: the Home cards' 28 corner. Default: 26 (G screens). */
  variant?: 'default' | 'hero';
  /**
   * An icon in a round badge at the start of the card's first line, beside
   * `message` (G warning cards: tabs/settings, account/about; the duplicate
   * card on tabs/home-states).
   */
  icon?: IconName | GlyphName;
  /** The badge's fill. Defaults to the card colour, as on a warning card. */
  iconTone?: CircleTone;
  /** The card's one line, beside the icon. The caller's copy. */
  message?: string;
  testID?: string;
};

/** Container for a block of content (G card: corner 26, padding 16 by 18). */
export function Card({
  children,
  tone = 'card',
  variant = 'default',
  icon,
  iconTone = 'card',
  message,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    // One flat style object: callers that read the card's backgroundColor see it directly.
    <View
      style={{
        ...s.card,
        ...(variant === 'hero' && s.hero),
        backgroundColor: theme.palette[tone],
      }}
      testID={testID}
    >
      {icon || message ? (
        <View style={s.lead}>
          {icon ? <IconCircle icon={icon} tone={iconTone} /> : null}
          {message ? <Text style={[theme.type.lead, s.message]}>{message}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: t.radius.card,
      paddingVertical: t.spacing.lg,
      paddingHorizontal: t.spacing.screenEdge,
      gap: t.spacing.md,
    },
    hero: { borderRadius: t.radius.hero },
    lead: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md },
    // Centres a one-line message on the badge; longer text runs down from it.
    message: { flex: 1, paddingTop: t.spacing.sm },
  });
