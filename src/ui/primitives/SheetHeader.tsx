import { StyleSheet, Text, View } from 'react-native';

import type { GlyphName, IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import type { CircleTone } from './IconCircle';
import { IconCircle } from './IconCircle';

/**
 * The sheet's grab handle (every G sheet): 40 × 5 in the outline colour,
 * centred. Drawn here because the native grabber is iOS only and can't take
 * the theme's colour. Decorative: the sheet closes with a swipe or the
 * close button.
 */
export function SheetHandle({ testID }: { testID?: string }) {
  const s = styles(useTheme());
  return (
    <View
      style={s.handle}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

type Props = {
  icon: IconName | GlyphName;
  /** The icon circle's fill, the activity's tile colour. */
  tone: CircleTone;
  title: string;
  /** "Now · 22:40 · Parent 1" (G); later steps fill it. */
  subtitle?: string;
  onClose: () => void;
  /** The close button's name for screen readers, e.g. "Close". */
  closeLabel: string;
  /** Draws the grab handle above the header (default on). */
  handle?: boolean;
  testID?: string;
};

/**
 * The top of a log or edit sheet (sheets/*): the grab handle, then a 46 icon
 * circle in the activity's colour, a 20 Comfortaa title and a 13 soft
 * subtitle on the left, and a round 48 close button on the right.
 */
export function SheetHeader({
  icon,
  tone,
  title,
  subtitle,
  onClose,
  closeLabel,
  handle = true,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap} testID={testID}>
      {handle ? (
        <SheetHandle {...(testID !== undefined && { testID: `${testID}-handle` })} />
      ) : null}
      <View style={s.line}>
        <IconCircle icon={icon} tone={tone} size="sheet" />
        <View style={s.text}>
          <Text accessibilityRole="header" style={theme.type.sheetTitle}>
            {title}
          </Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        <IconButton
          icon="close"
          size="large"
          tone="chip"
          onPress={onClose}
          accessibilityLabel={closeLabel}
        />
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // G: 10 above the handle, 14 below it, 20 at the sides; here the spacing
    // scale's 8 and 12, and the screen edge, so it lines up with the body.
    wrap: {
      paddingTop: t.spacing.sm,
      paddingHorizontal: t.spacing.screen,
      gap: t.spacing.md,
    },
    handle: {
      alignSelf: 'center',
      width: t.size.sheetHandleWidth,
      height: t.size.sheetHandleHeight,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.outline,
    },
    line: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    text: { flex: 1 },
    subtitle: { ...t.type.small, color: t.palette.textSoft },
  });
