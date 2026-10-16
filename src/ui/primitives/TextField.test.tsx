import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { AA, contrastRatio, ThemeProvider, themes } from '../theme';
import { palette, radius, size } from '../tokens';
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

  it('shows a placeholder in the soft colour while empty', async () => {
    await render(
      <ThemeProvider scheme="light">
        <TextField
          label="Name"
          value=""
          onChangeText={() => {}}
          placeholder="Name of the medicine"
        />
      </ThemeProvider>,
    );
    const input = screen.getByLabelText('Name');
    expect(input.props.placeholder).toBe('Name of the medicine');
    expect(input.props.placeholderTextColor).toBe(palette.light.textSoft);
  });

  it('shows a leading icon and a suffix, and the error prefix', async () => {
    await render(
      <ThemeProvider scheme="light">
        <TextField
          label="Weight"
          value="32400"
          onChangeText={() => {}}
          icon="weight"
          suffix="g"
          invalid
          message="enter a weight between 500 and 10,000 g."
          errorPrefix="Error"
          testID="box"
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('g')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error: enter a weight between 500 and 10,000 g.',
    );
    expect(screen.getByTestId('box')).toHaveStyle({
      borderColor: palette.light.error,
      minHeight: size.input,
      borderRadius: radius.input,
    });
  });

  it('cannot be edited when disabled', async () => {
    await render(<TextField label="Baby" value="Baby" onChangeText={() => {}} disabled />);
    expect(screen.getByLabelText('Baby').props.editable).toBe(false);
  });

  it.each(['light', 'night'] as const)('invalid message meets AA contrast in %s', (scheme) => {
    const { colors } = themes[scheme];
    expect(contrastRatio(colors.invalid, colors.background)).toBeGreaterThanOrEqual(AA.text);
  });
});
