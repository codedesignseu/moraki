import { StyleSheet, View } from 'react-native';

import type { GlyphName, IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { TileColour } from './ActivityTile';
import { Icon } from './Icon';

/** The circle's fill: a tile colour, or the card or chip colour. */
export type CircleTone = TileColour | 'card' | 'chip';

/**
 * By where it sits: `row` 40 (list rows, warning cards), `card` 44 (the
 * duplicate card), `sheet` 46 (sheet header), `control` 48 (appointment
 * card), `tile` 58 (activity tile), `empty` 64 (empty state).
 */
export type CircleSize = 'row' | 'card' | 'sheet' | 'control' | 'tile' | 'empty';

type Props = {
  icon: IconName | GlyphName;
  tone?: CircleTone;
  size?: CircleSize;
  /** `soft` for an empty state's quiet icon; `ink` (default) otherwise. */
  iconColour?: 'ink' | 'soft';
  testID?: string;
};

const SIZE = {
  row: 'circleRow',
  card: 'circleCard',
  sheet: 'circleSheet',
  control: 'circleControl',
  tile: 'circleTile',
  empty: 'circleEmpty',
} as const satisfies Record<CircleSize, keyof Theme['size']>;

/** A round badge with one icon at half its size (G: every screen). Decorative. */
export function IconCircle({
  icon,
  tone = 'card',
  size = 'row',
  iconColour = 'ink',
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const side = theme.size[SIZE[size]];
  return (
    <View
      testID={testID}
      style={[s.circle, { width: side, height: side, backgroundColor: theme.palette[tone] }]}
    >
      <Icon
        name={icon}
        size={Math.round(side / 2)}
        color={iconColour === 'soft' ? theme.palette.textSoft : theme.palette.ink}
      />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    circle: {
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });
