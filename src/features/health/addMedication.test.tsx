import { fireEvent, screen } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

const doses = () => repo.list().filter((e) => e.type === 'medication' && e.deletedAt === null);

async function openFromHome() {
  await renderApp(repo);
  await fireEvent.press(screen.getByRole('button', { name: 'Medication' }));
  await screen.findByRole('button', { name: 'Save' });
}

describe('adding a dose from home', () => {
  it('opens a sheet that saves a new entry, not a record of the last one', async () => {
    await openFromHome();

    await fireEvent.changeText(screen.getByLabelText('Medication name'), 'Calpol');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(doses()).toHaveLength(1);
    expect(doses()[0]?.payload).toMatchObject({ name: 'Calpol' });
  });

  it('adds a second dose hours later, keeping the first', async () => {
    repo.insert({
      type: 'medication',
      occurredAt: NOW - 6 * HOUR,
      payload: { name: 'Calpol', dose: '2.5 ml' },
    });

    await openFromHome();
    // Prefilled from the last dose, and the sheet says so rather than
    // looking like the dose already given (P3-F8).
    expect(screen.getByDisplayValue('Calpol')).toBeOnTheScreen();
    expect(screen.getByText('Add a dose')).toBeOnTheScreen();
    expect(
      screen.getByText('Filled in from the last dose. Change it if this one is different.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(doses()).toHaveLength(2);
    expect(doses().map((e) => e.occurredAt)).toContain(NOW);
  });

  it('keeps Save reachable, below the fields the keyboard covers', async () => {
    await openFromHome();
    // Save is the last element, so the keyboard sits on top of it. The scroll
    // insets itself rather than being padded by a KeyboardAvoidingView, which
    // came up short by the header's height on iOS (P3-F8, then P3-F9).
    expect(screen.getByTestId('medication-sheet')).toHaveProp(
      'automaticallyAdjustKeyboardInsets',
      true,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
  });
});
