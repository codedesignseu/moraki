import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

/** Sage card fills: white, or a tile colour for a card that stands out. */
export type CardTone = 'card' | 'chip' | 'feed' | 'sleep' | 'diaper' | 'pump';

type Props = {
  children: ReactNode;
  tone?: CardTone;
  testID?: string;
};

/** Container for a block of content (Sage card, corner 26). Layout only, no behaviour. */
export function Card({ children, tone = 'card', testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    // One flat style object, as before the tone existed: callers that read the
    // card's backgroundColor see it directly.
    <View style={{ ...s.card, backgroundColor: theme.palette[tone] }} testID={testID}>
      {children}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.lg,
      gap: t.spacing.md,
    },
  });
