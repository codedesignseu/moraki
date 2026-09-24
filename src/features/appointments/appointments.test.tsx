import { cleanup, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';
import { createFakeNotifications } from '@/testing/fakeNotifications';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Wednesday 28 October 2026, 14:00 local (UTC+2). */
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));
const type = async (label: string, text: string) =>
  fireEvent.changeText(await screen.findByLabelText(label), text);
const nudge = async (label: string, direction: 'increment' | 'decrement', times = 1) => {
  for (let i = 0; i < times; i += 1) {
    await fireEvent(screen.getByLabelText(label), 'accessibilityAction', {
      nativeEvent: { actionName: direction },
    });
  }
};
const appointments = () => repo.list().filter((e) => e.type === 'appointment');

async function openSheet() {
  await renderApp(repo);
  await press('Add an appointment');
  await screen.findByTestId('appointment-when-value');
}

describe('booking an appointment', () => {
  it('saves what it is and when, with the moment shown in words', async () => {
    await openSheet();
    await type('What is it', 'Six week check');

    // Tomorrow is the default; move it to three days out at 11:00.
    await nudge('How many days from today', 'increment', 2);
    await nudge('Hour', 'increment');

    expect(screen.getByTestId('appointment-when-value')).toHaveTextContent('Sat 31 Oct, 11:00');
    await press('Save');

    expect(appointments()).toHaveLength(1);
    expect(appointments()[0]?.payload).toEqual({ title: 'Six week check' });
    expect(appointments()[0]?.occurredAt).toBe(Date.parse('2026-10-31T09:00:00Z'));
  });

  it('will not save without saying what it is', async () => {
    await openSheet();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await type('What is it', 'Six week check');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the doctor, clinic and notes when they are filled in', async () => {
    await openSheet();
    await type('What is it', 'Six week check');
    await type('Doctor (optional)', 'Dr Andreou');
    await type('Clinic (optional)', 'Nicosia General');
    await type('Notes (optional)', 'bring the red book');
    await press('Save');

    expect(appointments()[0]?.payload).toEqual({
      title: 'Six week check',
      doctor: 'Dr Andreou',
      clinic: 'Nicosia General',
      notes: 'bring the red book',
    });
  });

  it('takes the questions to ask, and lets one be removed again', async () => {
    await openSheet();
    await type('What is it', 'Six week check');

    await type('A question to ask', 'Is the rash worth showing you?');
    await press('Add question');
    await type('A question to ask', 'How often should she feed?');
    await press('Add question');
    expect(screen.getByTestId('question-0')).toBeOnTheScreen();

    await fireEvent.press(
      within(screen.getByTestId('question-0')).getByRole('button', { name: 'Remove' }),
    );
    await press('Save');

    expect(appointments()[0]?.payload).toMatchObject({
      questions: ['How often should she feed?'],
    });
  });
});

describe('the next appointment on home', () => {
  it('says what is booked and when', async () => {
    repo.insert({
      type: 'appointment',
      occurredAt: NOW + 2 * DAY,
      payload: { title: 'Six week check' },
    });

    await renderApp(repo);

    expect(
      within(await screen.findByTestId('home-appointment')).getByText(
        /Six week check — Fri 30 Oct, 14:00/,
      ),
    ).toBeOnTheScreen();
  });

  it('says nothing is booked when nothing is', async () => {
    await renderApp(repo);
    expect(
      within(await screen.findByTestId('home-appointment')).getByText('Nothing booked'),
    ).toBeOnTheScreen();
  });

  it('shows the soonest one, and ignores one that has passed', async () => {
    repo.insert({ type: 'appointment', occurredAt: NOW - DAY, payload: { title: 'Last week' } });
    repo.insert({ type: 'appointment', occurredAt: NOW + 5 * DAY, payload: { title: 'Later' } });
    repo.insert({ type: 'appointment', occurredAt: NOW + DAY, payload: { title: 'Tomorrow' } });

    await renderApp(repo);

    const card = within(await screen.findByTestId('home-appointment'));
    expect(card.getByText(/Tomorrow —/)).toBeOnTheScreen();
    expect(card.queryByText(/Last week/)).toBeNull();
  });

  it('opens a booked one to change it', async () => {
    const booked = repo.insert({
      type: 'appointment',
      occurredAt: NOW + 2 * DAY,
      payload: { title: 'Six week check', questions: ['Why?'] },
    });

    await renderApp(repo);
    await fireEvent.press(await screen.findByTestId(`appointment-${booked.id}`));

    // The sheet opens on it, with what was saved.
    expect(await screen.findByDisplayValue('Six week check')).toBeOnTheScreen();
    // The row holds the question and its Remove button.
    expect(within(screen.getByTestId('question-0')).getByText('Why?')).toBeOnTheScreen();
    expect(screen.getByTestId('appointment-when-value')).toHaveTextContent('Fri 30 Oct, 14:00');
  });
});

describe('reminders for an appointment', () => {
  it('schedules a day before and an hour before', async () => {
    prefs.set('reminders', true);
    const at = NOW + 3 * DAY;
    repo.insert({ type: 'appointment', occurredAt: at, payload: { title: 'Six week check' } });
    const os = createFakeNotifications();

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.held()).toHaveLength(2));
    expect(os.held().map((r) => r.at - at)).toEqual([-DAY, -HOUR]);
    expect(os.held().map((r) => r.body)).toEqual([
      'Tomorrow: Six week check',
      'In an hour: Six week check',
    ]);
  });

  it('clears them when the appointment is cancelled', async () => {
    prefs.set('reminders', true);
    const booked = repo.insert({
      type: 'appointment',
      occurredAt: NOW + 3 * DAY,
      payload: { title: 'Six week check' },
    });
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(2));

    repo.softDelete(booked.id);

    await waitFor(() => expect(os.held()).toEqual([]));
  });

  it('leaves the feed reminder alone while doing it', async () => {
    prefs.set('reminders', true);
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(1));
    const feedHandle = os.held()[0]?.handle;

    repo.insert({
      type: 'appointment',
      occurredAt: NOW + 3 * DAY,
      payload: { title: 'Six week check' },
    });

    await waitFor(() => expect(os.held()).toHaveLength(3));
    // The feed's notification was not cancelled and re-created for this.
    expect(os.held().some((r) => r.handle === feedHandle)).toBe(true);
  });
});
