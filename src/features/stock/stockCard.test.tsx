import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { selectStock } from '@/domain/stock/stockState';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-07-01T09:00:00Z');

let repo: EventsRepository;

beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

const renderApp = () => renderRoutes(repo);
const card = () => within(screen.getByTestId('home-stock'));
const adjustments = () => repo.list().filter((e) => e.type === 'stock_adjust');
const stock = () => selectStock(repo.list());

const pump = (ago: number, ml: number, dest: 'fridge' | 'freezer') =>
  repo.insert({ type: 'pump', occurredAt: NOW - ago, payload: { ml, dest } });

describe('the stock card on home', () => {
  it('shows nothing in either store before anything is pumped', async () => {
    await renderApp();
    expect(card().getAllByText('0 mL')).toHaveLength(2);
    expect(card().queryByText(/Oldest/)).toBeNull();
  });

  it('shows what is in each store and how old the oldest is', async () => {
    pump(5 * HOUR, 200, 'fridge');
    pump(3 * DAY, 350, 'freezer');

    await renderApp();
    expect(card().getByText('200 mL')).toBeOnTheScreen();
    expect(card().getByText('350 mL')).toBeOnTheScreen();
    expect(card().getByText('Oldest 5 h')).toBeOnTheScreen();
    expect(card().getByText('Oldest 3 days')).toBeOnTheScreen();
  });

  it('ages by the oldest milk still there, not by what has been used', async () => {
    pump(4 * DAY, 100, 'fridge');
    pump(2 * HOUR, 150, 'fridge');
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 100, milk: 'breast', from_stock: 'fridge' },
    });

    await renderApp();
    expect(card().getByText('150 mL')).toBeOnTheScreen();
    expect(card().getByText('Oldest 2 h')).toBeOnTheScreen();
  });

  it('asks for the count to be checked once more has gone out than went in', async () => {
    pump(3 * HOUR, 100, 'fridge');
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 150, milk: 'breast', from_stock: 'fridge' },
    });

    await renderApp();
    // Nothing left, and no number anyone should trust.
    expect(card().getAllByText('0 mL')).toHaveLength(2); // the freezer is empty too
    expect(card().getByText('More has gone out than went in. Check the count.')).toBeOnTheScreen();
  });

  it('updates as soon as something is logged, with no reload', async () => {
    await renderApp();
    expect(card().getAllByText('0 mL')).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Pump' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(card().getByText('100 mL')).toBeOnTheScreen();
  });
});

describe('adjusting a store', () => {
  it('saves the reason with the change, and takes the milk off the count', async () => {
    pump(2 * HOUR, 300, 'fridge');

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Adjust Fridge' }));
    expect(await screen.findByText('Fridge now holds 300 mL')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Thrown away' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(adjustments()).toHaveLength(1);
    expect(adjustments()[0]?.payload).toEqual({
      loc: 'fridge',
      delta_ml: -50,
      reason: 'discard',
    });
    expect(stock().fridge.ml).toBe(250);
  });

  it('adds milk the phone didn’t know about, with its own reason', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Adjust Freezer' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Correcting the count' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(adjustments()[0]?.payload).toEqual({
      loc: 'freezer',
      delta_ml: 50,
      reason: 'correction',
    });
    expect(stock().freezer.ml).toBe(50);
  });

  it('opens on the store whose button was tapped, and can be changed there', async () => {
    pump(2 * HOUR, 300, 'fridge');
    pump(2 * HOUR, 80, 'freezer');

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Adjust Freezer' }));
    expect(await screen.findByText('Freezer now holds 80 mL')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Fridge' }));
    expect(screen.getByText('Fridge now holds 300 mL')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(adjustments()[0]?.payload).toMatchObject({ loc: 'fridge' });
  });

  it('settles a short count, so the card stops asking', async () => {
    pump(3 * HOUR, 100, 'fridge');
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 150, milk: 'breast', from_stock: 'fridge' },
    });

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Adjust Fridge' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(stock().fridge).toMatchObject({ ml: 0, short: false });
    expect(card().queryByText('More has gone out than went in. Check the count.')).toBeNull();
  });

  it('can be undone straight after saving', async () => {
    pump(2 * HOUR, 300, 'fridge');

    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Adjust Fridge' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(stock().fridge.ml).toBe(250);

    await fireEvent.press(await screen.findByRole('button', { name: 'Undo' }));
    expect(stock().fridge.ml).toBe(300);
  });
});
