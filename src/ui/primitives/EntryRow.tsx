import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import type { CircleTone } from './IconCircle';
import { IconCircle } from './IconCircle';

type Props = {
  /** The whole title, already worded, e.g. "21:40 · Bottle, 90 ml formula". */
  title: string;
  /** The start of `title` set in bold, e.g. the time. Ignored if the title doesn't start with it. */
  lead?: string | undefined;
  /** The line underneath, e.g. who logged it. */
  detail?: string | undefined;
  /** The activity's badge icon and its fill. */
  icon: IconName;
  tone: CircleTone;
  testID?: string;
  /** Makes the row a button, e.g. to open the entry for editing. Shows a chevron. */
  onPress?: () => void;
  /** Screen reader hint when the row is a button. */
  accessibilityHint?: string;
};

/**
 * G History row (tabs/history): a 44 type badge, "time · summary" with the
 * time in bold, the person underneath and a chevron when it opens. 66 high.
 * Rows sit in a card; the screen draws the hairlines between them.
 */
export function EntryRow({
  title,
  lead,
  detail,
  icon,
  tone,
  testID,
  onPress,
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const rest = lead && title.startsWith(lead) ? title.slice(lead.length) : null;
  const content = (
    <>
      <IconCircle icon={icon} tone={tone} size="card" />
      <View style={s.text}>
        <Text style={[theme.type.lead, s.ink]}>
          {rest === null ? (
            title
          ) : (
            <>
              <Text style={theme.type.entryTime}>{lead}</Text>
              {rest}
            </>
          )}
        </Text>
        {detail ? <Text style={[theme.type.small, s.soft]}>{detail}</Text> : null}
      </View>
      {onPress ? (
        <Icon name="chevron" size={theme.size.iconField} color={theme.palette.textSoft} />
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={s.row} testID={testID} accessible>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: t.size.entryRow,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    text: { flex: 1 },
    ink: { color: t.palette.ink },
    soft: { color: t.palette.textSoft },
    pressed: { opacity: t.opacity.pressed },
  });
