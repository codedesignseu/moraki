import { fireEvent, screen } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { selectStock } from '@/domain/stock/stockState';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const HOUR = 3_600_000;
const NOW = Date.parse('2026-07-01T09:00:00Z');

let repo: EventsRepository;

beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

const renderApp = () => renderRoutes(repo);
const pumps = () => repo.list().filter((e) => e.type === 'pump');
const fridge = () => selectStock(repo.list()).fridge;

async function openPumpSheet() {
  await renderApp();
  await fireEvent.press(screen.getByRole('button', { name: 'Pump' }));
}

describe('logging a pump session', () => {
  it('saves the amount and where it went, from home', async () => {
    await openPumpSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Freezer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(pumps()).toHaveLength(1);
    expect(pumps()[0]?.payload).toEqual({ ml: 100, dest: 'freezer' });
    expect(selectStock(repo.list()).freezer.ml).toBe(100);
  });

  it('opens with the last session’s amount and place, so a repeat is two taps', async () => {
    repo.insert({ type: 'pump', occurredAt: NOW - HOUR, payload: { ml: 160, dest: 'fridge' } });

    await openPumpSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(pumps()).toHaveLength(2);
    expect(pumps().map((e) => e.payload)).toContainEqual({ ml: 160, dest: 'fridge' });
    expect(fridge().ml).toBe(320);
  });

  it('adds nothing to a store when the milk was fed straight away', async () => {
    await openPumpSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Fed straight away' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(pumps()[0]?.payload).toMatchObject({ dest: 'fed' });
    expect(fridge().ml).toBe(0);
    expect(selectStock(repo.list()).freezer.ml).toBe(0);
  });

  it('can be undone straight after saving', async () => {
    await openPumpSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(fridge().ml).toBe(100);

    await fireEvent.press(await screen.findByRole('button', { name: 'Undo' }));
    expect(fridge().ml).toBe(0);
  });
});

describe('pouring a bottle from the fridge', () => {
  it('takes it off the fridge total, which the sheet shows', async () => {
    repo.insert({ type: 'pump', occurredAt: NOW - HOUR, payload: { ml: 200, dest: 'fridge' } });

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
    // The store only comes up for expressed milk, so the totals appear with it.
    await fireEvent.press(screen.getByRole('radio', { name: 'Breast milk' }));
    expect(screen.getByText('Fridge 200 mL · Freezer 0 mL')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Fridge' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const bottle = repo.list().find((e) => e.type === 'feed_bottle');
    expect(bottle?.payload).toMatchObject({ from_stock: 'fridge' });
    expect(fridge().ml).toBe(200 - 90);

    // The next feed opens on the same store, with the new total.
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
    expect(screen.getByText('Fridge 110 mL · Freezer 0 mL')).toBeOnTheScreen();
  });

  it('is not from a store unless someone says so', async () => {
    repo.insert({ type: 'pump', occurredAt: NOW - HOUR, payload: { ml: 200, dest: 'fridge' } });

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const bottle = repo.list().find((e) => e.type === 'feed_bottle');
    expect(bottle?.payload).not.toHaveProperty('from_stock');
    expect(fridge().ml).toBe(200);
  });

  it('gives the milk back when the entry is edited off the store', async () => {
    repo.insert({ type: 'pump', occurredAt: NOW - HOUR, payload: { ml: 200, dest: 'fridge' } });
    const bottle = repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 600_000,
      payload: { ml: 90, milk: 'breast', from_stock: 'fridge' },
    });
    expect(fridge().ml).toBe(110);

    await renderApp();
    await fireEvent.press(screen.getByTestId(`recent-${bottle.id}`));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Not from a store' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    // The place is gone from the entry, not just blank, so the fold stops
    // taking from a store that never gave the milk.
    expect(repo.get(bottle.id)?.payload).not.toHaveProperty('from_stock');
    expect(fridge().ml).toBe(200);
  });

  it('moves the milk when the entry is edited to the other store', async () => {
    repo.insert({ type: 'pump', occurredAt: NOW - 2 * HOUR, payload: { ml: 200, dest: 'fridge' } });
    repo.insert({
      type: 'pump',
      occurredAt: NOW - 2 * HOUR,
      payload: { ml: 300, dest: 'freezer' },
    });
    const bottle = repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 600_000,
      payload: { ml: 90, milk: 'breast', from_stock: 'fridge' },
    });

    await renderApp();
    await fireEvent.press(screen.getByTestId(`recent-${bottle.id}`));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Freezer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(repo.get(bottle.id)?.payload).toMatchObject({ from_stock: 'freezer' });
    expect(fridge().ml).toBe(200);
    expect(selectStock(repo.list()).freezer.ml).toBe(210);
  });

  it('never pours formula out of the fridge', async () => {
    repo.insert({ type: 'pump', occurredAt: NOW - HOUR, payload: { ml: 200, dest: 'fridge' } });

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Breast milk' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Fridge' }));
    // Switching to formula drops the store rather than draining it quietly.
    await fireEvent.press(screen.getByRole('radio', { name: 'Formula' }));
    expect(screen.queryByRole('radio', { name: 'Fridge' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(repo.list().find((e) => e.type === 'feed_bottle')?.payload).not.toHaveProperty(
      'from_stock',
    );
    expect(fridge().ml).toBe(200);
  });
});
