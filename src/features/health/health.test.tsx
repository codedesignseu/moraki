import { fireEvent, screen } from 'expo-router/testing-library';

import type { Event } from '@/domain/activities';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 in Nicosia
const HOUR = 3_600_000;

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

const ofType = (type: string) =>
  h.repo.list().filter((e) => e.type === type) as Event<Record<string, unknown>>[];
const outboxCount = () =>
  Number(h.mem.sqlite.exec('select count(*) from outbox')[0]?.values[0]?.[0]);

async function open(action: string) {
  await renderApp(h.repo);
  await fireEvent.press(screen.getByRole('button', { name: action }));
}
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);
const save = () => fireEvent.press(screen.getByRole('button', { name: 'Save' }));

describe('health note sheet', () => {
  it('saves a note with a temperature and tags, and returns home showing it', async () => {
    await open('Health note');
    expect(screen.getByRole('header', { name: 'Health note' })).toBeOnTheScreen();
    expect(screen.getByText('Now · 12:00')).toBeOnTheScreen();
    expect(screen.getByTestId('health-when-value')).toHaveTextContent('Today, 12:00 · now');
    expect(screen.getByText('°C')).toBeOnTheScreen();
    await type('Note', 'Warm to touch after nap');
    await type('Temperature', '37,8');
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Cough' }));
    await save();

    expect(ofType('health')).toEqual([
      expect.objectContaining({
        occurredAt: NOW,
        payload: { note: 'Warm to touch after nap', temp_c: 37.8, tags: ['cough'] },
      }),
    ]);
    expect(screen.getByText(/37\.8 °C/)).toBeOnTheScreen();
  });

  it('saves a note with no temperature or tags', async () => {
    await open('Health note');
    await type('Note', '  Small rash on cheek  ');
    await save();
    expect(ofType('health')[0]?.payload).toEqual({ note: 'Small rash on cheek' });
  });

  it.each([
    ['43.1', 'Enter a temperature from 34.0 to 43.0 °C.'],
    ['33.9', 'Enter a temperature from 34.0 to 43.0 °C.'],
    ['hot', 'Enter the temperature as a number, like 37.5.'],
  ])('refuses temperature %p with a message and writes nothing', async (input, message) => {
    await open('Health note');
    await type('Note', 'Checked');
    await type('Temperature', input);
    await save();

    expect(screen.getByRole('alert')).toHaveTextContent(`Error: ${message}`);
    expect(ofType('health')).toEqual([]);
    expect(outboxCount()).toBe(0);

    // Fixing it saves.
    await type('Temperature', '38.2');
    expect(screen.queryByRole('alert')).toBeNull();
    await save();
    expect(ofType('health')[0]?.payload).toMatchObject({ temp_c: 38.2 });
  });

  it('accepts the range edges 34.0 and 43.0', async () => {
    await open('Health note');
    await type('Note', 'Edge');
    await type('Temperature', '43.0');
    await save();
    expect(ofType('health')[0]?.payload).toMatchObject({ temp_c: 43 });
  });

  it('caps the note at 500 characters and shows the count', async () => {
    await open('Health note');
    await type('Note', 'x'.repeat(620));
    expect(screen.getByLabelText('Note').props.value).toHaveLength(500);
    expect(screen.getByText('500 of 500 characters')).toBeOnTheScreen();
    await save();
    expect((ofType('health')[0]?.payload.note as string).length).toBe(500);
  });

  it('saves a temperature on its own, with no note (P1-F9)', async () => {
    await open('Health note');
    await type('Temperature', '37.4');
    await save();
    expect(ofType('health')).toEqual([
      expect.objectContaining({ occurredAt: NOW, payload: { temp_c: 37.4 } }),
    ]);
    expect(screen.getByText(/37\.4 °C/)).toBeOnTheScreen();
  });

  it('refuses an entry with neither a note nor a temperature, and writes nothing', async () => {
    await open('Health note');
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Rash' }));
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error: Add a note or a temperature to save this entry.',
    );
    expect(ofType('health')).toEqual([]);
    expect(outboxCount()).toBe(0);

    // Either one is enough.
    await type('Note', 'Small rash on cheek');
    expect(screen.queryByRole('alert')).toBeNull();
    await save();
    expect(ofType('health')[0]?.payload).toEqual({ note: 'Small rash on cheek', tags: ['rash'] });
  });

  it('takes a note written up afterwards, at the time it happened', async () => {
    await open('Health note');
    await fireEvent(screen.getByTestId('health-when'), 'change', NOW - HOUR);
    expect(screen.getByTestId('health-when-value')).toHaveTextContent('Today, 11:00');
    await type('Note', 'Sneezing after the feed');
    await save();
    expect(ofType('health')[0]?.occurredAt).toBe(NOW - HOUR);
  });

  it('refuses a blank note on its own', async () => {
    await open('Health note');
    await type('Note', '   ');
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error: Add a note or a temperature to save this entry.',
    );
    expect(ofType('health')).toEqual([]);
  });

  it('shows no messages before Save is pressed', async () => {
    await open('Health note');
    await type('Temperature', '99');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('medication sheet', () => {
  it('opens as G draws it, with the examples in the empty fields', async () => {
    await open('Medication');
    expect(screen.getByRole('header', { name: 'Medication' })).toBeOnTheScreen();
    expect(screen.getByText('Now · 12:00')).toBeOnTheScreen();
    expect(screen.getByTestId('medication-when-value')).toHaveTextContent('Today, 12:00 · now');
    expect(screen.getByLabelText('Name').props.placeholder).toBe('Name of the medicine');
    expect(screen.getByLabelText('Dose').props.placeholder).toBe('e.g. 1 drop or 2.5 ml');
  });

  it('takes a dose written up afterwards, at the time it was given', async () => {
    await open('Medication');
    await fireEvent(screen.getByTestId('medication-when'), 'change', NOW - HOUR);
    expect(screen.getByTestId('medication-when-value')).toHaveTextContent('Today, 11:00');
    await type('Name', 'Vitamin D');
    await save();
    expect(ofType('medication')[0]?.occurredAt).toBe(NOW - HOUR);
  });

  it('saves a name and dose and returns home showing it', async () => {
    await open('Medication');
    await type('Name', 'Vitamin D');
    await type('Dose', '1 drop');
    await save();
    expect(ofType('medication')).toEqual([
      expect.objectContaining({ occurredAt: NOW, payload: { name: 'Vitamin D', dose: '1 drop' } }),
    ]);
    expect(screen.getByText(/Vitamin D, 1 drop/)).toBeOnTheScreen();
  });

  it('opens with the last medication’s name, but never its amount', async () => {
    h.repo.insert({
      type: 'medication',
      occurredAt: NOW - 86_400_000,
      payload: { name: 'Vitamin D', dose: '1 drop' },
    });
    await open('Medication');
    expect(screen.getByLabelText('Name').props.value).toBe('Vitamin D');
    // The amount is typed each time: an infant's dose moves with weight and
    // age, so carrying it forward invites saving it unread (P3-F12).
    expect(screen.getByLabelText('Dose').props.value).toBe('');
    await save();
    expect(ofType('medication').map((e) => e.payload)).toEqual([
      { name: 'Vitamin D' },
      { name: 'Vitamin D', dose: '1 drop' },
    ]);
  });

  it('asks for a name before saving and leaves out an empty dose', async () => {
    await open('Medication');
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error: Add the medication name to save this entry.',
    );
    expect(ofType('medication')).toEqual([]);
    await type('Name', 'Paracetamol');
    await save();
    expect(ofType('medication')[0]?.payload).toEqual({ name: 'Paracetamol' });
  });

  it('caps the name at 60 and the dose at 30 characters', async () => {
    await open('Medication');
    await type('Name', 'n'.repeat(80));
    await type('Dose', 'd'.repeat(40));
    await save();
    expect(ofType('medication')[0]?.payload).toEqual({
      name: 'n'.repeat(60),
      dose: 'd'.repeat(30),
    });
  });
});
