import { Image, StyleSheet, Text } from 'react-native';

import type { GlyphName, IconName } from '../icons';
import { GLYPHS, ICONS } from '../icons';
import { useTheme } from '../theme';

type Props = {
  name: IconName | GlyphName;
  /** Width and height in dp. Defaults to the 24 dp icon grid. */
  size?: number;
  /** Defaults to the ink of the active palette, so night mode follows. */
  color?: string;
  /**
   * Only for an icon that stands alone and means something. Most icons sit
   * beside a label or inside a labelled button, and stay hidden from screen
   * readers.
   */
  accessibilityLabel?: string;
  testID?: string;
};

function isGlyph(name: IconName | GlyphName): name is GlyphName {
  return name in GLYPHS;
}

/**
 * One Sage icon, tinted to the theme. The line icons are PNGs tinted with
 * tintColor; back, close and similar controls are text glyphs, as the design
 * draws them. Icons do not grow with the text size: their labels do.
 */
export function Icon({ name, size, color, accessibilityLabel, testID }: Props) {
  const theme = useTheme();
  const side = size ?? theme.size.icon;
  const tint = color ?? theme.palette.ink;
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

  if (isGlyph(name)) {
    return (
      <Text
        {...a11y}
        testID={testID}
        allowFontScaling={false}
        style={[
          theme.type.detail,
          s.glyph,
          { fontSize: side, lineHeight: side, width: side, color: tint },
        ]}
      >
        {GLYPHS[name]}
      </Text>
    );
  }

  return (
    <Image
      {...a11y}
      testID={testID}
      source={ICONS[name]}
      resizeMode="contain"
      style={{ width: side, height: side, tintColor: tint }}
    />
  );
}

const s = StyleSheet.create({
  glyph: { textAlign: 'center' },
});
