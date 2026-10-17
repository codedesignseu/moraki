import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import type { TileColour } from './IconCircle';
import { IconCircle } from './IconCircle';

export type { TileColour } from './IconCircle';

type Props = {
  colour: TileColour;
  icon: IconName;
  title: string;
  /** One line under the name, e.g. "Last 21:40". */
  detail?: string | undefined;
  onPress: () => void;
  /** The button's name, e.g. "Log feed". The detail is read as its value. */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * G activity tile (tabs/home): centred, the icon in a 58 card-colour circle
 * with a small dark "+" badge, the name and one detail line. The whole tile
 * is one button, so the "+" is drawn, not a second target. 132 high, and it
 * grows when the text is large.
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
  const fill = theme.palette[colour];
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(detail ? { accessibilityValue: { text: detail } } : {})}
      style={({ pressed }) => [s.tile, { backgroundColor: fill }, pressed && s.pressed]}
    >
      <View>
        <IconCircle icon={icon} size="tile" />
        <View style={[s.plus, { borderColor: fill }]}>
          <Icon
            name="plus"
            size={theme.size.plusIcon}
            color={theme.palette.onButtonPrimary}
            testID="activity-tile-plus"
          />
        </View>
      </View>
      <Text style={[theme.type.tileLabel, s.text]}>{title}</Text>
      {detail ? <Text style={[theme.type.tileDetail, s.detail]}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      minHeight: t.size.tile,
      borderRadius: t.radius.tile,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.tile,
    },
    pressed: { opacity: t.opacity.pressed },
    plus: {
      position: 'absolute',
      right: -t.size.plusBadgeOffset,
      bottom: -t.size.plusBadgeOffset,
      width: t.size.plusBadge,
      height: t.size.plusBadge,
      borderRadius: t.radius.pill,
      borderWidth: t.size.borderThick,
      backgroundColor: t.palette.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { color: t.palette.ink, textAlign: 'center' },
    detail: { color: t.palette.textSoft, textAlign: 'center' },
  });
