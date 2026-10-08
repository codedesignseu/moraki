import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { TileColour } from './ActivityTile';
import { Icon } from './Icon';

type Props = {
  icon: IconName;
  colour: TileColour;
  title: string;
  body?: string | undefined;
  /** At most one button, as the design shows: one warm line, one button. */
  action?: ReactNode;
  testID?: string;
};

/** Sage empty state: a picture tile with the icon, a title, a line and one action. */
export function EmptyState({ icon, colour, title, body, action, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.card} testID={testID}>
      <View style={[s.art, { backgroundColor: theme.palette[colour] }]}>
        <Icon name={icon} size={theme.size.iconHero} color={theme.palette.onTile} />
      </View>
      <View style={s.text}>
        <Text style={theme.type.heading} accessibilityRole="header">
          {title}
        </Text>
        {body ? <Text style={[theme.type.body, s.body]}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.palette.card,
      borderRadius: t.radius.tile,
      padding: t.spacing.xl,
      gap: t.spacing.lg,
    },
    art: {
      minHeight: t.size.emptyArt,
      borderRadius: t.radius.tile,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { gap: t.spacing.sm },
    body: { color: t.palette.textSoft },
  });
