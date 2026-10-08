import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { PaletteName } from '../tokens';
import { Icon } from './Icon';

type Props = {
  title: string;
  detail?: string | undefined;
  /** Icon in a round badge at the start. */
  icon?: IconName;
  /** Badge fill; a tile colour or chip. */
  badge?: Extract<PaletteName, 'feed' | 'sleep' | 'diaper' | 'pump' | 'chip' | 'selected'>;
  /** Content at the end, e.g. an IconButton or a value. */
  trailing?: ReactNode;
  /** Pressable rows show a › at the end unless `trailing` is given. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Row inside a grouped card: no own background or corners. */
  grouped?: boolean;
  testID?: string;
};

/** Sage list row (corner 26): badge, title, detail and an end slot. */
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
      {icon ? (
        <View style={[s.badge, { backgroundColor: theme.palette[badge] }]}>
          <Icon name={icon} />
        </View>
      ) : null}
      <View style={s.text}>
        <Text style={theme.type.rowTitle}>{title}</Text>
        {detail ? <Text style={[theme.type.detail, s.detail]}>{detail}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="forward" color={theme.palette.textSoft} /> : null)}
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
      minHeight: t.size.touchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
    },
    standalone: { backgroundColor: t.palette.card, borderRadius: t.radius.card },
    pressed: { opacity: t.opacity.pressed },
    badge: {
      width: t.size.rowBadge,
      height: t.size.rowBadge,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    detail: { color: t.palette.textSoft },
  });
