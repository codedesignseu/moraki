import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

/**
 * The device's file system and share sheet, in memory. `written` keeps what
 * each file held; `onDisk` is what is still in the cache right now.
 */
const written = new Map<string, string>();
const onDisk = new Set<string>();
const mockShare = jest.fn(async (_uri: string, _options: Record<string, unknown>) => undefined);
const mockAvailable = jest.fn(async () => true);

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache/' },
  File: class {
    uri: string;
    constructor(dir: string, name: string) {
      this.uri = `${dir}${name}`;
    }
    private get bag() {
      return globalThis as {
        __written?: Map<string, string>;
        __onDisk?: Set<string>;
        __writeFails?: boolean;
      };
    }
    get exists() {
      return this.bag.__onDisk?.has(this.uri) ?? false;
    }
    create() {
      this.bag.__onDisk?.add(this.uri);
    }
    write(text: string) {
      if (this.bag.__writeFails) throw new Error('ENOSPC /cache/moraki-ella-health.json');
      this.bag.__written?.set(this.uri, text);
    }
    delete() {
      this.bag.__onDisk?.delete(this.uri);
    }
  },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockAvailable(),
  shareAsync: (uri: string, options: Record<string, unknown>) => mockShare(uri, options),
}));

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;

beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
  written.clear();
  onDisk.clear();
  const bag = globalThis as {
    __written?: Map<string, string>;
    __onDisk?: Set<string>;
    __writeFails?: boolean;
  };
  bag.__written = written;
  bag.__onDisk = onDisk;
  bag.__writeFails = false;
  mockShare.mockReset();
  mockShare.mockImplementation(async () => undefined);
  mockAvailable.mockClear();
  mockAvailable.mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
});

async function exportFromSettings() {
  await renderApp(repo);
  await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Export my data' }));
}

describe('exporting everything', () => {
  it('writes both files on the phone and hands each to the share sheet', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    await exportFromSettings();

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(2));
    const kinds = mockShare.mock.calls.map((call) => call[1]?.mimeType);
    expect(kinds).toEqual(['application/json', 'text/csv']);
    // Nothing was uploaded to make them: both came from this phone's cache.
    expect([...written.keys()].every((uri) => uri.startsWith('file:///cache/'))).toBe(true);
  });

  it('puts every entry in both files', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    await exportFromSettings();
    await waitFor(() => expect(written.size).toBe(2));

    const json = JSON.parse([...written.values()].find((t) => t.startsWith('{')) ?? '{}');
    expect(json.events).toHaveLength(2);
    const csv = [...written.values()].find((t) => t.startsWith('"id"')) ?? '';
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('says so when the device has nowhere to share a file, and writes nothing', async () => {
    mockAvailable.mockResolvedValue(false);
    await exportFromSettings();

    expect(await screen.findByTestId('export-problem')).toHaveTextContent(
      /This device has nowhere to share a file./,
    );
    expect(written.size).toBe(0);
  });

  it('works on a phone with no household yet', async () => {
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    await exportFromSettings();
    await waitFor(() => expect(written.size).toBe(2));

    const json = JSON.parse([...written.values()].find((t) => t.startsWith('{')) ?? '{}');
    expect(json).toMatchObject({ householdId: null, baby: null, caregivers: [] });
    expect(json.events).toHaveLength(1);
  });

  it('says the export couldn’t be made, without repeating the reason', async () => {
    (globalThis as { __writeFails?: boolean }).__writeFails = true;
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });

    await exportFromSettings();

    const problem = await screen.findByTestId('export-problem');
    expect(problem).toHaveTextContent(/The export couldn't be made. Try again./);
    // The reason can name a file holding health data, so it is never shown.
    expect(problem).not.toHaveTextContent(/ENOSPC|ella|health/i);
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('deletes each file from the cache once its share sheet closes', async () => {
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    // Each file is still there while its own share sheet is open...
    const presentWhileSharing: boolean[] = [];
    mockShare.mockImplementation(async (uri: string) => {
      presentWhileSharing.push(onDisk.has(uri));
    });

    await exportFromSettings();

    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(2));
    expect(presentWhileSharing).toEqual([true, true]);
    // ...and gone once it closes: no copy of the household stays behind.
    await waitFor(() => expect(onDisk.size).toBe(0));
    expect(written.size).toBe(2);
  });

  it('deletes the file when the share sheet fails', async () => {
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    mockShare.mockImplementation(async () => {
      throw new Error('share sheet dismissed badly');
    });

    await exportFromSettings();

    expect(await screen.findByTestId('export-problem')).toHaveTextContent(
      /The export couldn't be made. Try again./,
    );
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(onDisk.size).toBe(0);
  });

  it('deletes a half-written file when writing it fails', async () => {
    (globalThis as { __writeFails?: boolean }).__writeFails = true;
    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });

    await exportFromSettings();

    await screen.findByTestId('export-problem');
    expect(onDisk.size).toBe(0);
  });

  it('is offered on a phone that has never signed in', async () => {
    // The consent screen promises "You can export everything". The entries
    // are this phone's whether or not there is an account behind them, so
    // the offer doesn't wait for one.
    await renderApp(repo);
    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));

    const card = within(await screen.findByTestId('settings-data'));
    expect(card.getByRole('button', { name: 'Export my data' })).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-privacy')).toBeNull();
  });
});
