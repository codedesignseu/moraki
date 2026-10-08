import type { TextStyle } from 'react-native';

import type { ColorName, PaletteName, Scheme, TypeStyle, TypeVariant } from '../tokens';
import {
  colors,
  fonts,
  logo,
  motion,
  opacity,
  palette,
  radius,
  size,
  spacing,
  type,
  typography,
} from '../tokens';

export type Theme = {
  scheme: Scheme;
  /** Pre-Sage colours, for screens not yet restyled. */
  colors: Record<ColorName, string>;
  /** Sage colours for this scheme. */
  palette: Record<PaletteName, string>;
  logo: typeof logo;
  fonts: typeof fonts;
  spacing: typeof spacing;
  radius: typeof radius;
  size: typeof size;
  opacity: typeof opacity;
  /** Pre-Sage type, for screens not yet restyled. */
  text: Record<TypeVariant, TextStyle>;
  /** Sage type in the UI font, coloured ink. */
  type: Record<TypeStyle, TextStyle>;
  motion: typeof motion;
};

export function buildTheme(scheme: Scheme): Theme {
  const legacy = colors[scheme];
  const sage = palette[scheme];
  const text = Object.fromEntries(
    Object.entries(typography).map(([variant, style]) => [
      variant,
      { ...style, color: legacy.text },
    ]),
  ) as Record<TypeVariant, TextStyle>;
  const sageType = Object.fromEntries(
    Object.entries(type).map(([name, style]) => [name, { ...style, color: sage.ink }]),
  ) as Record<TypeStyle, TextStyle>;

  return {
    scheme,
    colors: legacy,
    palette: sage,
    logo,
    fonts,
    spacing,
    radius,
    size,
    opacity,
    text,
    type: sageType,
    motion,
  };
}

export const themes: Record<Scheme, Theme> = {
  light: buildTheme('light'),
  night: buildTheme('night'),
};
