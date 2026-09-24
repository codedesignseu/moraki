import type { Event } from '../activities';

export type ExportBaby = {
  name: string;
  bornAt: number | null;
  birthWeightG: number | null;
};

export type ExportCaregiver = { userId: string; displayName: string; role: string };

export type ExportSubject = {
  householdId: string | null;
  baby: ExportBaby | null;
  caregivers: ExportCaregiver[];
};

/** Every column a CSV row carries, in the order they are written. */
export const CSV_COLUMNS = [
  'id',
  'type',
  'occurred_at',
  'ended_at',
  'deleted_at',
  'group_id',
  'created_by',
  'updated_by',
  'payload',
] as const;

const iso = (at: number | null) => (at === null ? '' : new Date(at).toISOString());

/** RFC 4180: quote everything, double the quotes inside. Nothing can break a row. */
const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/**
 * Everything this household has, in two shapes (SDD 12, P4-05). The consent
 * screen promises an export, so this is that promise kept: every entry,
 * including the deleted ones, because a copy that quietly left things out
 * would not be the data someone asked for.
 *
 * Pure, so what is exported is exactly what the phone holds, and a test can
 * read it. Times are ISO 8601 in UTC: a spreadsheet reads them, and they
 * carry no timezone guesswork.
 */
export function exportJson(
  events: readonly Event<unknown>[],
  subject: ExportSubject,
  exportedAt: number,
): string {
  return JSON.stringify(
    {
      exportedAt: iso(exportedAt),
      app: 'Moraki',
      householdId: subject.householdId,
      baby: subject.baby && {
        name: subject.baby.name,
        bornAt: iso(subject.baby.bornAt),
        birthWeightG: subject.baby.birthWeightG,
      },
      caregivers: subject.caregivers,
      events: [...events]
        .sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id))
        .map((e) => ({
          id: e.id,
          type: e.type,
          occurredAt: iso(e.occurredAt),
          endedAt: iso(e.endedAt),
          deletedAt: iso(e.deletedAt),
          groupId: e.groupId,
          createdBy: e.createdBy,
          updatedBy: e.updatedBy,
          clientCreatedAt: iso(e.clientCreatedAt),
          payload: e.payload,
        })),
    },
    null,
    2,
  );
}

/** The same entries as a spreadsheet: one row each, the payload as JSON. */
export function exportCsv(events: readonly Event<unknown>[]): string {
  const rows = [...events]
    .sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id))
    .map((e) =>
      [
        e.id,
        e.type,
        iso(e.occurredAt),
        iso(e.endedAt),
        iso(e.deletedAt),
        e.groupId ?? '',
        e.createdBy,
        e.updatedBy,
        JSON.stringify(e.payload),
      ]
        .map(cell)
        .join(','),
    );
  return [CSV_COLUMNS.map(cell).join(','), ...rows].join('\r\n');
}

/** A name someone can find again: the baby, the date, and what it is. */
export function exportFileName(babyName: string, exportedAt: number, kind: 'json' | 'csv'): string {
  const slug = babyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `moraki-${slug || 'export'}-${iso(exportedAt).slice(0, 10)}.${kind}`;
}
