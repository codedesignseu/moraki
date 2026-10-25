/**
 * Design tokens: the only place in the app that holds colour values,
 * pixel numbers, type sizes and motion timings. Plain data, no components.
 * Every other file styles itself from the theme built on top of this.
 *
 * Values come from design/moraki-final-app/tokens/theme.ts (direction G)
 * and, where theme.ts leaves a value out, from the G screens, which win
 * over foundations.html (docs/design/MAPPING_G.md section 1). `colors` and
 * `typography` are the pre-Sage names, pointing at G values; the screen
 * steps of MAPPING_G section 8 move their readers off them.
 *
 * Contrast is checked by src/ui/theme/contrast.test.ts, not by eye.
 */

export type Scheme = 'light' | 'night';

/**
 * Direction G palettes (design/moraki-final-app/tokens/theme.ts, "Faded
 * Stone"). `light` is the design's `day`; `night` is the 21:00 to 06:00
 * palette, chosen by the night mode setting.
 *
 * Three groups per scheme:
 * - G: every name in the design's theme.ts, with the design's value.
 * - Screen-only: values the screens use that theme.ts leaves out, each
 *   with the screen it came from.
 * - Kept names: pre-G names screens still read (onTile,
 *   invalid ...), pointed at G values. The screen and primitive steps of
 *   docs/design/MAPPING_G.md section 8 move their readers to the G names and
 *   remove them (tiles: step 8; invalid: step 4).
 */
export const palette = {
  light: {
    // G
    background: '#F3F2EE',
    card: '#FFFFFF',
    ink: '#161412',
    textSoft: '#5C5852',
    line: '#E4E2DA',
    outline: '#CFCCC3',
    chip: '#F3F2EE',
    // A control's selected state (chips, segments). Text and icons on it use onSelected.
    selected: '#161412',
    onSelected: '#FFFFFF',
    buttonPrimary: '#161412',
    onButtonPrimary: '#FFFFFF',
    navBar: '#FFFFFF',
    navButton: '#F3F2EE',
    navActive: '#161412',
    navActiveIcon: '#FFFFFF',
    // Edge of a text input, at least 3:1 on card, chip and background (WCAG 1.4.11).
    inputBorder: '#7C7973',
    // Form validation only, always with text or an icon; never on a health
    // number (SDD 12.3).
    error: '#8E4434',
    errorSurface: '#F7E3DD',
    feed: '#F7EBC0',
    sleep: '#F4E4DE',
    diaper: '#E1E3F7',
    pump: '#E0EEE7',
    // Decorative circle on the Home hero card. Never behind text.
    heroCircle: '#F1E1A8',
    disabledFill: '#E4E2DA',
    disabledText: '#5C5852',
    toast: '#161412',
    onToast: '#FFFFFF',
    undo: '#F7EBC0',
    onUndo: '#161412',
    warning: '#F7EBC0',
    // Dims the screen behind a sheet. Not a text or UI colour.
    scrim: 'rgba(22,20,18,0.35)',
    skeleton: '#E4E2DA',
    // The logo's mark colour on this scheme (honey deep by day).
    logo: '#C9802F',
    // Screen-only. Bars on Trends (tabs/trends): a deeper step of the tile
    // colours so short bars stay visible on white. Each bar has its value above it.
    chartFeed: '#E9CF7A',
    chartSleep: '#E3BFB2',
    // Screen-only. A switch that is on (tabs/settings).
    switchOn: '#34A853',
    // Screen-only. The floating tab bar's shadow (every tab file); see `shadow.nav`.
    navShadow: 'rgba(22,20,18,0.10)',
    // Kept names (see above).
    onTile: '#161412',
    onTileSoft: '#3E3A35',
    invalid: '#8E4434',
  },
  night: {
    // G
    background: '#171411',
    card: '#23201C',
    ink: '#F1EAE0',
    // G draws #B8AD9F, which is 4.35:1 on the night feed tile where Home
    // draws its hero detail line. The nearest lighter step that passes AA
    // (4.5:1) is used; see docs/design/REVIEW_NOTES_G.md.
    textSoft: '#BBB0A2',
    line: '#34302B',
    outline: '#4A443D',
    chip: '#2C2823',
    // A control's selected state (chips, segments). Text and icons on it use onSelected.
    selected: '#F1EAE0',
    onSelected: '#171411',
    buttonPrimary: '#F1EAE0',
    onButtonPrimary: '#171411',
    navBar: '#23201C',
    navButton: '#2C2823',
    navActive: '#F1EAE0',
    navActiveIcon: '#171411',
    // Edge of a text input, at least 3:1 on card, chip and background (WCAG 1.4.11).
    inputBorder: '#847E76',
    // Form validation only, always with text or an icon; never on a health
    // number (SDD 12.3).
    error: '#E2A693',
    errorSurface: '#3A2420',
    feed: '#51432A',
    sleep: '#47343A',
    diaper: '#33374D',
    pump: '#2F4238',
    // Decorative circle on the Home hero card. Never behind text.
    heroCircle: '#5E4F31',
    disabledFill: '#2C2823',
    disabledText: '#B8AD9F',
    toast: '#F1EAE0',
    onToast: '#171411',
    undo: '#171411',
    onUndo: '#F1EAE0',
    warning: '#3A3322',
    // Dims the screen behind a sheet. Not a text or UI colour.
    scrim: 'rgba(0,0,0,0.55)',
    skeleton: '#2C2823',
    // The logo's mark colour on this scheme (honey at night).
    logo: '#E8A55A',
    // Screen-only. Bars on Trends (tabs/trends night).
    chartFeed: '#8A7438',
    chartSleep: '#7A5560',
    // Screen-only. A switch that is on (tabs/settings night draws it in ink).
    switchOn: '#F1EAE0',
    // Screen-only. The night tab bar has no shadow (every night tab file).
    navShadow: 'rgba(0,0,0,0)',
    // Kept names (see above).
    onTile: '#F1EAE0',
    onTileSoft: '#D3C8BA',
    invalid: '#E2A693',
  },
} as const satisfies Record<Scheme, Record<string, string>>;

export type PaletteName = keyof (typeof palette)['light'];

type GPalette = (typeof palette)[Scheme];

/**
 * The pre-Sage colour names, now pointing at Sage values. Screens written
 * before the refresh read these; every one of them shows Sage colours, and
 * step 4 of the refresh moves them to the Sage names and removes this map.
 */
function legacyNames(p: GPalette) {
  return {
    background: p.background,
    surface: p.card,
    surfaceSunken: p.chip,
    text: p.ink,
    textMuted: p.textSoft,
    accent: p.buttonPrimary,
    accentPressed: p.buttonPrimary,
    // A soft tint behind dark text (not a selected state): Stone's selected is dark.
    accentSubtle: p.chip,
    onAccent: p.onButtonPrimary,
    surfacePressed: p.line,
    invalid: p.error,
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
  /** G `space.screenEdge`: left and right edge of every screen. */
  screen: 18,
  /** G name for `screen`. */
  screenEdge: 18,
  /** G: inside edge of a text field and of the stepper's grey box. */
  field: 14,
  /** G: inside edge of a segmented control's track. */
  track: 5,
  /** G: side padding of the dark "Log a feed" pill. */
  pill: 20,
  /** G: between the icon, name and detail line of an activity tile (tabs/home). */
  tile: 6,
  /** G: between the Home tiles, and between two cells or buttons side by side in a card. */
  grid: 10,
  /** G: between the blocks of a tab's content (tabs/home: 14). */
  section: 14,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  /** Kept name for `card`. */
  lg: 26,
  /**
   * G: activity tiles and the Home hero. theme.ts says 28 for every card,
   * but the screens draw most cards at 26 and only the hero and tiles at 28
   * (tabs/home); the screens win.
   */
  tile: 28,
  hero: 28,
  /** G: cards and grouped list rows (tabs/home, tabs/settings). */
  card: 26,
  /** G: top corners of a bottom sheet. */
  sheet: 32,
  /** G: the 64-high kind buttons in a sheet. */
  choice: 20,
  /** G: a text field (every sheet and account screen). */
  input: 16,
  /** G: the stepper's grey box (sheets/feed-bottle). */
  stepper: 24,
  /** G: a grey panel inside a sheet (sheets/not-editable). */
  panel: 24,
  /** G: a tinted stat cell (tabs/home "Today" and milk stock). */
  stat: 18,
  /** G: a chart bar's corners (tabs/trends). */
  bar: 10,
  /** G `button` and `chip`: fully round. */
  pill: 999,
  button: 999,
  chip: 999,
} as const;

export const size = {
  /** Minimum touch target, SDD section 8. Use for min height and width, never height. */
  touchTarget: 48,
  /** G name for `touchTarget`. */
  minTouch: 48,
  /** Controls used one-handed while holding a baby (Stepper +/-). */
  touchTargetLarge: 64,
  borderThin: 1,
  /** G: the edge of a text field and of an outlined button. */
  borderControl: 1.5,
  borderThick: 2,
  /** Plot height of a bar chart; the tallest bar fills it. */
  chartHeight: 160,
  /** Diameter of one plotted measurement on a point chart (G tabs/trends: r 7). */
  point: 14,
  /** G: the one main button, and outlined buttons. */
  button: 60,
  buttonSmall: 50,
  /** G: an outlined button ("Invite someone", "Clear filters"). */
  buttonSecondary: 52,
  /** G: a text field, one line. */
  input: 54,
  /** G: a text field that takes several lines (sheets/health-note). */
  inputMultiline: 110,
  /** G: the round - and + of a stepper. A hit slop takes the target to 64. */
  stepperButton: 52,
  /** G: a list row (tabs/settings, tabs/home grouped card). */
  listRow: 60,
  /** G: a row of the weight log (tabs/trends). */
  weightRow: 52,
  /** G: a label and its value in a settings card ("Email", "Consent"; tabs/settings). */
  valueRow: 52,
  /** G: a row of the Trends days table (tabs/trends). */
  tableRow: 44,
  /** G: a History entry row, with its 44 badge (tabs/history). */
  entryRow: 66,
  /** G: the width of an empty state's one button ("Clear filters", tabs/history-filtered). */
  emptyAction: 200,
  /** G: the toast pill; its Undo pill is the 48 touch target (G draws 44). */
  toast: 56,
  /** G: a round icon badge, by where it sits (every screen; the icon is half its size). */
  circleRow: 40,
  circleCard: 44,
  circleSheet: 46,
  circleControl: 48,
  circleTile: 58,
  circleEmpty: 64,
  /** The box of a checkbox (declarations and agreements); the row is the 48 target. */
  checkbox: 26,
  /** G: a chart legend dot (tabs/trends) and the ring of a hollow one. */
  legendDot: 12,
  legendRing: 2.5,
  iconButton: 46,
  /** G: a sheet's grab handle, drawn in the outline colour (every sheet). */
  sheetHandleWidth: 40,
  sheetHandleHeight: 5,
  /** G: a kind choice in a sheet (Bottle, Breast, Mixed). */
  choiceButton: 64,
  /** G: an activity tile on Home and in the diaper sheet. */
  tile: 132,
  /** G floating tab bar: its height, each round button, its gap above the bottom edge. */
  navBar: 68,
  navButton: 52,
  navBottom: 30,
  /** G: the icon inside a tab bar button (22 in every tabs/* file). */
  navIcon: 22,
  /**
   * Bottom padding of a tab's scroll content: the floating bar, its gap to
   * the edge and a screen gap, so the last card scrolls clear above the bar.
   */
  tabBarClearance: 68 + 30 + 24,
  /** Kept name for `tile`; a minimum, so a tile still grows with its text. */
  activityTile: 132,
  icon: 24,
  /** G: an icon inside a button or at the start of a text field. */
  iconField: 20,
  /** G: the alert icon before an error message. */
  iconError: 18,
  /** Icon on an activity tile. */
  iconTile: 42,
  /** Icon on an empty-state tile. */
  iconHero: 84,
  /** Round icon badge at the start of a list row. */
  rowBadge: 46,
  /** Picture tile of an empty state. Grows with its content. */
  emptyArt: 190,
  /** One-tap choice tile in a sheet (wet, dirty, both). Grows with its text. */
  choiceTile: 150,
  /** Status pill ("Now · 05:14"). Grows with its text. */
  pill: 36,
  /** Dot inside a status pill that marks something running. */
  dot: 8,
  /** Height of the Moraki mark in the Home header. */
  logoHeader: 28,
  /**
   * G reports/startup-fail: the mark in a 64 box. The mark fills 62 of the
   * box's 100 units, so the mark itself is 40 high.
   */
  logoStartup: 40,
  /** G Home greeting: the butter circle round the mark, its white edge, and the mark in it. */
  greetingBadge: 52,
  greetingBadgeBorder: 3,
  greetingMark: 18,
  /**
   * G Home hero (tabs/home): the decorative circle (170, set 24 past the
   * top right corner), the feed icon's dark circle (92, 26 from the top and
   * 20 from the right) and the icon in it (40).
   */
  heroCircle: 170,
  heroCircleOffset: 24,
  heroBadge: 92,
  heroBadgeTop: 26,
  heroBadgeRight: 20,
  heroIcon: 40,
  /** G activity tile: the dark "+" badge (26, 4 past the icon circle, a 2 edge in the tile colour). */
  plusBadge: 26,
  plusBadgeOffset: 4,
  plusIcon: 14,
  /**
   * G Home running-sleep card (tabs/home-states): the decorative circle (130,
   * 20 above and 16 right of the corner), the "Stop the sleep timer" pill (54)
   * and its dark stop badge (42).
   */
  sleepCircle: 130,
  sleepCircleTop: 20,
  sleepCircleRight: 16,
  sleepStop: 54,
  sleepStopBadge: 42,
} as const;

/**
 * The floating tab bar's shadow (every G tab file: 0 6px 24px). Its colour
 * is `palette.navShadow`, transparent at night, where the bar has none.
 */
export const shadow = {
  nav: { offsetY: 6, radius: 24, opacity: 1, elevation: 6 },
} as const;

/** Opacity of a control while it is pressed. */
export const opacity = {
  pressed: 0.7,
  /** G Home sleep card: its decorative card-colour circle (tabs/home-states). */
  decoration: 0.45,
} as const;

/**
 * G fonts (design/moraki-final-app/tokens/theme.ts): Comfortaa for headings,
 * sheet titles and big numbers, Manrope for everything else. Both ship
 * Greek. app/_layout.tsx loads each face under these names before the first
 * screen. Each face is its own family, because Android picks the weight from
 * the family name; so a type style sets the family and never a fontWeight.
 */
export const fonts = {
  heading: 'Comfortaa_700Bold',
  text: 'Manrope_500Medium',
  textSemi: 'Manrope_600SemiBold',
  textBold: 'Manrope_700Bold',
  textHeavy: 'Manrope_800ExtraBold',
} as const;

export type FontName = (typeof fonts)[keyof typeof fonts];

const heading = { fontFamily: fonts.heading } as const;
const text = { fontFamily: fonts.text } as const;
const textSemi = { fontFamily: fonts.textSemi } as const;
const textBold = { fontFamily: fonts.textBold } as const;
const textHeavy = { fontFamily: fonts.textHeavy } as const;

/**
 * G type scale in sp. Line heights follow the screens (1.15 for headings,
 * about 1.35 for text) and scale with the font, so text grows to 200%
 * without clipping when no container fixes a height.
 *
 * G names: heroNumber, title, sheetTitle, cardTitle (Comfortaa 700),
 * tileLabel (Manrope 800), body (500), detail and small (600). Kept names,
 * set where screens still read them: display (the 54 running timer),
 * heading (22, the account pages' h1), tileTitle and rowTitle (the
 * primitive and screen steps move them to sheetTitle, cardTitle and
 * tileLabel, then remove them).
 */
export const type = {
  display: { ...heading, fontSize: 54, lineHeight: 62 },
  heroNumber: { ...heading, fontSize: 38, lineHeight: 44 },
  title: { ...heading, fontSize: 30, lineHeight: 35 },
  heading: { ...heading, fontSize: 22, lineHeight: 26 },
  sheetTitle: { ...heading, fontSize: 20, lineHeight: 23 },
  tileTitle: { ...textHeavy, fontSize: 20, lineHeight: 24 },
  rowTitle: { ...textHeavy, fontSize: 18, lineHeight: 23 },
  cardTitle: { ...heading, fontSize: 17, lineHeight: 20 },
  tileLabel: { ...textHeavy, fontSize: 16, lineHeight: 22 },
  body: { ...text, fontSize: 17, lineHeight: 25 },
  /** G: the stepper's number (48) and its compact size in the weight sheet (32). */
  stepperValue: { ...heading, fontSize: 48, lineHeight: 55 },
  stepperValueCompact: { ...heading, fontSize: 32, lineHeight: 37 },
  /** G: a stepper's unit, set beside its number in soft text. */
  stepperUnit: { ...textBold, fontSize: 18, lineHeight: 24 },
  /** G: a list row's title (17/600). */
  rowLabel: { ...textSemi, fontSize: 17, lineHeight: 23 },
  /** G: the line in a warning or notice card, and the toast message (16/600). */
  lead: { ...textSemi, fontSize: 16, lineHeight: 22 },
  /** G: an invite code, large (account/invite, 36/700, spaced 0.06em). */
  code: { ...textBold, fontSize: 36, lineHeight: 44, letterSpacing: 2 },
  /** G: an invite code in a row of open invites (17/700, spaced 0.04em). */
  codeRow: { ...textBold, fontSize: 17, lineHeight: 23, letterSpacing: 0.7 },
  /** G account cards' titles (account/setup "You", "Baby"; 18/700). */
  formTitle: { ...textBold, fontSize: 18, lineHeight: 24 },
  /** G: an empty state's title (tabs/history-empty, 18/700). */
  emptyTitle: { ...textBold, fontSize: 18, lineHeight: 24 },
  /** G: the label of a stat cell (12/700). */
  statLabel: { ...textBold, fontSize: 12, lineHeight: 16 },
  /** G: the main button's label (17/700) and an outlined button's (16/700). */
  button: { ...textBold, fontSize: 17, lineHeight: 23 },
  buttonSecondary: { ...textBold, fontSize: 16, lineHeight: 22 },
  /** G: the unit after a field's value ("g", "°C"). */
  suffix: { ...textSemi, fontSize: 16, lineHeight: 22 },
  detail: { ...textSemi, fontSize: 15, lineHeight: 21 },
  /** G: a selected chip (15/700) and a selected segment or kind button (15/800). */
  detailBold: { ...textBold, fontSize: 15, lineHeight: 21 },
  detailHeavy: { ...textHeavy, fontSize: 15, lineHeight: 21 },
  small: { ...textSemi, fontSize: 13, lineHeight: 18 },
  /** G Home: the greeting (Comfortaa 19). */
  greeting: { ...heading, fontSize: 19, lineHeight: 22 },
  /** G Home: the greeting's second line and the hero's reminder line (14/600). */
  note: { ...textSemi, fontSize: 14, lineHeight: 19 },
  /** G Trends weight card: the Birth / Latest figures (20/700) and a log row's grams (17/700). */
  figure: { ...textBold, fontSize: 20, lineHeight: 26 },
  figureRow: { ...textBold, fontSize: 17, lineHeight: 23 },
  /** G Trends: a chart card's title (18/700, tabs/trends). */
  chartTitle: { ...textBold, fontSize: 18, lineHeight: 24 },
  /** G History: the day label over each day's card (Comfortaa 15). */
  dayLabel: { ...heading, fontSize: 15, lineHeight: 18 },
  /** G History: the time that starts an entry row's title (16/700; the rest is `lead`). */
  entryTime: { ...textBold, fontSize: 16, lineHeight: 22 },
  /** G Home: a tile's "Last 21:40" line (12/600). */
  tileDetail: { ...textSemi, fontSize: 12, lineHeight: 16 },
} as const;

export type TypeStyle = keyof typeof type;

/**
 * The pre-Sage type names, set in the G scale. Like `colors`, the screen
 * steps move their readers off them.
 */
export const typography = {
  // Elapsed-time display. Tabular figures keep every digit the same width.
  timer: { ...type.display, fontVariant: ['tabular-nums'] },
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
