import { fireEvent, screen } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

/** The stepper's own buttons are hidden from the reader, which owns the row. */
const HIDDEN = { includeHiddenElements: true };

const weights = () => repo.list().filter((e) => e.type === 'weight');
const box = () => screen.getByLabelText('Weight');
const save = () => screen.getByRole('button', { name: 'Save' });

async function openSheet() {
  await renderApp(repo);
  await fireEvent.press(screen.getByRole('button', { name: /Trends/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a weight' }));
  await screen.findByTestId('weight-when');
}

describe('typing a weight off the scale', () => {
  it('saves the number that was typed', async () => {
    await openSheet();
    await fireEvent.changeText(box(), '4120');
    await fireEvent.press(save());

    expect(weights()).toHaveLength(1);
    expect(weights()[0]?.payload).toMatchObject({ grams: 4120 });
  });

  it('reads it however the thousands are written', async () => {
    await openSheet();
    await fireEvent.changeText(box(), '4 120');
    await fireEvent.press(save());

    expect(weights()[0]?.payload).toMatchObject({ grams: 4120 });
  });

  it('will not save half a number, and says what it wants instead', async () => {
    await openSheet();
    await fireEvent.changeText(box(), '41a');

    expect(save()).toBeDisabled();
    expect(screen.getByText('A weight in grams, between 500 and 15000')).toBeOnTheScreen();

    await fireEvent.press(save());
    expect(weights()).toHaveLength(0);
  });

  it('refuses a weight typed in kilograms, and says it wants grams', async () => {
    await openSheet();
    await fireEvent.changeText(box(), '3.6');

    expect(save()).toBeDisabled();
    expect(screen.getByText('A weight in grams, between 500 and 15000')).toBeOnTheScreen();

    await fireEvent.press(save());
    expect(weights()).toHaveLength(0);
  });

  it('will not save one outside what a scale could read', async () => {
    await openSheet();
    await fireEvent.changeText(box(), '41000');

    expect(save()).toBeDisabled();
    await fireEvent.press(save());
    expect(weights()).toHaveLength(0);
  });

  it('keeps the stepper for nudging what was typed', async () => {
    await openSheet();
    await fireEvent.changeText(box(), '4120');
    // The stepper is the fine adjust now, not the way in.
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));

    // What it stepped to is what the box now says, so the two never disagree.
    expect(box().props.value).toBe('4130');
    await fireEvent.press(save());
    expect(weights()[0]?.payload).toMatchObject({ grams: 4130 });
  });
});
