import { Pressable, StyleSheet } from 'react-native';

import type { GlyphName, IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/** Fill behind the icon: card on coloured tiles, chip or line on a card. */
export type IconButtonTone = 'card' | 'chip' | 'line';

type Props = {
  icon: IconName | GlyphName;
  onPress: () => void;
  /** Required: an icon button has no visible text. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  tone?: IconButtonTone;
  /** `regular` 46 (Sage), `large` 48: G's round back and close buttons. */
  size?: 'regular' | 'large';
  disabled?: boolean;
  testID?: string;
};

/**
 * Round icon button: 46 visible (Sage) with the hit area grown to the 48
 * touch target, or 48 (G back and close).
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'card',
  size = 'regular',
  disabled = false,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const side = size === 'large' ? theme.size.circleControl : theme.size.iconButton;
  const slop = Math.max(0, (theme.size.touchTarget - side) / 2);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.base,
        { width: side, height: side, backgroundColor: theme.palette[tone] },
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: t.opacity.pressed },
    disabled: { opacity: t.opacity.pressed },
  });
