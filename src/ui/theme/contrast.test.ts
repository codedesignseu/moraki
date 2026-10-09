import type { ColorName, PaletteName, Scheme } from '../tokens';
import { colors, logo, palette, size } from '../tokens';
import { AA, contrastRatio } from './contrast';

const schemes = Object.keys(colors) as Scheme[];

const backgrounds: ColorName[] = ['background', 'surface', 'surfaceSunken', 'accentSubtle'];

// The pre-Sage names now point at Sage values; these pairs check the aliases.

// Every foreground that carries text, on every surface it can sit on.
const textPairs: [ColorName, ColorName][] = [
  ...(['text', 'textMuted', 'accent'] as const).flatMap((fg) =>
    backgrounds.map((bg): [ColorName, ColorName] => [fg, bg]),
  ),
  ['onAccent', 'accent'],
  ['onAccent', 'accentPressed'],
  ...(['text', 'textMuted', 'accent'] as const).map((fg): [ColorName, ColorName] => [
    fg,
    'surfacePressed',
  ]),
  ...(['background', 'surface', 'surfaceSunken'] as const).map((bg): [ColorName, ColorName] => [
    'invalid',
    bg,
  ]),
];

// Control outlines that are the only cue for a control's edge.
const nonTextPairs: [ColorName, ColorName][] = [
  ['borderStrong', 'background'],
  ['borderStrong', 'surface'],
  ['borderStrong', 'surfaceSunken'],
  ['accent', 'surface'],
  ['invalid', 'surface'],
];

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#5E564C', '#5E564C')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#2B2621', '#F4EFE7')).toBeCloseTo(contrastRatio('#F4EFE7', '#2B2621'));
  });
});

describe.each(schemes)('%s theme', (scheme) => {
  const palette = colors[scheme];

  it.each(textPairs)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(AA.text);
  });

  it.each(nonTextPairs)('%s on %s meets AA for non-text UI (3:1)', (fg, bg) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(AA.nonText);
  });

  it('uses no pure black', () => {
    // Sage cards are pure white by design; pure black stays out.
    for (const value of Object.values(palette)) {
      expect(value.toUpperCase()).not.toBe('#000000');
    }
  });
});

it('touch target token is at least 48dp', () => {
  expect(size.touchTarget).toBeGreaterThanOrEqual(48);
});

describe.each(schemes)('Stone %s palette', (scheme) => {
  const stone = palette[scheme];
  const tiles: PaletteName[] = ['feed', 'sleep', 'diaper', 'pump'];

  // Every foreground that carries text, on every surface it is drawn on.
  const textPairs: [PaletteName, PaletteName][] = [
    ...(['ink', 'textSoft'] as const).flatMap((fg) =>
      (['background', 'card', 'chip', 'line'] as const).map((bg): [PaletteName, PaletteName] => [
        fg,
        bg,
      ]),
    ),
    ['onSelected', 'selected'],
    ['onButtonPrimary', 'buttonPrimary'],
    ['onTabBar', 'tabBar'],
    ['onTabActive', 'tabActive'],
    ...(['onTile', 'onTileSoft'] as const).flatMap((fg) =>
      tiles.map((bg): [PaletteName, PaletteName] => [fg, bg]),
    ),
    // Validation text on every surface a form field or its message sits on.
    ...(['background', 'card', 'chip', ...tiles] as const).map((bg): [PaletteName, PaletteName] => [
      'invalid',
      bg,
    ]),
  ];

  it.each(textPairs)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrastRatio(stone[fg], stone[bg])).toBeGreaterThanOrEqual(AA.text);
  });

  it.each(['background', 'card', 'chip'] as const)(
    'inputBorder on %s meets AA for non-text UI (3:1)',
    (bg) => {
      expect(contrastRatio(stone.inputBorder, stone[bg])).toBeGreaterThanOrEqual(AA.nonText);
    },
  );

  it('shows the active tab apart from the tab bar (3:1)', () => {
    expect(contrastRatio(stone.tabActive, stone.tabBar)).toBeGreaterThanOrEqual(AA.nonText);
  });

  it('marks a selected chip with an ink ring that stands out from the card (3:1)', () => {
    expect(contrastRatio(stone.ink, stone.card)).toBeGreaterThanOrEqual(AA.nonText);
  });

  it('has the same colour names as the other scheme', () => {
    expect(Object.keys(stone).sort()).toEqual(Object.keys(palette.light).sort());
  });
});

it('keeps the logo in its own colours', () => {
  expect(logo).toEqual({ ink: '#2A211C', honey: '#E8A55A', honeyDeep: '#C9802F' });
});
