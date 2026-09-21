import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  children: ReactNode;
  testID?: string;
};

/** Container for a home screen block. Layout only, no behaviour. */
export function Card({ children, testID }: Props) {
  const s = styles(useTheme());
  return (
    <View style={s.card} testID={testID}>
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
