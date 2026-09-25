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
    // The name is prefilled and the sheet says so, rather than looking like
    // the dose already given (P3-F8).
    expect(screen.getByDisplayValue('Calpol')).toBeOnTheScreen();
    expect(screen.getByText('Add a dose')).toBeOnTheScreen();
    expect(
      screen.getByText('Name filled in from the last dose. Enter the amount you are giving now.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(doses()).toHaveLength(2);
    expect(doses().map((e) => e.occurredAt)).toContain(NOW);
  });

  it('leaves the amount empty, so yesterday’s dose is never saved on autopilot', async () => {
    repo.insert({
      type: 'medication',
      occurredAt: NOW - 6 * HOUR,
      payload: { name: 'Calpol', dose: '2.5 ml' },
    });

    await openFromHome();

    // An infant's dose moves with weight and age, so it is typed each time
    // even though the name is not (P3-F12).
    expect(screen.getByDisplayValue('Calpol')).toBeOnTheScreen();
    expect(screen.queryByDisplayValue('2.5 ml')).toBeNull();
    expect(screen.getByLabelText('Dose (optional)').props.value).toBe('');

    await fireEvent.changeText(screen.getByLabelText('Dose (optional)'), '5 ml');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(doses()).toHaveLength(2);
    expect(doses().find((e) => e.occurredAt === NOW)?.payload).toEqual({
      name: 'Calpol',
      dose: '5 ml',
    });
  });

  it('still shows what was saved when an entry is opened to correct it', async () => {
    const given = repo.insert({
      type: 'medication',
      occurredAt: NOW - HOUR,
      payload: { name: 'Calpol', dose: '2.5 ml' },
    });

    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: /History/ }));
    await fireEvent.press(await screen.findByTestId(`history-${given.id}`));

    expect(await screen.findByDisplayValue('2.5 ml')).toBeOnTheScreen();
  });

  it('keeps Save reachable, below the fields the keyboard covers', async () => {
    await openFromHome();
    // The sheet lifts for the keyboard; without that, Save is the last
    // element and sits underneath it (P3-F8, the same fault as P3-F4).
    expect(screen.getByTestId('medication-sheet')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
  });
});
