import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

import { INITIAL_ROWS } from './HistoryScreen';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-10-25T10:00:00Z'); // Sunday 25 October, 12:00 local

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

const bottle = (at: number, ml = 90) =>
  h.repo.insert({ type: 'feed_bottle', occurredAt: at, payload: { ml, milk: 'formula' } });
const diaper = (at: number) =>
  h.repo.insert({ type: 'diaper', occurredAt: at, payload: { kind: 'wet' } });
const med = (at: number) =>
  h.repo.insert({ type: 'medication', occurredAt: at, payload: { name: 'Vitamin D' } });

async function openHistory() {
  await renderApp(h.repo);
  await fireEvent.press(screen.getByRole('button', { name: /History/ }));
}
const list = () => within(screen.getByTestId('history-list'));
const chip = (name: string) => screen.getByRole('togglebutton', { name });
const rowTitles = () =>
  list()
    .queryAllByTestId(/^history-/)
    .map((row) => within(row).getAllByText(/.+/)[0]?.props.children);

describe('history timeline', () => {
  it('is a tab next to Home and groups entries by local day, newest first', async () => {
    bottle(NOW - HOUR, 120);
    diaper(NOW - 2 * HOUR);
    bottle(Date.parse('2026-10-24T18:00:00Z'), 60); // yesterday 21:00
    med(Date.parse('2026-10-23T06:00:00Z')); // Friday 09:00
    await openHistory();

    expect(
      list()
        .getAllByRole('header')
        .map((hdr) => hdr.props.children),
    ).toEqual(['Today', 'Yesterday', 'Friday, October 23']);
    expect(rowTitles()).toEqual(['Bottle', 'Diaper', 'Bottle', 'Medication']);
    expect(list().getByText('120 mL formula')).toBeOnTheScreen();
    expect(list().getByText('21:00')).toBeOnTheScreen();
    expect(list().getAllByText('You')).toHaveLength(4);
  });

  it('filters by the chosen groups, several at once, and shows everything again when cleared', async () => {
    bottle(NOW - HOUR);
    diaper(NOW - 2 * HOUR);
    med(NOW - 3 * HOUR);
    await openHistory();

    await fireEvent.press(chip('Feeds'));
    expect(rowTitles()).toEqual(['Bottle']);
    await fireEvent.press(chip('Health'));
    expect(rowTitles()).toEqual(['Bottle', 'Medication']);
    await fireEvent.press(chip('Feeds'));
    await fireEvent.press(chip('Health'));
    expect(rowTitles()).toEqual(['Bottle', 'Diaper', 'Medication']);
  });

  it('says when filters hide everything, and when nothing is logged', async () => {
    await openHistory();
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();

    await act(async () => {
      bottle(NOW - HOUR);
    });
    await fireEvent.press(chip('Sleep'));
    expect(screen.getByText('Nothing matches these filters')).toBeOnTheScreen();
  });

  it('updates the moment something is logged', async () => {
    await openHistory();
    await act(async () => {
      diaper(NOW - 5 * MIN);
    });
    expect(rowTitles()).toEqual(['Diaper']);
  });

  it('renders only a window of rows for 2,000 events, newest first (virtualized)', async () => {
    // 2,000 entries, one every 20 minutes back from now: about 28 days.
    for (let i = 0; i < 2000; i += 1) {
      if (i % 2 === 0) bottle(NOW - i * 20 * MIN, 30 + (i % 10));
      else diaper(NOW - i * 20 * MIN);
    }
    expect(h.repo.list()).toHaveLength(2000);
    await openHistory();

    const rendered = list().queryAllByTestId(/^history-/);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThanOrEqual(INITIAL_ROWS);
    expect(rowTitles()[0]).toBe('Bottle');
    expect(list().getAllByRole('header')[0]?.props.children).toBe('Today');
  });
});
