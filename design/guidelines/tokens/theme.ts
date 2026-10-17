// Moraki Stone theme (Stone colours on the Sage layout). One file for colours, type, spacing and shape.
// Works as is in React Native or Expo. Swap the values here and the whole app follows.

export const palette = {
  day: {
    background: '#EEEDE7',
    card: '#FFFFFF',
    ink: '#161412',
    textSoft: '#5C5852',
    line: '#E4E2DA',
    outline: '#CFCCC3',
    chip: '#EEEDE7',
    selected: '#161412',
    onSelected: '#FFFFFF',
    buttonPrimary: '#161412',
    onButtonPrimary: '#FFFFFF',
    tabBar: '#161412',
    onTabBar: '#FFFFFF',
    tabActive: '#FFFFFF',
    onTabActive: '#161412',
    scrim: 'rgba(22, 20, 18, 0.35)',
    feed: '#F3DF8C',
    sleep: '#ECD3CA',
    diaper: '#CDD1F2',
    pump: '#CDE5DA',
    onTile: '#161412',
    onTileSoft: '#3E3A35',
  },
  night: {
    background: '#171411',
    card: '#23201C',
    ink: '#F1EAE0',
    textSoft: '#B8AD9F',
    line: '#34302B',
    outline: '#4A443D',
    chip: '#2C2823',
    selected: '#3A352F',
    onSelected: '#F1EAE0',
    buttonPrimary: '#F1EAE0',
    onButtonPrimary: '#171411',
    tabBar: '#F1EAE0',
    onTabBar: '#171411',
    tabActive: '#171411',
    onTabActive: '#F1EAE0',
    scrim: 'rgba(0, 0, 0, 0.6)',
    feed: '#51432A',
    sleep: '#47343A',
    diaper: '#33374D',
    pump: '#2F4238',
    onTile: '#F1EAE0',
    onTileSoft: '#D3C8BA',
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
