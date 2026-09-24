import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
/** Wednesday 28 October 2026, 14:00 local (UTC+2). */
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

/** The picker hands back a moment; this is that, without the native sheet. */
const pick = async (testID: string, at: number) =>
  fireEvent(screen.getByTestId(testID), 'change', at);

const sleeps = () => repo.list().filter((e) => e.type === 'sleep');

describe('writing a sleep up afterwards', () => {
  it('saves the two times it was given, doing the arithmetic itself', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    await screen.findByTestId('sleep-start');

    // 21:30 last night to 06:15 this morning — nobody should have to work
    // that out as "started 990 minutes ago, lasted 525".
    const start = Date.parse('2026-10-27T19:30:00Z');
    const end = Date.parse('2026-10-28T04:15:00Z');
    await pick('sleep-start', start);
    await pick('sleep-end', end);
    await fireEvent.press(screen.getByRole('button', { name: 'Save past sleep' }));

    expect(sleeps()).toHaveLength(1);
    expect(sleeps()[0]?.occurredAt).toBe(start);
    expect(sleeps()[0]?.endedAt).toBe(end);
  });

  it('refuses a sleep that ends before it starts, and says why', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    await screen.findByTestId('sleep-start');

    await pick('sleep-start', NOW - HOUR);
    await pick('sleep-end', NOW - 2 * HOUR);

    expect(screen.getByTestId('sleep-backwards')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save past sleep' })).toBeDisabled();
    expect(sleeps()).toHaveLength(0);
  });

  it('still saves from the steppers alone, which is the quick way', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    await screen.findByTestId('sleep-start');

    // Untouched: an hour ago, for 45 minutes, as the steppers start.
    await fireEvent.press(screen.getByRole('button', { name: 'Save past sleep' }));

    expect(sleeps()[0]?.occurredAt).toBe(NOW - HOUR);
    expect(sleeps()[0]?.endedAt).toBe(NOW - HOUR + 45 * MIN);
  });
});

describe('writing other entries up afterwards', () => {
  it('backdates a feed to the time it was given', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
    await screen.findByTestId('feed-when');

    const at = Date.parse('2026-10-28T09:20:00Z');
    await pick('feed-when', at);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const feeds = repo.list().filter((e) => e.type === 'feed_bottle');
    expect(feeds[0]?.occurredAt).toBe(at);
  });

  it('dates a weight from the clinic visit, not from when it was typed', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: /Trends/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a weight' }));
    await screen.findByTestId('weight-when');

    const at = Date.parse('2026-10-26T08:00:00Z');
    await pick('weight-when', at);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const weights = repo.list().filter((e) => e.type === 'weight');
    expect(weights[0]?.occurredAt).toBe(at);
  });

  it('sets an appointment a month out without pressing a stepper thirty times', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Add an appointment' }));
    await screen.findByTestId('appointment-when');

    await fireEvent.changeText(screen.getByLabelText('What is it'), 'Two month check');
    const at = Date.parse('2026-11-28T08:30:00Z');
    await pick('appointment-when', at);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const booked = repo.list().filter((e) => e.type === 'appointment');
    expect(booked[0]?.occurredAt).toBe(at);
  });

  it('shows the moment in words, so a picker’s answer can be checked', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));

    await pick('feed-when', Date.parse('2026-10-28T09:20:00Z'));

    expect(
      within(screen.getByTestId('feed-when')).getByTestId('feed-when-value'),
    ).toHaveTextContent(/11:20/);
  });
});
