import type { TextStyle } from 'react-native';

import type { ColorName, Scheme, TypeVariant } from '../tokens';
import { colors, motion, radius, size, spacing, typography } from '../tokens';

export type Theme = {
  scheme: Scheme;
  colors: Record<ColorName, string>;
  spacing: typeof spacing;
  radius: typeof radius;
  size: typeof size;
  text: Record<TypeVariant, TextStyle>;
  motion: typeof motion;
};

export function buildTheme(scheme: Scheme): Theme {
  const palette = colors[scheme];
  const text = Object.fromEntries(
    Object.entries(typography).map(([variant, style]) => [
      variant,
      { ...style, color: palette.text },
    ]),
  ) as Record<TypeVariant, TextStyle>;

  return { scheme, colors: palette, spacing, radius, size, text, motion };
}

export const themes: Record<Scheme, Theme> = {
  light: buildTheme('light'),
  night: buildTheme('night'),
};
