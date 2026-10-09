import { Platform } from 'react-native';

/**
 * Design tokens: the only place in the app that holds colour values,
 * pixel numbers, type sizes and motion timings. Plain data, no components.
 * Every other file styles itself from the theme built on top of this.
 *
 * Values come from design/guidelines/tokens/theme.ts (Sage v1.0):
 * `palette`, `type`, `fonts`, `logo` and the Sage entries in `radius`,
 * `spacing` and `size`. `colors` and `typography` are the pre-Sage names,
 * now pointing at Sage values; step 4 of the refresh removes them.
 *
 * Contrast is checked by src/ui/theme/contrast.test.ts, not by eye.
 */

export type Scheme = 'light' | 'night';

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
    // Edge of a text input, 3:1 on card, chip and background (WCAG 1.4.11).
    // Not in the Sage export, which draws inputs without an edge.
    inputBorder: '#717E75',
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
    inputBorder: '#7E8B81',
  },
} as const satisfies Record<Scheme, Record<string, string>>;

export type PaletteName = keyof (typeof palette)['light'];

type SagePalette = (typeof palette)[Scheme];

/**
 * The pre-Sage colour names, now pointing at Sage values. Screens written
 * before the refresh read these; every one of them shows Sage colours, and
 * step 4 of the refresh moves them to the Sage names and removes this map.
 */
function legacyNames(p: SagePalette) {
  return {
    background: p.background,
    surface: p.card,
    surfaceSunken: p.chip,
    text: p.ink,
    textMuted: p.textSoft,
    accent: p.buttonPrimary,
    accentPressed: p.buttonPrimary,
    accentSubtle: p.selected,
    onAccent: p.onButtonPrimary,
    surfacePressed: p.line,
    invalid: p.invalid,
    scrim: p.scrim,
    borderStrong: p.inputBorder,
    divider: p.line,
  };
}

export const colors = {
  light: legacyNames(palette.light),
  night: legacyNames(palette.night),
} as const;

export type ColorName = keyof (typeof colors)['light'];

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
  /** Cards; the same as the Sage card corner. */
  lg: 26,
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
  /**
   * Bottom padding of a tab's scroll content: the floating bar, its gap to
   * the edge and a screen gap, so the last card scrolls clear above the bar.
   */
  tabBarClearance: 66 + 30 + 24,
  activityTile: 168,
  icon: 24,
  /** Icon on an activity tile. */
  iconTile: 42,
  /** Icon on an empty-state tile. */
  iconHero: 84,
  /** Round icon badge at the start of a list row. */
  rowBadge: 46,
  /** Tab bar item: a pill the active tab fills. */
  tabItemWidth: 64,
  tabItemHeight: 48,
  /** Picture tile of an empty state. Grows with its content. */
  emptyArt: 190,
  /** One-tap choice tile in a sheet (wet, dirty, both). Grows with its text. */
  choiceTile: 150,
  /** Status pill ("Now · 05:14"). Grows with its text. */
  pill: 36,
  /** Dot inside a status pill that marks something running. */
  dot: 8,
} as const;

/** Opacity of a control while it is pressed. */
export const opacity = {
  pressed: 0.7,
} as const;

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

/**
 * The pre-Sage type names, now set in the Sage scale. Like `colors`, they
 * go in step 4 of the refresh.
 */
export const typography = {
  // Elapsed-time display. Tabular figures keep every digit the same width.
  timer: { ...type.display, lineHeight: 62, fontVariant: ['tabular-nums'] },
  display: type.title,
  title: type.heading,
  heading: type.tileTitle,
  body: type.body,
  bodyStrong: type.rowTitle,
  label: type.detail,
  caption: type.small,
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
