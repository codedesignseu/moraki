// Moraki Sage theme. One file for colours, type, spacing and shape.
// Works as is in React Native or Expo. Swap the values here and the whole app follows.

export const palette = {
  day: {
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
    scrim: 'rgba(30, 42, 35, 0.35)',
    feed: '#E4E6CB',
    sleep: '#DAE1E3',
    diaper: '#D4E3DA',
    pump: '#E3DFD1',
    onTile: '#1E2A23',
    onTileSoft: '#3B463F',
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
  },
} as const;

// The logo never changes colour with the theme.
export const logo = { ink: '#2A211C', honey: '#E8A55A', honeyDeep: '#C9802F' } as const;

export const fonts = {
  ui: 'YsabeauInfant',
  wordmark: 'Commissioner',
} as const;

export const type = {
  display:   { fontSize: 54, fontWeight: '800', lineHeight: 54 },
  title:     { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  heading:   { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  tileTitle: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  rowTitle:  { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  body:      { fontSize: 17, fontWeight: '500', lineHeight: 25 },
  detail:    { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  small:     { fontSize: 13, fontWeight: '600', lineHeight: 18 },
} as const;

export const radius = { tile: 32, card: 26, sheet: 32, pill: 999 } as const;
export const space = { screen: 18, xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;
export const size = {
  button: 60, buttonSmall: 50, iconButton: 46, tabBar: 66, tabBarBottomOffset: 30,
  activityTile: 168, minTouch: 44, icon: 24, iconStroke: 1.6,
} as const;

// Night mode turns on automatically from 21:00 to 06:00 unless the parent picks On or Off.
export function isNightTime(date = new Date()) {
  const h = date.getHours();
  return h >= 21 || h < 6;
}

export type ThemeName = keyof typeof palette;
export const theme = (name: ThemeName) => ({ color: palette[name], type, radius, space, size, fonts, logo });
