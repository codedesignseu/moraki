import { fireEvent, screen } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 in Nicosia

let repo: EventsRepository;
let mem: Harness['mem'];

beforeEach(async () => {
  ({ repo, mem } = await createHarness(NOW));
});

afterEach(() => {
  jest.useRealTimers();
});

async function openSheet() {
  await renderApp(repo);
  await fireEvent.press(screen.getByRole('button', { name: 'Diaper' }));
}

const diapers = () => repo.list().filter((e) => e.type === 'diaper');

describe('logging a diaper', () => {
  it('opens from home with the current time', async () => {
    await openSheet();
    expect(screen.getByText('At 12:00')).toBeOnTheScreen();
  });

  it.each([
    ['Wet', 'wet', { wet: 1, dirty: 0 }],
    ['Dirty', 'dirty', { wet: 0, dirty: 1 }],
    ['Wet and dirty', 'both', { wet: 1, dirty: 1 }],
  ])('saves %s in one tap from the sheet and returns home', async (label, kind, today) => {
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: label })); // the one tap

    expect(diapers()).toEqual([
      expect.objectContaining({ type: 'diaper', occurredAt: NOW, payload: { kind } }),
    ]);
    // Home again, already counting it.
    expect(screen.queryByRole('button', { name: label })).toBeNull();
    expect(screen.getByLabelText(`Wet: ${today.wet}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Dirty: ${today.dirty}`)).toBeOnTheScreen();
  });

  it('queues the diaper for sync in the same write (rule 2)', async () => {
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Wet' }));
    const [op] = mem.sqlite.exec('select op, entity_id from outbox')[0]?.values ?? [];
    expect(op).toEqual(['insert', diapers()[0]?.id]);
  });
});
