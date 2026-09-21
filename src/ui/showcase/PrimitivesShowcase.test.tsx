import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../tokens';
import { PrimitivesShowcase } from './PrimitivesShowcase';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it('renders every primitive group in every scheme', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PrimitivesShowcase />
    </SafeAreaProvider>,
  );
  const schemes = Object.keys(colors) as (keyof typeof colors)[];
  for (const scheme of schemes) {
    expect(screen.getByRole('header', { name: scheme })).toHaveStyle({
      color: colors[scheme].text,
    });
  }
  for (const group of ['TimerText', 'Button', 'Stepper', 'Segmented', 'Chip', 'Card', 'Sheet']) {
    expect(screen.getAllByRole('header', { name: group })).toHaveLength(schemes.length);
  }
});
