import type { Event, EventType } from '../activities';
import { CSV_COLUMNS, exportCsv, exportFileName, exportJson } from './exportHousehold';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 28, 12, 0);

let n = 0;
function ev<P>(type: EventType, occurredAt: number, payload: P, extra: Partial<Event<P>> = {}) {
  n += 1;
  return {
    id: `e${n}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'maria',
    updatedBy: 'maria',
    clientCreatedAt: occurredAt,
    deletedAt: null,
    ...extra,
  } satisfies Event<P>;
}

const subject = {
  householdId: 'household-1',
  baby: { name: 'Ella', bornAt: Date.UTC(2026, 9, 9, 6, 20), birthWeightG: 3400 },
  caregivers: [{ userId: 'maria', displayName: 'Maria', role: 'owner' }],
};

const events = [
  ev('feed_bottle', NOW - 2 * HOUR, { ml: 90, milk: 'formula' }),
  ev('diaper', NOW - HOUR, { kind: 'wet' }),
];

describe('the export someone asked for', () => {
  it('carries the household, the baby and who is in it', () => {
    const out = JSON.parse(exportJson(events, subject, NOW));
    expect(out).toMatchObject({
      app: 'Moraki',
      exportedAt: '2026-10-28T12:00:00.000Z',
      householdId: 'household-1',
      baby: { name: 'Ella', bornAt: '2026-10-09T06:20:00.000Z', birthWeightG: 3400 },
      caregivers: [{ userId: 'maria', displayName: 'Maria', role: 'owner' }],
    });
  });

  it('carries every entry, oldest first, with its payload intact', () => {
    const out = JSON.parse(exportJson(events, subject, NOW));
    expect(out.events).toHaveLength(2);
    expect(out.events[0]).toMatchObject({
      type: 'feed_bottle',
      occurredAt: '2026-10-28T10:00:00.000Z',
      payload: { ml: 90, milk: 'formula' },
      createdBy: 'maria',
    });
  });

  it('includes the deleted ones, marked as deleted', () => {
    const gone = ev('diaper', NOW - 3 * HOUR, { kind: 'dirty' }, { deletedAt: NOW });
    const out = JSON.parse(exportJson([...events, gone], subject, NOW));
    // A copy that quietly left things out would not be the data asked for.
    expect(out.events).toHaveLength(3);
    expect(out.events[0]).toMatchObject({ id: gone.id, deletedAt: '2026-10-28T12:00:00.000Z' });
  });

  it('holds up with nothing logged and no household', () => {
    const out = JSON.parse(exportJson([], { householdId: null, baby: null, caregivers: [] }, NOW));
    expect(out).toMatchObject({ householdId: null, baby: null, caregivers: [], events: [] });
  });
});

describe('the spreadsheet copy', () => {
  it('starts with a header naming every column', () => {
    const [header] = exportCsv(events).split('\r\n');
    expect(header).toBe(CSV_COLUMNS.map((c) => `"${c}"`).join(','));
  });

  it('writes one row per entry, oldest first', () => {
    const rows = exportCsv(events).split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('"feed_bottle"');
    expect(rows[1]).toContain('"2026-10-28T10:00:00.000Z"');
    expect(rows[2]).toContain('"diaper"');
  });

  it('cannot be broken by what someone typed', () => {
    // A note with a comma, a quote and a newline in it: still one row.
    const nasty = ev('health', NOW, { note: 'She said "fine", then\nnot fine' });
    const rows = exportCsv([nasty]).split('\r\n');
    // Still one header and one row: the newline lives inside the payload's
    // own JSON escaping, so it can't split the file.
    expect(rows).toHaveLength(2);
    expect(rows[1]?.startsWith(`"${nasty.id}"`)).toBe(true);

    // And the payload cell reads back as what was typed, quotes and all.
    const cells = rows[1]?.slice(1, -1).split('","') ?? [];
    expect(JSON.parse(cells[cells.length - 1]?.replace(/""/g, '"') ?? '')).toEqual({
      note: 'She said "fine", then\nnot fine',
    });
  });

  it('leaves an empty cell where there is no time, rather than a zero', () => {
    const row = exportCsv([events[0]!]).split('\r\n')[1] ?? '';
    // ended_at, deleted_at and group_id are empty for a bottle feed.
    expect(row).toContain('"",""');
  });
});

describe('the file name', () => {
  it('says whose it is, when it was made and what it holds', () => {
    expect(exportFileName('Ella', NOW, 'json')).toBe('moraki-ella-2026-10-28.json');
    expect(exportFileName('Ella', NOW, 'csv')).toBe('moraki-ella-2026-10-28.csv');
  });

  it('copes with a name that is not plain letters', () => {
    expect(exportFileName('Μωράκι  ', NOW, 'csv')).toBe('moraki-export-2026-10-28.csv');
    expect(exportFileName('Anna-Maria', NOW, 'json')).toBe('moraki-anna-maria-2026-10-28.json');
  });
});
