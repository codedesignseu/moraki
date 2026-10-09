import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type TileColour = 'feed' | 'sleep' | 'diaper' | 'pump';

type Props = {
  colour: TileColour;
  icon: IconName;
  title: string;
  detail?: string | undefined;
  onPress: () => void;
  /** The button's name, e.g. "Log feed". The detail is read as its value. */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Sage activity tile (corner 32): name, one line of detail, icon and a round
 * "+". The whole tile is one button, so the "+" is drawn, not a second
 * target. It grows past its 168 height when the text is large.
 */
export function ActivityTile({
  colour,
  icon,
  title,
  detail,
  onPress,
  accessibilityLabel,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(detail ? { accessibilityValue: { text: detail } } : {})}
      style={({ pressed }) => [
        s.tile,
        { backgroundColor: theme.palette[colour] },
        pressed && s.pressed,
      ]}
    >
      <View style={s.text}>
        <Text style={[theme.type.tileTitle, s.title]}>{title}</Text>
        {detail ? <Text style={[theme.type.detail, s.detail]}>{detail}</Text> : null}
      </View>
      <View style={s.footer}>
        <Icon name={icon} size={theme.size.iconTile} color={theme.palette.onTile} />
        <View style={s.plus}>
          <Icon name="plus" color={theme.palette.onTile} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      minHeight: t.size.activityTile,
      borderRadius: t.radius.tile,
      padding: t.spacing.screen,
      justifyContent: 'space-between',
      gap: t.spacing.sm,
    },
    pressed: { opacity: t.opacity.pressed },
    text: { gap: t.spacing.xs },
    title: { color: t.palette.onTile },
    detail: { color: t.palette.onTileSoft },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    plus: {
      width: t.size.iconButton,
      height: t.size.iconButton,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
