import { Platform } from 'react-native';

/**
 * Design tokens: the only place in the app that holds colour values,
 * pixel numbers, type sizes and motion timings. Plain data, no components.
 * Every other file styles itself from the theme built on top of this.
 *
 * Two generations live here while the Sage refresh is under way:
 * - `palette`, `type`, `fonts`, `logo` and the Sage entries in `radius`,
 *   `spacing` and `size` come from design/guidelines/tokens/theme.ts
 *   (Sage v1.0). Restyled screens use only these.
 * - `colors` and `typography` are the pre-Sage tokens. Screens not yet
 *   restyled still read them, so they look the same until their turn.
 *   Both go once no screen reads them.
 *
 * Contrast is checked by src/ui/theme/contrast.test.ts, not by eye.
 */

/** Pre-Sage colours. Warm neutrals, one muted sage accent. */
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
    // Dims the screen behind a sheet. Not a text or UI colour.
    scrim: '#2B262166',
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
    scrim: '#0E0C0AB3',
    borderStrong: '#7A7064',
    divider: '#352F29',
  },
} as const;

export type Scheme = keyof typeof colors;
export type ColorName = keyof (typeof colors)['light'];

/**
 * Sage palettes. `light` is the design's day palette; `night` is the
 * 21:00 to 06:00 palette, chosen by the night mode setting.
 */
export const palette = {
  light: {
    background: '#E9EDE6',
    card: '#FFFFFF',
    ink: '#1E2A23',
    textSoft: '#56615A',
    line: '#DCE2D8',
    outline: '#C7CFC3',
    chip: '#E9EDE6',
    selected: '#CFE0D3',
    buttonPrimary: '#1E2A23',
    onButtonPrimary: '#FFFFFF',
    tabBar: '#1E2A23',
    onTabBar: '#FFFFFF',
    tabActive: '#CFE0D3',
    onTabActive: '#1E2A23',
    // Dims the screen behind a sheet. Not a text or UI colour.
    scrim: 'rgba(30, 42, 35, 0.35)',
    feed: '#E4E6CB',
    sleep: '#DAE1E3',
    diaper: '#D4E3DA',
    pump: '#E3DFD1',
    onTile: '#1E2A23',
    onTileSoft: '#3B463F',
    // Form validation only, always with text or an icon. Not in the Sage
    // export: the pre-Sage clay, darkened to pass AA on every Sage surface.
    // Never used to colour a health number (SDD 12.3).
    invalid: '#8E4434',
  },
  night: {
    background: '#131814',
    card: '#1E2520',
    ink: '#E6ECE4',
    textSoft: '#A9B5AB',
    line: '#2A322C',
    outline: '#3A453D',
    chip: '#2A322C',
    selected: '#2E3830',
    buttonPrimary: '#CFE0D3',
    onButtonPrimary: '#131814',
    tabBar: '#CFE0D3',
    onTabBar: '#131814',
    tabActive: '#131814',
    onTabActive: '#E6ECE4',
    scrim: 'rgba(0, 0, 0, 0.6)',
    feed: '#353A28',
    sleep: '#2A3236',
    diaper: '#263630',
    pump: '#353329',
    onTile: '#E6ECE4',
    onTileSoft: '#C2CCC3',
    invalid: '#DDA08F',
  },
} as const satisfies Record<Scheme, Record<string, string>>;

export type PaletteName = keyof (typeof palette)['light'];

/** The logo keeps its own colours in every theme. Never tint it sage. */
export const logo = { ink: '#2A211C', honey: '#E8A55A', honeyDeep: '#C9802F' } as const;

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
  /** Sage: left and right edge of every screen. */
  screen: 18,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  /** Sage: activity tiles. */
  tile: 32,
  /** Sage: cards and list rows. */
  card: 26,
  /** Sage: top corners of a bottom sheet. */
  sheet: 32,
  /** Buttons and chips, fully round. */
  pill: 999,
} as const;

export const size = {
  /** Minimum touch target, SDD section 8. Use for min height and width, never height. */
  touchTarget: 48,
  /** Controls used one-handed while holding a baby (Stepper +/-). */
  touchTargetLarge: 64,
  borderThin: 1,
  borderThick: 2,
  /** Plot height of a bar chart; the tallest bar fills it. */
  chartHeight: 160,
  /** Diameter of one plotted measurement on a point chart. */
  point: 10,
  // Sage sizes. The touch minimum stays touchTarget (48), above the design's 44.
  /** The one main button, and outlined buttons. */
  button: 60,
  buttonSmall: 50,
  iconButton: 46,
  /** Floating tab bar: its height, and its gap above the bottom edge. */
  tabBar: 66,
  tabBarBottomOffset: 30,
  activityTile: 168,
  icon: 24,
} as const;

/** Opacity of a control while it is pressed. */
export const opacity = {
  pressed: 0.7,
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

/**
 * The one UI font. Today the platform system font, so nothing is loaded.
 * A custom font is a one-line change here (and loading it with expo-font).
 */
export const fonts = {
  ui: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
} as const;

/**
 * Sage type scale in sp, weights 500, 600 and 800. Line heights scale with
 * the font, so text grows to 200% without clipping when no container fixes
 * a height.
 */
const uiFont = { fontFamily: fonts.ui } as const;

export const type = {
  display: { ...uiFont, fontSize: 54, lineHeight: 54, fontWeight: '800' },
  title: { ...uiFont, fontSize: 36, lineHeight: 40, fontWeight: '800' },
  heading: { ...uiFont, fontSize: 22, lineHeight: 26, fontWeight: '800' },
  tileTitle: { ...uiFont, fontSize: 20, lineHeight: 24, fontWeight: '800' },
  rowTitle: { ...uiFont, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  body: { ...uiFont, fontSize: 17, lineHeight: 25, fontWeight: '500' },
  detail: { ...uiFont, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  small: { ...uiFont, fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const;

export type TypeStyle = keyof typeof type;

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
