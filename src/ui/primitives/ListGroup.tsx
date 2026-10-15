import type { ReactNode } from 'react';
import { Children, Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  /** ListRows with `grouped` set. Empty children (false, null) are skipped. */
  children: ReactNode;
  testID?: string;
};

/**
 * Rows grouped in one card with a hairline between them (G: tabs/settings,
 * the Home health and medication card).
 */
export function ListGroup({ children, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const rows = Children.toArray(children);
  return (
    <View style={s.card} testID={testID}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={s.divider} testID="list-divider" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.palette.card,
      borderRadius: t.radius.card,
      paddingVertical: t.spacing.xs,
      paddingHorizontal: t.spacing.screenEdge,
    },
    divider: { height: t.size.borderThin, backgroundColor: t.palette.line },
  });
