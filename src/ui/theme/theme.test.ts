import { nightScheme } from '@/domain/time/night';

import { fonts, palette, type } from '../tokens';
import { buildTheme, themes } from './theme';

const TZ = 'Europe/Nicosia';
// 2026-10-09 in Nicosia (UTC+3): 22:00 and 12:00 local.
const LATE_EVENING = Date.UTC(2026, 9, 9, 19, 0);
const MIDDAY = Date.UTC(2026, 9, 9, 9, 0);

describe('Sage theme', () => {
  it('gives each scheme its own Sage palette', () => {
    expect(themes.light.palette).toEqual(palette.light);
    expect(themes.night.palette).toEqual(palette.night);
  });

  it('sets every Sage type style in the one UI font, coloured ink', () => {
    for (const scheme of ['light', 'night'] as const) {
      const theme = buildTheme(scheme);
      for (const [name, style] of Object.entries(theme.type)) {
        expect(style).toMatchObject({
          ...type[name as keyof typeof type],
          fontFamily: fonts.ui,
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

  it('points the pre-Sage colour names at Sage values', () => {
    for (const scheme of ['light', 'night'] as const) {
      const { colors, palette: sage } = themes[scheme];
      expect(colors.background).toBe(sage.background);
      expect(colors.surface).toBe(sage.card);
      expect(colors.text).toBe(sage.ink);
      expect(colors.textMuted).toBe(sage.textSoft);
      expect(colors.accent).toBe(sage.buttonPrimary);
      expect(colors.onAccent).toBe(sage.onButtonPrimary);
      expect(colors.invalid).toBe(sage.invalid);
    }
  });
});
