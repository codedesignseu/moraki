import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import { size } from '@/ui/tokens';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-10-28T14:00:00+02:00'); // Wednesday 14:00, after clocks went back

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

const bottle = (iso: string, ml: number) =>
  h.repo.insert({ type: 'feed_bottle', occurredAt: at(iso), payload: { ml, milk: 'formula' } });

async function openTrends() {
  await renderApp(h.repo);
  await fireEvent.press(screen.getByRole('button', { name: /Trends/ }));
}
const card = (id: string) => within(screen.getByTestId(id));
const row = (key: string) =>
  within(screen.getByTestId(key === 'total' ? 'insights-day-total' : `insights-day-${key}`))
    .getAllByText(/.*/)
    .map((cell) => String(cell.props.children));

describe('trends', () => {
  it('shows the week by hand-checked numbers', async () => {
    bottle('2026-10-22T00:10:00+03:00', 90); // Thursday, first feed
    bottle('2026-10-28T05:00:00+02:00', 105);
    h.repo.insert({
      type: 'feed_breast',
      occurredAt: at('2026-10-28T09:10:00+02:00'), // last feed
      payload: { side: 'right', right_s: 720 },
    });
    h.repo.insert({
      type: 'diaper',
      occurredAt: at('2026-10-28T08:00:00+02:00'),
      payload: { kind: 'both' },
    });
    // Across the clock change: 4 hours on the wall clock, 5 hours asleep.
    h.repo.insert({
      type: 'sleep',
      occurredAt: at('2026-10-25T02:00:00+03:00'),
      endedAt: at('2026-10-25T06:00:00+02:00'),
      payload: {},
    });
    await openTrends();

    const bottles = card('insights-bottle');
    expect(bottles.getByLabelText('Thursday: 90 ml')).toBeOnTheScreen();
    expect(bottles.getByLabelText('Friday: 0 ml')).toBeOnTheScreen();
    expect(bottles.getByLabelText('Today: 105 ml')).toBeOnTheScreen();
    expect(bottles.getByText('7 days: 195 ml')).toBeOnTheScreen();
    // The tallest bar fills the plot; the others scale to it.
    const chart = within(screen.getByTestId('insights-bottle-chart'));
    expect(chart.getByTestId('bar-2026-10-28-fill')).toHaveStyle({ height: size.chartHeight });
    expect(chart.getByTestId('bar-2026-10-22-fill')).toHaveStyle({
      height: (90 / 105) * size.chartHeight,
    });

    // Breastfeeding is its own chart, never folded into ml.
    expect(card('insights-breast').getByLabelText('Today: 12 min')).toBeOnTheScreen();
    expect(card('insights-breast').getByText('7 days: 12 min')).toBeOnTheScreen();

    // (90 + 105) / 2 bottles = 97.5, shown as 98 ml. Three feeds from 21 Oct 21:10Z to
    // 28 Oct 07:10Z: 154 hours over 2 gaps = 77 hours.
    const averages = card('insights-averages');
    expect(averages.getByLabelText('Bottle amount: 98 ml')).toBeOnTheScreen();
    expect(averages.getByLabelText('Gap between feeds: 77 h 00')).toBeOnTheScreen();

    expect(row('2026-10-25')).toEqual(['Sun', '0', '0', '0', '5 h 00']);
    expect(row('2026-10-28')).toEqual(['Today', '2', '1', '1', '0 min']);
    expect(row('total')).toEqual(['7 days', '3', '1', '1', '5 h 00']);
  });

  it('leaves out the breastfeeding chart when there was none, and says when there is too little to average', async () => {
    bottle('2026-10-28T05:00:00+02:00', 100);
    await openTrends();
    expect(screen.queryByTestId('insights-breast')).toBeNull();
    expect(card('insights-averages').getByLabelText('Bottle amount: 100 ml')).toBeOnTheScreen();
    expect(
      card('insights-averages').getByLabelText('Gap between feeds: Nothing to average yet'),
    ).toBeOnTheScreen();
  });

  it('shows the empty state until something is logged in the window, then updates at once', async () => {
    bottle('2026-10-21T12:00:00+03:00', 60); // Wednesday 21, before the window
    await openTrends();
    expect(screen.getByText('Trends start after the first full day')).toBeOnTheScreen();
    expect(screen.queryByText('Last 7 days')).toBeNull();
    expect(screen.queryByTestId('insights-bottle')).toBeNull();
    expect(screen.getByTestId('insights-weight')).toBeOnTheScreen();

    await act(async () => {
      bottle('2026-10-28T13:00:00+02:00', 80);
    });
    expect(screen.queryByTestId('insights-empty')).toBeNull();
    expect(screen.getByText('Last 7 days')).toBeOnTheScreen();
    expect(card('insights-bottle').getByText('7 days: 80 ml')).toBeOnTheScreen();
    expect(row('2026-10-28')).toEqual(['Today', '1', '0', '0', '0 min']);
  });
});
