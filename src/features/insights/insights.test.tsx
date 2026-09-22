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
    expect(bottles.getByLabelText('Thursday: 90 mL')).toBeOnTheScreen();
    expect(bottles.getByLabelText('Friday: 0 mL')).toBeOnTheScreen();
    expect(bottles.getByLabelText('Today: 105 mL')).toBeOnTheScreen();
    expect(bottles.getByText('7 days: 195 mL')).toBeOnTheScreen();
    // The tallest bar fills the plot; the others scale to it.
    const chart = within(screen.getByTestId('insights-bottle-chart'));
    expect(chart.getByTestId('bar-2026-10-28-fill')).toHaveStyle({ height: size.chartHeight });
    expect(chart.getByTestId('bar-2026-10-22-fill')).toHaveStyle({
      height: (90 / 105) * size.chartHeight,
    });

    // Breastfeeding is its own chart, never folded into mL.
    expect(card('insights-breast').getByLabelText('Today: 12m')).toBeOnTheScreen();
    expect(card('insights-breast').getByText('7 days: 12m')).toBeOnTheScreen();

    // (90 + 105) / 2 bottles = 97.5, shown as 98 mL. Three feeds from 21 Oct 21:10Z to
    // 28 Oct 07:10Z: 154 hours over 2 gaps = 77 hours.
    const averages = card('insights-averages');
    expect(averages.getByLabelText('Average bottle: 98 mL')).toBeOnTheScreen();
    expect(averages.getByLabelText('Average time between feeds: 77h 0m')).toBeOnTheScreen();

    expect(row('2026-10-25')).toEqual(['Sun', '0', '0', '0', '5h 0m']);
    expect(row('2026-10-28')).toEqual(['Today', '2', '1', '1', '0m']);
    expect(row('total')).toEqual(['7 days', '3', '1', '1', '5h 0m']);
  });

  it('leaves out the breastfeeding chart when there was none, and says when there is too little to average', async () => {
    bottle('2026-10-28T05:00:00+02:00', 100);
    await openTrends();
    expect(screen.queryByTestId('insights-breast')).toBeNull();
    expect(card('insights-averages').getByLabelText('Average bottle: 100 mL')).toBeOnTheScreen();
    expect(
      card('insights-averages').getByLabelText(
        'Average time between feeds: Not enough entries yet',
      ),
    ).toBeOnTheScreen();
  });

  it('updates the moment something is logged', async () => {
    await openTrends();
    expect(card('insights-bottle').getByText('7 days: 0 mL')).toBeOnTheScreen();
    await act(async () => {
      bottle('2026-10-28T13:00:00+02:00', 80);
    });
    expect(card('insights-bottle').getByText('7 days: 80 mL')).toBeOnTheScreen();
    expect(row('2026-10-28')).toEqual(['Today', '1', '0', '0', '0m']);
  });
});
