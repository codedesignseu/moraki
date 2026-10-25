import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';
import { palette } from '@/ui/tokens';

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
  it('says nothing has been weighed yet', async () => {
    knowsTheBaby();
    const card = await openInsights();

    expect(card.getByText('No weights yet')).toBeOnTheScreen();
    expect(card.queryByText(/pediatrician/i)).toBeNull();
    expect(card.queryByTestId('weight-chart')).toBeNull();
  });

  it('plots every weighing, with no reference lines and no marked days (P0.7)', async () => {
    knowsTheBaby();
    const first = weighed(0, 3400, 'clinic');
    weighed(4, 3105);
    const last = weighed(14, 3510, 'clinic');

    const card = await openInsights();
    const chart = within(card.getByTestId('weight-chart'));

    expect(chart.getByTestId(`point-${first.occurredAt}`)).toBeOnTheScreen();
    expect(chart.getByTestId(`point-${last.occurredAt}`)).toBeOnTheScreen();
    // Nothing to read the points against: a line or a marked day is a verdict.
    expect(chart.queryByTestId(/^line-/)).toBeNull();
    expect(chart.queryByTestId(/^mark-/)).toBeNull();
    expect(card.queryByText(/%/)).toBeNull();
    expect(card.queryByText(/^Day \d+$/)).toBeNull();
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
    expect(card.getByText('7 Jun · Home')).toBeOnTheScreen();
    expect(card.getByText('1 Jun · Clinic')).toBeOnTheScreen();
    expect(card.getByLabelText('Birth, 3,400 g')).toBeOnTheScreen();
    expect(card.getByLabelText('Latest, 3,160 g')).toBeOnTheScreen();
    // Newest at the top: the last weighing is the one being looked for.
    expect(card.getAllByTestId(/^weight-row-/).map((row) => row.props.accessibilityLabel)).toEqual([
      '7 Jun · Home, 3,160 g',
      '1 Jun · Clinic, 3,400 g',
    ]);
  });

  it('draws clinic weighings filled and home ones hollow, with a legend', async () => {
    knowsTheBaby();
    const clinic = weighed(0, 3400, 'clinic');
    const home = weighed(6, 3160, 'home');

    const card = await openInsights();
    const chart = within(card.getByTestId('weight-chart'));
    expect(chart.getByTestId(`point-${home.occurredAt}`)).toHaveStyle({
      backgroundColor: palette.light.card,
    });
    expect(chart.getByTestId(`point-${clinic.occurredAt}`)).toHaveStyle({
      backgroundColor: palette.light.ink,
    });
    expect(chart.getAllByTestId('gridline')).toHaveLength(3);
    expect(card.getByText('Clinic')).toBeOnTheScreen();
    expect(card.getByText('Home')).toBeOnTheScreen();
  });

  it('says a loss from birth weight plainly', async () => {
    knowsTheBaby();
    weighed(4, 3105);
    const card = await openInsights();
    expect(card.getByLabelText('295 g below birth weight')).toBeOnTheScreen();
    expect(card.getByText('−295 g')).toBeOnTheScreen();
  });

  it('says a gain the same way', async () => {
    knowsTheBaby();
    weighed(4, 3105);
    weighed(21, 3900, 'clinic');
    const card = await openInsights();
    expect(card.getByLabelText('500 g above birth weight')).toBeOnTheScreen();
    expect(card.getByText('+500 g')).toBeOnTheScreen();
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
    expect(card.getByLabelText('1 Jun · Clinic, 3,400 g')).toBeOnTheScreen();
    expect(card.queryByText(/Day \d/)).toBeNull();
  });

  it('still plots, without a change from birth, when no birth weight was recorded', async () => {
    knowsTheBaby(null);
    weighed(3, 3200);

    const card = await openInsights();
    expect(card.getByTestId('weight-chart')).toBeOnTheScreen();
    expect(card.queryByText(/birth weight/)).toBeNull();
  });
});

describe('adding a weight', () => {
  it('saves the grams and whose scale it was, and the card updates', async () => {
    knowsTheBaby();
    await openInsights();

    await fireEvent.press(screen.getByRole('button', { name: 'Add weight' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Clinic' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const weights = repo.list().filter((e) => e.type === 'weight');
    expect(weights).toHaveLength(1);
    // Opens at the birth weight when nothing has been weighed yet.
    expect(weights[0]?.payload).toEqual({ grams: 3400, source: 'clinic' });
    expect(
      within(await screen.findByTestId('insights-weight')).getByLabelText(
        '22 Jun · Clinic, 3,400 g',
      ),
    ).toBeOnTheScreen();
  });

  it('opens at the last weight recorded, since the next one is near it', async () => {
    knowsTheBaby();
    weighed(10, 3300, 'clinic');
    await openInsights();

    await fireEvent.press(screen.getByRole('button', { name: 'Add weight' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));

    const weights = repo.list().filter((e) => e.type === 'weight');
    expect(weights).toHaveLength(2);
    expect(weights.map((e) => (e.payload as { grams: number }).grams)).toEqual([3300, 3300]);
  });

  it('can be undone straight after saving', async () => {
    knowsTheBaby();
    await openInsights();
    await fireEvent.press(screen.getByRole('button', { name: 'Add weight' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(repo.list().filter((e) => e.type === 'weight')).toHaveLength(1);

    await fireEvent.press(await screen.findByRole('button', { name: 'Undo' }));
    expect(repo.list().filter((e) => e.type === 'weight' && e.deletedAt === null)).toHaveLength(0);
  });
});
