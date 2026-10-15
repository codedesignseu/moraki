import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { CircleTone } from './IconCircle';
import { IconCircle } from './IconCircle';

type Props = {
  icon: IconName;
  /** The circle's fill. G draws it in the card colour on the screen background. */
  colour?: CircleTone;
  title: string;
  body?: string | undefined;
  /** At most one button, as the design shows: one warm line, one button. */
  action?: ReactNode;
  testID?: string;
};

/**
 * G empty state (tabs/history-empty, tabs/trends-empty): a 64 circle with a
 * soft icon, a title, one warm line and at most one action, centred.
 */
export function EmptyState({ icon, colour = 'card', title, body, action, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap} testID={testID}>
      <IconCircle icon={icon} tone={colour} size="empty" iconColour="soft" />
      <Text style={[theme.type.emptyTitle, s.centre]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[theme.type.detail, s.body, s.centre]}>{body}</Text> : null}
      {action}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.xl,
      paddingHorizontal: t.spacing.md,
    },
    centre: { textAlign: 'center' },
    body: { color: t.palette.textSoft },
  });
