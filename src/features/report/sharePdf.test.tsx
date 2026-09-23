import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const mockPrint = jest.fn(async (_options: { html: string }) => ({
  uri: 'file:///tmp/report.pdf',
}));
const mockShare = jest.fn(async (_uri: string, _options: Record<string, unknown>) => undefined);
const mockAvailable = jest.fn(async () => true);
jest.mock('expo-print', () => ({
  printToFileAsync: (options: { html: string }) => mockPrint(options),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockAvailable(),
  shareAsync: (uri: string, options: Record<string, unknown>) => mockShare(uri, options),
}));

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-21T14:00:00+03:00');
const BORN = Date.parse('2026-10-09T06:20:00+03:00');

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
  mockPrint.mockClear();
  mockShare.mockClear();
  mockAvailable.mockClear();
  mockAvailable.mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
});

function knowsTheBaby() {
  prefs.set('accountHousehold', {
    userId: '0190a0b0-0000-7000-8000-00000000000a',
    householdId: '0190a0b0-0000-7000-8000-0000000000a1',
    babyId: '0190a0b0-0000-7000-8000-0000000000b1',
    babyName: 'Ella',
    role: 'owner',
    bornAt: BORN,
    birthWeightG: 3400,
  });
}

async function openReport(label = 'Last 24 hours') {
  await renderRoutes(repo);
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
  await fireEvent.press(await screen.findByRole('button', { name: label }));
  await screen.findByTestId('report-header');
}

describe('the report preview', () => {
  it('opens from Settings and shows what the PDF will say', async () => {
    knowsTheBaby();
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'breast' },
    });
    repo.insert({
      type: 'weight',
      occurredAt: NOW - 2 * HOUR,
      payload: { grams: 3510, source: 'clinic' },
    });

    await openReport();
    expect(
      within(screen.getByTestId('report-header')).getByText('Moraki report — Ella'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('report-weight')).getByLabelText('Birth weight: 3400 g'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('report-feeds')).getByLabelText('Bottle total: 90 mL'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Logged by hand in Moraki. Not a medical record.')).toBeOnTheScreen();
  });

  it('shows no day table for 24 hours: one row says nothing a section hasn’t', async () => {
    knowsTheBaby();
    await openReport();
    expect(screen.queryByTestId('report-days')).toBeNull();
  });

  it('shows a row per day for 7 days', async () => {
    knowsTheBaby();
    await openReport('Last 7 days');
    const table = within(await screen.findByTestId('report-days'));
    expect(table.getAllByTestId(/^report-day-/)).toHaveLength(7);
  });
});

describe('sharing the PDF', () => {
  it('renders it on the device and hands it to the share sheet', async () => {
    knowsTheBaby();
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'breast' },
    });
    await openReport();

    await fireEvent.press(screen.getByRole('button', { name: 'Share as PDF' }));

    expect(mockPrint).toHaveBeenCalledTimes(1);
    const html = mockPrint.mock.calls[0]?.[0].html ?? '';
    expect(html).toContain('Moraki report — Ella');
    expect(html).toContain('90');

    expect(mockShare).toHaveBeenCalledWith(
      'file:///tmp/report.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
  });

  it('says so when the device has nowhere to share a file', async () => {
    knowsTheBaby();
    mockAvailable.mockResolvedValue(false);
    await openReport();

    await fireEvent.press(screen.getByRole('button', { name: 'Share as PDF' }));

    expect(await screen.findByTestId('report-problem')).toHaveTextContent(
      'This device has nowhere to share a file.',
    );
    expect(mockPrint).not.toHaveBeenCalled();
  });

  it('says the PDF couldn’t be made, without repeating the reason', async () => {
    knowsTheBaby();
    mockPrint.mockRejectedValueOnce(new Error('EACCES /var/ella-health-data.pdf'));
    await openReport();

    await fireEvent.press(screen.getByRole('button', { name: 'Share as PDF' }));

    const problem = await screen.findByTestId('report-problem');
    expect(problem).toHaveTextContent("The PDF couldn't be made. Try again.");
    // The reason can name a file holding health data, so it is never shown (rule 8).
    expect(problem).not.toHaveTextContent(/ella|EACCES/i);
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('works without a household record, using what the phone has', async () => {
    repo.insert({ type: 'diaper', occurredAt: NOW - HOUR, payload: { kind: 'wet' } });
    await openReport();

    await fireEvent.press(screen.getByRole('button', { name: 'Share as PDF' }));
    expect(mockPrint).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('report-problem')).toBeNull();
  });
});
