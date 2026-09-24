import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Wednesday 21 October 2026, 14:00 local (UTC+3). */
const NOW = Date.parse('2026-10-21T14:00:00+03:00');
const BORN = Date.parse('2026-10-09T06:20:00+03:00'); // 12 days old
const USER = '0190a0b0-0000-7000-8000-00000000000a';

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

function knowsTheBaby(birthWeightG: number | null = 3400, bornAt: number | undefined = BORN) {
  prefs.set('accountHousehold', {
    userId: USER,
    householdId: '0190a0b0-0000-7000-8000-0000000000a1',
    babyId: '0190a0b0-0000-7000-8000-0000000000b1',
    babyName: 'Ella',
    role: 'owner',
    birthWeightG,
    ...(bornAt === undefined ? {} : { bornAt }),
  });
}

/** A day's worth of entries, with every figure worked out by hand below. */
function aDayOfEntries() {
  // Two days ago: outside the script's window, so none of it counts.
  repo.insert({
    type: 'feed_bottle',
    occurredAt: NOW - 2 * DAY,
    payload: { ml: 200, milk: 'formula' },
  });
  repo.insert({ type: 'diaper', occurredAt: NOW - 2 * DAY, payload: { kind: 'both' } });
  repo.insert({
    type: 'medication',
    occurredAt: NOW - 2 * DAY,
    payload: { name: 'Something older' },
  });
  repo.insert({
    type: 'feed_bottle',
    occurredAt: NOW - 20 * HOUR,
    payload: { ml: 90, milk: 'formula' },
  });
  repo.insert({ type: 'diaper', occurredAt: NOW - 19 * HOUR, payload: { kind: 'both' } });
  repo.insert({
    type: 'feed_bottle',
    occurredAt: NOW - 12 * HOUR,
    payload: { ml: 60, milk: 'breast' },
  });
  repo.insert({ type: 'diaper', occurredAt: NOW - 11 * HOUR, payload: { kind: 'wet' } });
  repo.insert({
    type: 'health',
    occurredAt: NOW - 4 * HOUR,
    payload: { temp_c: 37.2, note: 'Warm after a feed' },
  });
  repo.insert({
    type: 'medication',
    occurredAt: NOW - 3 * HOUR,
    payload: { name: 'Vitamin D', dose: '1 drop' },
  });
  repo.insert({
    type: 'weight',
    occurredAt: NOW - 2 * HOUR,
    payload: { grams: 3510, source: 'clinic' },
  });
  repo.insert({
    type: 'feed_bottle',
    occurredAt: NOW - HOUR,
    payload: { ml: 100, milk: 'breast' },
  });
}

async function openScript() {
  await renderRoutes(repo);
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Call script' }));
  await screen.findByTestId('call-feeds');
}

describe('the call script', () => {
  it('opens from Settings and leads with the baby’s age in days', async () => {
    knowsTheBaby();
    await openScript();
    expect(within(screen.getByTestId('call-age')).getByText('12 days old')).toBeOnTheScreen();
  });

  it('gives birth weight, the latest weighing and the change', async () => {
    knowsTheBaby();
    aDayOfEntries();
    await openScript();

    const card = within(screen.getByTestId('call-weight'));
    expect(card.getByText('3400 g')).toBeOnTheScreen();
    expect(card.getByText('3510 g on day 12')).toBeOnTheScreen();
    // 110 g, which is 3.2 points of the birth weight.
    expect(card.getByText('110 g (3.2%)')).toBeOnTheScreen();
  });

  it('gives the last 24 hours of feeds, with the longest gap', async () => {
    knowsTheBaby();
    aDayOfEntries();
    await openScript();

    const card = within(screen.getByTestId('call-feeds'));
    expect(card.getByLabelText('Feeds: 3')).toBeOnTheScreen();
    expect(card.getByText('250 mL')).toBeOnTheScreen();
    // Feeds 20h, 12h and 1h ago: gaps of 8h and 11h, so 11h is the longest.
    expect(card.getByLabelText('Longest gap between feeds: 11h 0m')).toBeOnTheScreen();
    expect(card.getByLabelText('Last feed: 13:00')).toBeOnTheScreen();
  });

  it('gives wet and dirty separately, counting "both" as one of each', async () => {
    knowsTheBaby();
    aDayOfEntries();
    await openScript();

    const card = within(screen.getByTestId('call-diapers'));
    expect(card.getByLabelText('Wet: 2')).toBeOnTheScreen();
    expect(card.getByLabelText('Dirty: 1')).toBeOnTheScreen();
  });

  it('gives the last temperature with its time, and says nothing about it', async () => {
    knowsTheBaby();
    aDayOfEntries();
    await openScript();
    expect(
      within(screen.getByTestId('call-temperature')).getByText('37.2 °C at 10:00'),
    ).toBeOnTheScreen();
  });

  it('lists the notes and the medication of the window', async () => {
    knowsTheBaby();
    aDayOfEntries();
    await openScript();

    const card = within(screen.getByTestId('call-notes'));
    expect(card.getByText('10:00 — Warm after a feed')).toBeOnTheScreen();
    expect(card.getByText('11:00 — Vitamin D, 1 drop')).toBeOnTheScreen();
    // The script is the last 24 hours, whatever else is in the database.
    expect(card.queryByText(/Something older/)).toBeNull();
  });

  it('says what is missing rather than showing a zero', async () => {
    knowsTheBaby();
    await openScript();

    expect(
      within(screen.getByTestId('call-weight')).getByText('Nothing weighed yet'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('call-temperature')).getByText('None logged'),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('call-feeds')).getAllByText('None logged').length).toBe(2);
    expect(screen.queryByTestId('call-notes')).toBeNull();
  });

  it('says so when this phone has no birth date', async () => {
    await openScript();
    expect(
      within(screen.getByTestId('call-age')).getByText(
        "This phone doesn't have the baby's birth date yet.",
      ),
    ).toBeOnTheScreen();
  });

  it('takes what the parent wants to raise, and never saves it', async () => {
    knowsTheBaby();
    await openScript();

    await fireEvent.changeText(
      screen.getByLabelText('Write it down before you call'),
      'She has been fussier since Sunday',
    );
    expect(screen.getByDisplayValue('She has been fussier since Sunday')).toBeOnTheScreen();
    expect(screen.getByText('Stays on this screen. Nothing here is saved.')).toBeOnTheScreen();
    // Nothing was logged: the box is state, not an entry.
    expect(repo.list()).toHaveLength(0);
  });

  it('ends with the questions saved on the next appointment', async () => {
    knowsTheBaby();
    repo.insert({
      type: 'appointment',
      occurredAt: NOW + 2 * DAY,
      payload: {
        title: 'Six week check',
        questions: ['Is the rash worth showing you?', 'How often should she feed?'],
      },
    });
    await openScript();

    const card = within(screen.getByTestId('call-questions'));
    expect(card.getByText(/For Six week check/)).toBeOnTheScreen();
    expect(card.getByTestId('call-question-0')).toHaveTextContent('Is the rash worth showing you?');
    expect(card.getByTestId('call-question-1')).toHaveTextContent('How often should she feed?');
  });

  it('takes the soonest visit, not one that has been and gone', async () => {
    knowsTheBaby();
    repo.insert({
      type: 'appointment',
      occurredAt: NOW - DAY,
      payload: { title: 'Last week', questions: ['Old question'] },
    });
    repo.insert({
      type: 'appointment',
      occurredAt: NOW + DAY,
      payload: { title: 'Tomorrow', questions: ['New question'] },
    });
    // Booked later, so the one to prepare for is still tomorrow's.
    repo.insert({
      type: 'appointment',
      occurredAt: NOW + 10 * DAY,
      payload: { title: 'Next month', questions: ['Later question'] },
    });
    await openScript();

    const card = within(screen.getByTestId('call-questions'));
    expect(card.getByText(/For Tomorrow/)).toBeOnTheScreen();
    expect(card.queryByText('Old question')).toBeNull();
    expect(card.queryByText('Later question')).toBeNull();
  });

  it('says so when a visit is booked with nothing written down', async () => {
    knowsTheBaby();
    repo.insert({
      type: 'appointment',
      occurredAt: NOW + 2 * DAY,
      payload: { title: 'Six week check' },
    });
    await openScript();

    expect(
      within(screen.getByTestId('call-questions')).getByText('Nothing written down yet'),
    ).toBeOnTheScreen();
  });

  it('leaves the section out when nothing is booked', async () => {
    knowsTheBaby();
    await openScript();
    expect(screen.queryByTestId('call-questions')).toBeNull();
  });

  it('says nothing about whether a figure is good', async () => {
    knowsTheBaby();
    aDayOfEntries();
    await openScript();

    for (const word of [
      /normal/i,
      /healthy/i,
      /concern/i,
      /\bfever\b/i,
      /\bgood\b/i,
      /worry/i,
      /too (little|much)/i,
    ]) {
      expect(screen.queryByText(word)).toBeNull();
    }
  });
});
