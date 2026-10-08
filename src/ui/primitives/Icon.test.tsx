import { render, screen } from '@testing-library/react-native';
import { readdirSync } from 'fs';
import { join } from 'path';

import { GLYPHS, ICONS } from '../icons';
import { ThemeProvider } from '../theme';
import { palette, size } from '../tokens';
import { Icon } from './Icon';

const ROOT = join(__dirname, '..', '..', '..');

describe('Icon', () => {
  it('has one icon for every file in the Sage set, and nothing else', () => {
    const designed = readdirSync(join(ROOT, 'design', 'ui-icons', 'svg'))
      .map((f) => f.replace(/\.svg$/, ''))
      .sort();
    const shipped = readdirSync(join(ROOT, 'assets', 'icons'))
      .map((f) => f.replace(/\.png$/, ''))
      .sort();
    expect(Object.keys(ICONS).sort()).toEqual(designed);
    expect(shipped).toEqual(designed);
  });

  it.each(['light', 'night'] as const)('tints to the %s ink by default', async (scheme) => {
    await render(
      <ThemeProvider scheme={scheme}>
        <Icon name="feed" testID="icon" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveStyle({
      tintColor: palette[scheme].ink,
      width: size.icon,
      height: size.icon,
    });
  });

  it('takes a size and a colour', async () => {
    await render(<Icon name="sleep" size={size.iconButton} color="#123456" testID="icon" />);
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toHaveStyle({
      tintColor: '#123456',
      width: size.iconButton,
    });
  });

  it('is hidden from screen readers unless it carries meaning alone', async () => {
    await render(<Icon name="diaper" testID="quiet" />);
    expect(screen.queryByRole('image')).toBeNull();

    await render(<Icon name="diaper" accessibilityLabel="Diaper" />);
    expect(screen.getByRole('image', { name: 'Diaper' })).toBeTruthy();
  });

  it('draws back, close and the like as glyphs that do not grow with text size', async () => {
    await render(
      <ThemeProvider scheme="night">
        <Icon name="close" testID="glyph" />
      </ThemeProvider>,
    );
    const glyph = screen.getByTestId('glyph', { includeHiddenElements: true });
    expect(glyph).toHaveTextContent(GLYPHS.close);
    expect(glyph.props.allowFontScaling).toBe(false);
    expect(glyph).toHaveStyle({ color: palette.night.ink, fontSize: size.icon });
  });
});
