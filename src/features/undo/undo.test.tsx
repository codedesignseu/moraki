import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { UNDO_WINDOW_MS } from '@/db/repositories/events';
import { events } from '@/db/schema';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const NOW = Date.parse('2026-07-01T09:00:00Z');

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

const rows = () => h.mem.db.select().from(events).all();
const toast = () => screen.queryByRole('alert');
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const undo = () => press('Undo');
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('undo toast on every save (P1-12)', () => {
  it.each([
    ['a bottle feed', ['Log feed', 'Save'], 'Feed saved'],
    ['a diaper', ['Diaper', 'Wet'], 'Diaper saved'],
    ['a sleep start', ['Sleep', 'Start sleep now'], 'Sleep started'],
    ['a past sleep', ['Sleep', 'Save past sleep'], 'Sleep saved'],
  ])('offers Undo after %s, and Undo takes it back', async (_what, taps, message) => {
    await renderApp(h.repo);
    const listBefore = h.repo.list();
    for (const tap of taps) await press(tap);

    expect(toast()).toHaveTextContent(new RegExp(message));
    expect(h.repo.list()).toHaveLength(listBefore.length + 1);
    await undo();

    expect(h.repo.list()).toEqual(listBefore);
    expect(toast()).toBeNull();
    // Home reflects it at once.
    expect(screen.getByLabelText('Feeds: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wet: 0')).toBeOnTheScreen();
  });

  it('offers Undo after a health note and a medication', async () => {
    await renderApp(h.repo);
    await press('Health note');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Warm');
    await press('Save');
    expect(toast()).toHaveTextContent(/Health note saved/);
    await undo();
    await press('Medication');
    await fireEvent.changeText(screen.getByLabelText('Medication name'), 'Vitamin D');
    await press('Save');
    expect(toast()).toHaveTextContent(/Medication saved/);
    await undo();
    expect(h.repo.list()).toEqual([]);
  });

  it('undoes a mixed feed as one thing: both parts go', async () => {
    await renderApp(h.repo);
    await press('Log feed');
    await fireEvent.press(
      within(screen.getByLabelText('Feed type')).getByRole('radio', { name: 'Both' }),
    );
    await press('Save');
    expect(h.repo.list()).toHaveLength(2);
    await undo();
    expect(h.repo.list()).toEqual([]);
  });

  it('restores a stopped sleep exactly: the stored row is identical to before', async () => {
    h.repo.insert({ type: 'sleep', occurredAt: NOW - 40 * MIN, payload: {} });
    await renderApp(h.repo);
    const before = rows();
    await wait(5 * MIN);
    await press('Stop sleep');
    expect(toast()).toHaveTextContent(/Sleep stopped/);
    expect(screen.queryByTestId('home-sleep')).toBeNull();

    await undo();
    expect(rows()).toEqual(before);
    expect(within(screen.getByTestId('home-sleep')).getByRole('timer')).toHaveTextContent('45m');
  });

  it('still undoes just before 6 seconds, and is gone at 6 seconds', async () => {
    await renderApp(h.repo);
    await press('Diaper');
    await press('Wet');
    await wait(UNDO_WINDOW_MS - 100);
    await undo();
    expect(h.repo.list()).toEqual([]);

    await press('Diaper');
    await press('Dirty');
    await wait(UNDO_WINDOW_MS);
    expect(toast()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(h.repo.list()).toHaveLength(1);
  });

  it('offers Undo for the latest save only', async () => {
    await renderApp(h.repo);
    await press('Diaper');
    await press('Wet');
    await press('Diaper');
    await press('Dirty');
    await undo();
    expect(h.repo.list().map((e) => (e.payload as { kind: string }).kind)).toEqual(['wet']);
    expect(toast()).toBeNull();
  });
});
