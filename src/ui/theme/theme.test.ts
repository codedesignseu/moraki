import { nightScheme } from '@/domain/time/night';

import { fonts, palette, type } from '../tokens';
import { buildTheme, themes } from './theme';

const TZ = 'Europe/Nicosia';
// 2026-10-09 in Nicosia (UTC+3): 22:00 and 12:00 local.
const LATE_EVENING = Date.UTC(2026, 9, 9, 19, 0);
const MIDDAY = Date.UTC(2026, 9, 9, 9, 0);

describe('G theme', () => {
  it('gives each scheme its own G palette', () => {
    expect(themes.light.palette).toEqual(palette.light);
    expect(themes.night.palette).toEqual(palette.night);
  });

  it('sets every G type style in a G font, coloured ink', () => {
    for (const scheme of ['light', 'night'] as const) {
      const theme = buildTheme(scheme);
      for (const [name, style] of Object.entries(theme.type)) {
        expect(style).toMatchObject({
          ...type[name as keyof typeof type],
          color: palette[scheme].ink,
        });
      }
    }
  });

  it.each([
    ['auto', LATE_EVENING, palette.night],
    ['auto', MIDDAY, palette.light],
    ['on', MIDDAY, palette.night],
    ['off', LATE_EVENING, palette.light],
  ] as const)('night mode %s picks the right palette', (mode, now, expected) => {
    expect(themes[nightScheme(mode, now, TZ)].palette).toEqual(expected);
  });

  it('points the pre-Sage colour names at G values', () => {
    for (const scheme of ['light', 'night'] as const) {
      const { colors, palette: sage } = themes[scheme];
      expect(colors.background).toBe(sage.background);
      expect(colors.surface).toBe(sage.card);
      expect(colors.text).toBe(sage.ink);
      expect(colors.textMuted).toBe(sage.textSoft);
      expect(colors.accent).toBe(sage.buttonPrimary);
      expect(colors.onAccent).toBe(sage.onButtonPrimary);
      expect(colors.invalid).toBe(sage.error);
    }
  });

  it('has the G type scale, each weight carried by its family', () => {
    expect(type.heroNumber).toMatchObject({ fontSize: 38, fontFamily: 'Comfortaa_700Bold' });
    expect(type.title).toMatchObject({ fontSize: 30, fontFamily: 'Comfortaa_700Bold' });
    expect(type.sheetTitle).toMatchObject({ fontSize: 20, fontFamily: 'Comfortaa_700Bold' });
    expect(type.cardTitle).toMatchObject({ fontSize: 17, fontFamily: 'Comfortaa_700Bold' });
    expect(type.tileLabel).toMatchObject({ fontSize: 16, fontFamily: 'Manrope_800ExtraBold' });
    expect(type.body).toMatchObject({ fontSize: 17, fontFamily: 'Manrope_500Medium' });
    expect(type.detail).toMatchObject({ fontSize: 15, fontFamily: 'Manrope_600SemiBold' });
    expect(type.small).toMatchObject({ fontSize: 13, fontFamily: 'Manrope_600SemiBold' });
  });

  it('never sets a fontWeight next to a weighted family (Android takes the weight from the name)', () => {
    for (const style of Object.values(type)) {
      expect(style).not.toHaveProperty('fontWeight');
      expect(Object.values(fonts)).toContain(style.fontFamily);
    }
  });
});
