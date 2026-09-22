import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { AA, contrastRatio, ThemeProvider, themes } from '../theme';
import { TextField } from './TextField';

function Harness({ maxLength, invalid }: { maxLength?: number; invalid?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <ThemeProvider scheme="light">
      <TextField
        label="Note"
        value={value}
        onChangeText={setValue}
        maxLength={maxLength}
        hint={`${value.length} of ${maxLength ?? '∞'}`}
        invalid={invalid}
        message="Add a note"
      />
    </ThemeProvider>
  );
}

describe('TextField', () => {
  it('is named by its label and passes typed text through', async () => {
    await render(<Harness />);
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Warm to touch');
    expect(screen.getByLabelText('Note').props.value).toBe('Warm to touch');
  });

  it('cuts input to maxLength however it arrives', async () => {
    await render(<Harness maxLength={5} />);
    await fireEvent.changeText(screen.getByLabelText('Note'), 'abcdefgh');
    expect(screen.getByLabelText('Note').props.value).toBe('abcde');
    expect(screen.getByText('5 of 5')).toBeOnTheScreen();
  });

  it('shows the message as an alert instead of the hint when invalid', async () => {
    await render(<Harness maxLength={5} invalid />);
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note');
    expect(screen.queryByText('0 of 5')).toBeNull();
  });

  it.each(['light', 'night'] as const)('invalid message meets AA contrast in %s', (scheme) => {
    const { colors } = themes[scheme];
    expect(contrastRatio(colors.invalid, colors.background)).toBeGreaterThanOrEqual(AA.text);
  });
});
