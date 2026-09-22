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

  it('deletes both parts of a mixed feed together (not editable until part C2), and Undo restores both', async () => {
    const [a, b] = h.repo.insertGroup([
      { type: 'feed_bottle', occurredAt: NOW - HOUR, payload: { ml: 60, milk: 'formula' } },
      { type: 'feed_breast', occurredAt: NOW - HOUR, payload: { side: 'left' } },
    ]);
    await openFromHistory(a!.id);
    expect(
      screen.getByText('Editing this kind of entry comes later. You can delete it.'),
    ).toBeOnTheScreen();
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
