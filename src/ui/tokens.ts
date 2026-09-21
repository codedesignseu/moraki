/**
 * Design tokens: the only place in the app that holds colour values,
 * pixel numbers, type sizes and motion timings. Plain data, no components.
 * Every other file styles itself from the theme built on top of this.
 *
 * Direction: calm, warm, quiet. Warm neutrals, one muted sage accent.
 * No pure white, no saturated primaries, no gradients.
 * Contrast is checked by src/ui/theme/contrast.test.ts, not by eye.
 */

export const colors = {
  light: {
    background: '#F4EFE7',
    surface: '#FAF6F0',
    surfaceSunken: '#EAE3D8',
    text: '#2B2621',
    textMuted: '#5E564C',
    accent: '#4A6550',
    accentPressed: '#3C5442',
    accentSubtle: '#DCE4D9',
    onAccent: '#FAF6F0',
    surfacePressed: '#E3DBCE',
    // Form validation only (a value out of range, a required choice missing).
    // Muted clay, not red. Never used to colour a health number (SDD 12.3).
    invalid: '#9A4B3D',
    // Outline of a control when it is the only visual cue (3:1 non-text).
    borderStrong: '#857B6E',
    // Decorative separators only; never the sole indicator of anything.
    divider: '#DDD4C7',
  },
  // Warm dark, not black. Text is dimmed from white to cut glare at night.
  night: {
    background: '#1C1814',
    surface: '#27221D',
    surfaceSunken: '#141210',
    text: '#DDD2C2',
    textMuted: '#AFA392',
    accent: '#9BB59F',
    accentPressed: '#B3C9B6',
    accentSubtle: '#2E3830',
    onAccent: '#1C1814',
    surfacePressed: '#332D27',
    invalid: '#DDA08F',
    borderStrong: '#7A7064',
    divider: '#352F29',
  },
} as const;

export type Scheme = keyof typeof colors;
export type ColorName = keyof (typeof colors)['light'];

/** 4dp grid. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const size = {
  /** Minimum touch target, SDD section 8. Use for min height and width, never height. */
  touchTarget: 48,
  /** Controls used one-handed while holding a baby (Stepper +/-). */
  touchTargetLarge: 64,
  borderThin: 1,
  borderThick: 2,
} as const;

/**
 * Type scale in sp. Line heights scale with the font, so text grows to
 * 200% font scale without clipping as long as no container fixes a height.
 * Family is the platform system font: no font name in the app.
 */
export const typography = {
  // Elapsed-time display. Tabular figures keep every digit the same width.
  timer: { fontSize: 56, lineHeight: 64, fontWeight: '500', fontVariant: ['tabular-nums'] },
  display: { fontSize: 34, lineHeight: 42, fontWeight: '600' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypeVariant = keyof typeof typography;

/** Milliseconds. Short and soft; honour the OS reduce-motion setting when animating. */
export const motion = {
  duration: {
    fast: 120,
    normal: 200,
    slow: 320,
  },
  /** Cubic bezier control points. */
  easing: {
    standard: [0.2, 0, 0, 1],
    exit: [0.4, 0, 1, 1],
  },
} as const;
