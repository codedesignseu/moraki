import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import type { CircleTone } from './IconCircle';
import { IconCircle } from './IconCircle';

type Props = {
  title: string;
  detail?: string | undefined;
  /** Icon in a round badge at the start. */
  icon?: IconName;
  /** Badge fill: a tile colour, chip or card. */
  badge?: CircleTone;
  /** Content at the end, e.g. an IconButton or a value. */
  trailing?: ReactNode;
  /** Pressable rows show a › at the end unless `trailing` is given. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Row inside a grouped card (ListGroup): no own background, corners or side padding. */
  grouped?: boolean;
  testID?: string;
};

/**
 * G list row (foundations, tabs/settings): a 40 icon badge, a 17/600 title,
 * a soft detail line and a chevron when it can be pressed. 60 high.
 */
export function ListRow({
  title,
  detail,
  icon,
  badge = 'chip',
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  grouped = false,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const body = (
    <>
      {icon ? <IconCircle icon={icon} tone={badge} /> : null}
      <View style={s.text}>
        <Text style={theme.type.rowLabel}>{title}</Text>
        {detail ? <Text style={[theme.type.detail, s.detail]}>{detail}</Text> : null}
      </View>
      {trailing ??
        (onPress ? (
          <Icon
            name="chevron"
            size={theme.size.iconField}
            color={theme.palette.textSoft}
            testID="list-row-chevron"
          />
        ) : null)}
    </>
  );
  const rowStyle = [s.row, !grouped && s.standalone];

  if (!onPress) {
    return (
      <View style={rowStyle} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, detail].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [...rowStyle, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: t.size.listRow,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    standalone: {
      paddingHorizontal: t.spacing.screenEdge,
      backgroundColor: t.palette.card,
      borderRadius: t.radius.card,
    },
    pressed: { opacity: t.opacity.pressed },
    text: { flex: 1 },
    detail: { color: t.palette.textSoft },
  });
