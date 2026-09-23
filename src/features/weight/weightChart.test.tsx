import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const DAY = 86_400_000;
/** Born 21 days before "now", at 02:00 local. */
const NOW = Date.parse('2026-06-22T09:00:00Z');
const BORN = Date.parse('2026-06-01T00:10:00Z');
const USER = '0190a0b0-0000-7000-8000-00000000000a';
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const BABY = '0190a0b0-0000-7000-8000-0000000000b1';

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

/** The phone knows the baby: born 21 days ago, 3400 g at birth. */
function knowsTheBaby(birthWeightG: number | null = 3400, bornAt: number | undefined = BORN) {
  prefs.set('accountHousehold', {
    userId: USER,
    householdId: HOUSEHOLD,
    babyId: BABY,
    babyName: 'Ella',
    role: 'owner',
    birthWeightG,
    ...(bornAt === undefined ? {} : { bornAt }),
  });
}

const weighed = (day: number, grams: number, source: 'home' | 'clinic' = 'home') =>
  repo.insert({
    type: 'weight',
    occurredAt: BORN + day * DAY + 8 * 3_600_000,
    payload: { grams, source },
  });

async function openInsights() {
  await renderRoutes(repo);
  await fireEvent.press(screen.getByRole('button', { name: /Trends/ }));
  return within(await screen.findByTestId('insights-weight'));
}

describe('the weight card', () => {
  it('says nothing has been weighed yet, and still points at the pediatrician', async () => {
    knowsTheBaby();
    const card = await openInsights();

    expect(card.getByText('Nothing weighed yet')).toBeOnTheScreen();
    expect(card.getByText('Your pediatrician tracks this at check-ups.')).toBeOnTheScreen();
    expect(card.queryByTestId('weight-chart')).toBeNull();
  });

  it('plots every weighing, with the 90% and 100% lines and the day 10 and 14 marks', async () => {
    knowsTheBaby();
    const first = weighed(0, 3400, 'clinic');
    weighed(4, 3105);
    const last = weighed(14, 3510, 'clinic');

    const card = await openInsights();
    const chart = within(card.getByTestId('weight-chart'));

    expect(chart.getByTestId(`point-${first.occurredAt}`)).toBeOnTheScreen();
    expect(chart.getByTestId(`point-${last.occurredAt}`)).toBeOnTheScreen();
    // The two lines a clinician reads against, and nothing else.
    expect(chart.getByTestId('line-pct-90')).toBeOnTheScreen();
    expect(chart.getByTestId('line-pct-100')).toBeOnTheScreen();
    expect(card.getByText('90%')).toBeOnTheScreen();
    expect(card.getByText('100%')).toBeOnTheScreen();
    expect(chart.getByTestId('mark-day-10')).toBeOnTheScreen();
    expect(chart.getByTestId('mark-day-14')).toBeOnTheScreen();
    expect(card.getByText('Day 10')).toBeOnTheScreen();
    expect(card.getByText('Day 14')).toBeOnTheScreen();
  });

  it('reads each point by day and grams for a screen reader', async () => {
    knowsTheBaby();
    weighed(10, 3300, 'clinic');

    const card = await openInsights();
    expect(card.getByLabelText('Day 10: 3300 g')).toBeOnTheScreen();
  });

  it('lists the weighings newest first, saying whose scale each was', async () => {
    knowsTheBaby();
    weighed(0, 3400, 'clinic');
    weighed(6, 3160, 'home');

    const card = await openInsights();
    expect(card.getByText('Day 6 · 3160 g · at home')).toBeOnTheScreen();
    expect(card.getByText('Day 0 · 3400 g · at the clinic')).toBeOnTheScreen();
    expect(card.getByText('Latest 3160 g on day 6')).toBeOnTheScreen();
    // Newest at the top: the last weighing is the one being looked for.
    expect(card.getAllByTestId(/^weight-row-/).map((row) => row.props.children)).toEqual([
      'Day 6 · 3160 g · at home',
      'Day 0 · 3400 g · at the clinic',
    ]);
  });

  it('says a loss from birth weight plainly', async () => {
    knowsTheBaby();
    weighed(4, 3105);
    expect((await openInsights()).getByText('295 g below birth weight')).toBeOnTheScreen();
  });

  it('says a gain the same way', async () => {
    knowsTheBaby();
    weighed(4, 3105);
    weighed(21, 3900, 'clinic');
    expect((await openInsights()).getByText('500 g above birth weight')).toBeOnTheScreen();
  });

  it('never says whether a number is good', async () => {
    knowsTheBaby();
    weighed(4, 3105);

    const card = await openInsights();
    // The words this app never puts next to a health number (rule 10).
    for (const word of [
      /normal/i,
      /healthy/i,
      /concern/i,
      /\btoo (little|much|low|slow)\b/i,
      /\bgood\b/i,
      /\bfine\b/i,
      /worry/i,
      /behind/i,
    ]) {
      expect(card.queryByText(word)).toBeNull();
    }
  });

  it('shows the log without a chart when this phone has no birth date', async () => {
    // A P1 phone that has never signed in has no household record at all.
    weighed(0, 3400, 'clinic');

    const card = await openInsights();
    expect(card.queryByTestId('weight-chart')).toBeNull();
    // No birth date means no day to count from, so the row carries the date.
    expect(card.getByText(/3400 g · at the clinic/)).toBeOnTheScreen();
    expect(card.queryByText(/Day \d/)).toBeNull();
  });

  it('drops the percentage lines when no birth weight was recorded', async () => {
    knowsTheBaby(null);
    weighed(3, 3200);

    const card = await openInsights();
    expect(card.getByTestId('weight-chart')).toBeOnTheScreen();
    expect(card.queryByTestId('line-pct-90')).toBeNull();
    expect(card.queryByText(/birth weight/)).toBeNull();
  });
});

describe('adding a weight', () => {
  it('saves the grams and whose scale it was, and the card updates', async () => {
    knowsTheBaby();
    await openInsights();

    await fireEvent.press(screen.getByRole('button', { name: 'Add a weight' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'At the clinic' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const weights = repo.list().filter((e) => e.type === 'weight');
    expect(weights).toHaveLength(1);
    // Opens at the birth weight when nothing has been weighed yet.
    expect(weights[0]?.payload).toEqual({ grams: 3400, source: 'clinic' });
    expect(
      within(await screen.findByTestId('insights-weight')).getByText(
        'Day 21 · 3400 g · at the clinic',
      ),
    ).toBeOnTheScreen();
  });

  it('opens at the last weight recorded, since the next one is near it', async () => {
    knowsTheBaby();
    weighed(10, 3300, 'clinic');
    await openInsights();

    await fireEvent.press(screen.getByRole('button', { name: 'Add a weight' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));

    const weights = repo.list().filter((e) => e.type === 'weight');
    expect(weights).toHaveLength(2);
    expect(weights.map((e) => (e.payload as { grams: number }).grams)).toEqual([3300, 3300]);
  });

  it('can be undone straight after saving', async () => {
    knowsTheBaby();
    await openInsights();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a weight' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(repo.list().filter((e) => e.type === 'weight')).toHaveLength(1);

    await fireEvent.press(await screen.findByRole('button', { name: 'Undo' }));
    expect(repo.list().filter((e) => e.type === 'weight' && e.deletedAt === null)).toHaveLength(0);
  });
});
