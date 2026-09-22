import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { UNDO_WINDOW_MS } from '@/db/repositories/events';
import { events, outbox } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { createHarness, renderApp, type Harness } from './appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z'); // Wed 1 Jul, 12:00 in Nicosia

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

const row = (id: string) => h.mem.db.select().from(events).where(eq(events.id, id)).get();
const allOutbox = () => h.mem.db.select().from(outbox).all();
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const toast = () => screen.queryByRole('alert');
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/** History tab, then tap the entry's row. */
async function openFromHistory(id: string) {
  await renderApp(h.repo);
  await press(/History/);
  await fireEvent.press(screen.getByTestId(`history-${id}`));
}

describe('editing an entry (P1-12)', () => {
  it('changes a diaper from a history row, and Undo restores it exactly', async () => {
    const { id } = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 30 * MIN,
      payload: { kind: 'wet' },
    });
    const before = row(id);
    await openFromHistory(id);
    await press('Dirty');

    expect(h.repo.get(id)?.payload).toEqual({ kind: 'dirty' });
    expect(toast()).toHaveTextContent('Entry updated');
    await press('Undo');
    expect(row(id)).toEqual({ ...before, updatedBy: before!.updatedBy });
    expect(h.repo.get(id)?.payload).toEqual({ kind: 'wet' });
  });

  it('moves an entry earlier with the time stepper, showing the new time', async () => {
    const { id } = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 30 * MIN,
      payload: { kind: 'wet' },
    });
    await openFromHistory(id);
    expect(screen.getByText('Time: Wed 1 Jul, 11:30')).toBeOnTheScreen();
    for (let i = 0; i < 3; i += 1) {
      await fireEvent(screen.getByLabelText('Move time'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
    }
    expect(screen.getByText('Time: Wed 1 Jul, 11:15')).toBeOnTheScreen();
    await press('Wet');
    expect(h.repo.get(id)).toMatchObject({ occurredAt: NOW - 45 * MIN, payload: { kind: 'wet' } });
  });

  it('writes nothing when nothing changed', async () => {
    const { id } = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 30 * MIN,
      payload: { kind: 'wet' },
    });
    const ops = allOutbox().length;
    await openFromHistory(id);
    await press('Wet');
    expect(allOutbox()).toHaveLength(ops);
    expect(toast()).toBeNull();
  });

  it('edits a health note from a home row, removing a cleared temperature; Undo brings it back', async () => {
    const { id } = h.repo.insert({
      type: 'health',
      occurredAt: NOW - 20 * MIN,
      payload: { note: 'Warm', temp_c: 37.9, tags: ['cough'] },
    });
    const before = row(id);
    await renderApp(h.repo);
    await fireEvent.press(screen.getByTestId(`recent-${id}`));
    expect(screen.getByLabelText('Temperature in °C (optional)').props.value).toBe('37.9');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Warm, settled after feed');
    await fireEvent.changeText(screen.getByLabelText('Temperature in °C (optional)'), '');
    await press('Save');

    expect(h.repo.get(id)?.payload).toEqual({ note: 'Warm, settled after feed', tags: ['cough'] });
    const patch = JSON.parse(allOutbox().at(-1)!.body) as Record<string, unknown>;
    expect(patch.unset).toEqual(['temp_c']);
    await press('Undo');
    expect(row(id)?.payload).toEqual(before?.payload);
  });

  it('edits a medication, removing a cleared dose', async () => {
    const { id } = h.repo.insert({
      type: 'medication',
      occurredAt: NOW - 20 * MIN,
      payload: { name: 'Vitamin D', dose: '1 drop' },
    });
    await openFromHistory(id);
    expect(screen.getByLabelText('Medication name').props.value).toBe('Vitamin D');
    await fireEvent.changeText(screen.getByLabelText('Dose (optional)'), '');
    await press('Save');
    expect(h.repo.get(id)?.payload).toEqual({ name: 'Vitamin D' });
  });
});

describe('deleting an entry (P1-12)', () => {
  it('deletes with Undo, and Undo inside 6s restores the row and the outbox exactly', async () => {
    const { id } = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 30 * MIN,
      payload: { kind: 'wet' },
    });
    const rowBefore = row(id);
    const outboxBefore = allOutbox();
    await openFromHistory(id);
    await press('Delete entry');

    expect(h.repo.list()).toEqual([]);
    expect(toast()).toHaveTextContent('Entry deleted');
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();
    await wait(UNDO_WINDOW_MS - 100);
    await press('Undo');

    expect(row(id)).toEqual(rowBefore);
    expect(allOutbox()).toEqual(outboxBefore);
    expect(
      within(screen.getByTestId('history-list')).getByTestId(`history-${id}`),
    ).toBeOnTheScreen();
  });

  it('keeps the delete once the 6s window has passed', async () => {
    const { id } = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 30 * MIN,
      payload: { kind: 'wet' },
    });
    await openFromHistory(id);
    await press('Delete entry');
    await wait(UNDO_WINDOW_MS);
    expect(toast()).toBeNull();
    expect(h.repo.list()).toEqual([]);
    expect(allOutbox().at(-1)).toMatchObject({ op: 'delete', notBefore: NOW + UNDO_WINDOW_MS });
  });

  it('deletes both parts of a mixed feed together, and Undo restores both', async () => {
    const [a, b] = h.repo.insertGroup([
      { type: 'feed_bottle', occurredAt: NOW - HOUR, payload: { ml: 60, milk: 'formula' } },
      { type: 'feed_breast', occurredAt: NOW - HOUR, payload: { side: 'left' } },
    ]);
    await openFromHistory(a!.id);
    await press('Delete entry');
    expect(h.repo.list()).toEqual([]);
    await press('Undo');
    expect(
      h.repo
        .list()
        .map((e) => e.id)
        .sort(),
    ).toEqual([a!.id, b!.id].sort());
  });
});

describe('editing feeds and sleeps (P1-12 part C2)', () => {
  const step = async (label: string, actionName: 'increment' | 'decrement', times = 1) => {
    for (let i = 0; i < times; i += 1) {
      await fireEvent(screen.getByLabelText(label), 'accessibilityAction', {
        nativeEvent: { actionName },
      });
    }
  };

  it('edits a bottle feed amount and milk, and Undo restores it exactly', async () => {
    const { id } = h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const before = row(id);
    await openFromHistory(id);
    await step('Amount', 'increment');
    await fireEvent.press(
      within(screen.getByLabelText('Milk')).getByRole('radio', { name: 'Breast milk' }),
    );
    await press('Save');

    expect(h.repo.get(id)?.payload).toEqual({ ml: 100, milk: 'breast' });
    await press('Undo');
    expect(row(id)).toEqual({ ...before, updatedBy: before!.updatedBy });
  });

  it("keeps a logged feed's kind: the kind selector is disabled", async () => {
    const { id } = h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    await openFromHistory(id);
    const kinds = within(screen.getByLabelText('Feed type'));
    for (const name of ['Bottle', 'Breast', 'Both']) {
      expect(kinds.getByRole('radio', { name })).toBeDisabled();
    }
    await fireEvent.press(kinds.getByRole('radio', { name: 'Breast' }));
    expect(screen.queryByLabelText('Fed for')).toBeNull();
  });

  it('edits both parts of a mixed feed in one save, and one Undo restores both exactly', async () => {
    const [bottle, breast] = h.repo.insertGroup([
      { type: 'feed_bottle', occurredAt: NOW - HOUR, payload: { ml: 60, milk: 'formula' } },
      {
        type: 'feed_breast',
        occurredAt: NOW - HOUR,
        endedAt: NOW - HOUR + 15 * MIN,
        payload: { side: 'left' },
      },
    ]);
    const before = [row(bottle!.id), row(breast!.id)];
    await openFromHistory(breast!.id);
    expect(screen.getByLabelText('Fed for')).toHaveAccessibilityValue({ now: 15 });
    await step('Amount', 'increment', 2);
    await fireEvent.press(
      within(screen.getByLabelText('Side')).getByRole('radio', { name: 'Right' }),
    );
    await step('Fed for', 'increment');
    await step('Move time', 'decrement', 2);
    await press('Save');

    const start = NOW - HOUR - 10 * MIN;
    expect(h.repo.get(bottle!.id)).toMatchObject({
      occurredAt: start,
      payload: { ml: 80, milk: 'formula' },
    });
    expect(h.repo.get(breast!.id)).toMatchObject({
      occurredAt: start,
      endedAt: start + 20 * MIN,
      payload: { side: 'right' },
    });
    expect(toast()).toHaveTextContent('Entry updated');

    await press('Undo');
    expect([row(bottle!.id), row(breast!.id)].map((r) => r?.payload)).toEqual(
      before.map((r) => r?.payload),
    );
    expect([row(bottle!.id), row(breast!.id)].map((r) => [r?.occurredAt, r?.endedAt])).toEqual(
      before.map((r) => [r?.occurredAt, r?.endedAt]),
    );
  });

  it("changes a breastfeed's duration, and today's breastfeeding time follows", async () => {
    const { id } = h.repo.insert({
      type: 'feed_breast',
      occurredAt: NOW - HOUR,
      endedAt: NOW - HOUR + 15 * MIN,
      payload: { side: 'left' },
    });
    await openFromHistory(id);
    await step('Fed for', 'increment', 3);
    await press('Save');
    expect(h.repo.get(id)).toMatchObject({
      occurredAt: NOW - HOUR,
      endedAt: NOW - HOUR + 30 * MIN,
    });
    await press(/Home/);
    expect(screen.getByLabelText('Breastfeeding: 30m')).toBeOnTheScreen();
  });

  it("moves a finished sleep's start and changes how long it lasted", async () => {
    const { id } = h.repo.insert({
      type: 'sleep',
      occurredAt: NOW - 3 * HOUR,
      endedAt: NOW - 2 * HOUR,
      payload: {},
    });
    const before = row(id);
    await openFromHistory(id);
    expect(screen.getByText('Ended: 10:00')).toBeOnTheScreen();
    await step('Move start', 'decrement', 6);
    await step('Slept for', 'increment', 2);
    expect(screen.getByText('Started: Wed 1 Jul, 08:30')).toBeOnTheScreen();
    expect(screen.getByText('Ended: 09:40')).toBeOnTheScreen();
    await press('Save');
    expect(h.repo.get(id)).toMatchObject({
      occurredAt: NOW - 3 * HOUR - 30 * MIN,
      endedAt: NOW - 3 * HOUR + 40 * MIN,
    });
    await press('Undo');
    expect(row(id)).toEqual({ ...before, updatedBy: before!.updatedBy });
  });

  it("won't move a running sleep's start into the future", async () => {
    const { id } = h.repo.insert({ type: 'sleep', occurredAt: NOW - 20 * MIN, payload: {} });
    await openFromHistory(id);
    await step('Move start', 'increment', 10);
    expect(screen.getByText('Started: Wed 1 Jul, 12:00')).toBeOnTheScreen();
    await press('Save');
    expect(h.repo.get(id)).toMatchObject({ occurredAt: NOW, endedAt: null });
  });
});
