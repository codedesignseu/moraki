import { fireEvent, screen } from 'expo-router/testing-library';

import type { Event } from '@/domain/activities';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 in Nicosia

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
    expect(screen.getByText('At 12:00')).toBeOnTheScreen();
    await type('Note', 'Warm to touch after nap');
    await type('Temperature in °C (optional)', '37,8');
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Cough' }));
    await save();

    expect(ofType('health')).toEqual([
      expect.objectContaining({
        occurredAt: NOW,
        payload: { note: 'Warm to touch after nap', temp_c: 37.8, tags: ['cough'] },
      }),
    ]);
    expect(screen.getByText('37.8 °C')).toBeOnTheScreen();
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
    await type('Temperature in °C (optional)', input);
    await save();

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(ofType('health')).toEqual([]);
    expect(outboxCount()).toBe(0);

    // Fixing it saves.
    await type('Temperature in °C (optional)', '38.2');
    expect(screen.queryByRole('alert')).toBeNull();
    await save();
    expect(ofType('health')[0]?.payload).toMatchObject({ temp_c: 38.2 });
  });

  it('accepts the range edges 34.0 and 43.0', async () => {
    await open('Health note');
    await type('Note', 'Edge');
    await type('Temperature in °C (optional)', '43.0');
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

  it('asks for a note before saving', async () => {
    await open('Health note');
    await type('Temperature in °C (optional)', '37.5');
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note to save this entry.');
    expect(ofType('health')).toEqual([]);
  });

  it('shows no messages before Save is pressed', async () => {
    await open('Health note');
    await type('Temperature in °C (optional)', '99');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('medication sheet', () => {
  it('saves a name and dose and returns home showing it', async () => {
    await open('Medication');
    await type('Medication name', 'Vitamin D');
    await type('Dose (optional)', '1 drop');
    await save();
    expect(ofType('medication')).toEqual([
      expect.objectContaining({ occurredAt: NOW, payload: { name: 'Vitamin D', dose: '1 drop' } }),
    ]);
    expect(screen.getByText('Vitamin D, 1 drop')).toBeOnTheScreen();
  });

  it('opens with the last medication, so a repeat is one tap on Save', async () => {
    h.repo.insert({
      type: 'medication',
      occurredAt: NOW - 86_400_000,
      payload: { name: 'Vitamin D', dose: '1 drop' },
    });
    await open('Medication');
    expect(screen.getByLabelText('Medication name').props.value).toBe('Vitamin D');
    await save();
    expect(ofType('medication').map((e) => e.payload)).toEqual([
      { name: 'Vitamin D', dose: '1 drop' },
      { name: 'Vitamin D', dose: '1 drop' },
    ]);
  });

  it('asks for a name before saving and leaves out an empty dose', async () => {
    await open('Medication');
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Add the medication name to save this entry.',
    );
    expect(ofType('medication')).toEqual([]);
    await type('Medication name', 'Paracetamol');
    await save();
    expect(ofType('medication')[0]?.payload).toEqual({ name: 'Paracetamol' });
  });

  it('caps the name at 60 and the dose at 30 characters', async () => {
    await open('Medication');
    await type('Medication name', 'n'.repeat(80));
    await type('Dose (optional)', 'd'.repeat(40));
    await save();
    expect(ofType('medication')[0]?.payload).toEqual({
      name: 'n'.repeat(60),
      dose: 'd'.repeat(30),
    });
  });
});
