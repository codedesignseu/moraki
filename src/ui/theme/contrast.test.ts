import type { ColorName, PaletteName, Scheme } from '../tokens';
import { colors, logo, palette, size } from '../tokens';
import { AA, contrastRatio } from './contrast';

const schemes = Object.keys(colors) as Scheme[];

const backgrounds: ColorName[] = ['background', 'surface', 'surfaceSunken', 'accentSubtle'];

// The pre-Sage names now point at G values; these pairs check the aliases.

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
  expect(size.minTouch).toBeGreaterThanOrEqual(48);
});

describe.each(schemes)('G %s palette', (scheme) => {
  const g = palette[scheme];
  const tiles: PaletteName[] = ['feed', 'sleep', 'diaper', 'pump'];

  // Every foreground that carries text, on every surface it is drawn on.
  const textPairs: [PaletteName, PaletteName][] = [
    ...(['ink', 'textSoft'] as const).flatMap((fg) =>
      (['background', 'card', 'chip', 'line', 'navButton', 'warning', ...tiles] as const).map(
        (bg): [PaletteName, PaletteName] => [fg, bg],
      ),
    ),
    ['onSelected', 'selected'],
    ['onButtonPrimary', 'buttonPrimary'],
    ['onToast', 'toast'],
    ['onUndo', 'undo'],
    ['navActiveIcon', 'navActive'],
    ['disabledText', 'disabledFill'],
    ['onTabBar', 'tabBar'],
    ['onTabActive', 'tabActive'],
    ...(['onTile', 'onTileSoft'] as const).flatMap((fg) =>
      tiles.map((bg): [PaletteName, PaletteName] => [fg, bg]),
    ),
    // Validation text on every surface a form field or its message sits on.
    ...(['background', 'card', 'chip', 'errorSurface', ...tiles] as const).map(
      (bg): [PaletteName, PaletteName] => ['error', bg],
    ),
    ...(['background', 'card', 'chip', ...tiles] as const).map((bg): [PaletteName, PaletteName] => [
      'invalid',
      bg,
    ]),
  ];

  it.each(textPairs)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrastRatio(g[fg], g[bg])).toBeGreaterThanOrEqual(AA.text);
  });

  it.each(['background', 'card', 'chip'] as const)(
    'inputBorder on %s meets AA for non-text UI (3:1)',
    (bg) => {
      expect(contrastRatio(g.inputBorder, g[bg])).toBeGreaterThanOrEqual(AA.nonText);
    },
  );

  it('shows the active tab apart from the bar and the other buttons (3:1)', () => {
    expect(contrastRatio(g.navActive, g.navBar)).toBeGreaterThanOrEqual(AA.nonText);
    expect(contrastRatio(g.navActive, g.navButton)).toBeGreaterThanOrEqual(AA.nonText);
    expect(contrastRatio(g.tabActive, g.tabBar)).toBeGreaterThanOrEqual(AA.nonText);
  });

  it('shows the Undo pill apart from the toast (3:1)', () => {
    expect(contrastRatio(g.undo, g.toast)).toBeGreaterThanOrEqual(AA.nonText);
  });

  it('points the kept names at G values', () => {
    expect(g.invalid).toBe(g.error);
    expect(g.tabBar).toBe(g.navBar);
    expect(g.onTabBar).toBe(g.ink);
    expect(g.tabActive).toBe(g.navActive);
    expect(g.onTabActive).toBe(g.navActiveIcon);
    expect(g.onTile).toBe(g.ink);
  });

  it('has the same colour names as the other scheme', () => {
    expect(Object.keys(g).sort()).toEqual(Object.keys(palette.light).sort());
  });
});

it('uses the G day background and tiles', () => {
  expect(palette.light).toMatchObject({
    background: '#F3F2EE',
    feed: '#F7EBC0',
    sleep: '#F4E4DE',
    diaper: '#E1E3F7',
    pump: '#E0EEE7',
  });
});

it('keeps the logo in its own colours', () => {
  expect(logo).toEqual({ ink: '#2A211C', honey: '#E8A55A', honeyDeep: '#C9802F' });
});
