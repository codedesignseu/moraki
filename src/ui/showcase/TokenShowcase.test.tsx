import { render, screen } from '@testing-library/react-native';

import { colors, spacing, typography } from '../tokens';
import { TokenShowcase } from './TokenShowcase';

describe('TokenShowcase', () => {
  it('renders every scheme with its own background', async () => {
    await render(<TokenShowcase />);
    for (const scheme of Object.keys(colors) as (keyof typeof colors)[]) {
      const heading = screen.getByRole('header', { name: scheme });
      expect(heading).toHaveStyle({ color: colors[scheme].text });
    }
  });

  it('shows every type variant, colour and spacing step in both themes', async () => {
    await render(<TokenShowcase />);
    const schemeCount = Object.keys(colors).length;
    for (const variant of Object.keys(typography)) {
      expect(screen.getAllByText(variant)).toHaveLength(schemeCount);
    }
    for (const hex of [...Object.values(colors.light), ...Object.values(colors.night)]) {
      expect(screen.getAllByText(new RegExp(hex.replace(/[()]/g, '\\$&'))).length).toBeGreaterThan(
        0,
      );
    }
    for (const [key, value] of Object.entries(spacing)) {
      expect(screen.getAllByText(`${key} ${value}`)).toHaveLength(schemeCount);
    }
  });
});
