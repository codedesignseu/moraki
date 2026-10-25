import type { Event } from '../activities';

export type ExportBaby = {
  name: string;
  bornAt: number | null;
  birthWeightG: number | null;
};

export type ExportCaregiver = { userId: string; displayName: string; role: string };

/** One consent row as the server holds it: the current state for a policy version. */
export type ExportConsent = {
  policyVersion: string;
  grantedAt: number;
  withdrawnAt: number | null;
};

/** One grant or withdrawal from the consent history, where the server keeps one. */
export type ExportConsentEvent = {
  purpose: string;
  version: string;
  action: string;
  textKey: string;
  locale: string | null;
  householdId: string | null;
  babyId: string | null;
  at: number;
};

/** One message the person sent through Settings → Send feedback. */
export type ExportFeedback = {
  kind: string;
  message: string;
  appVersion: string | null;
  platform: string | null;
  locale: string | null;
  sentAt: number;
};

/**
 * The signed-in person's own records (legal review P0.10): who they are to the
 * server, and what the server holds about them that is not the household's.
 * `records` is null when the server could not be asked (offline, say): the
 * export still goes ahead, and says so rather than implying there is nothing.
 */
export type ExportAccount = {
  userId: string;
  email: string | null;
  providers: string[];
  records: {
    consents: ExportConsent[];
    /** Absent where the server has no consent history to read. */
    consentEvents: ExportConsentEvent[] | null;
    feedback: ExportFeedback[];
  } | null;
};

export type ExportSubject = {
  householdId: string | null;
  baby: ExportBaby | null;
  caregivers: ExportCaregiver[];
  /** Null or absent when nobody is signed in: the section is then left out. */
  account?: ExportAccount | null;
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

const byTime = <T>(rows: readonly T[], at: (row: T) => number) =>
  [...rows].sort((a, b) => at(a) - at(b));

function accountSection(account: ExportAccount) {
  const { records } = account;
  return {
    userId: account.userId,
    email: account.email,
    signInProviders: [...account.providers].sort(),
    serverRecords: records
      ? {
          consents: byTime(records.consents, (c) => c.grantedAt).map((c) => ({
            policyVersion: c.policyVersion,
            grantedAt: iso(c.grantedAt),
            withdrawnAt: iso(c.withdrawnAt),
          })),
          ...(records.consentEvents && {
            consentHistory: byTime(records.consentEvents, (e) => e.at).map((e) => ({
              purpose: e.purpose,
              version: e.version,
              action: e.action,
              textKey: e.textKey,
              locale: e.locale,
              householdId: e.householdId,
              babyId: e.babyId,
              at: iso(e.at),
            })),
          }),
          feedback: byTime(records.feedback, (f) => f.sentAt).map((f) => ({
            kind: f.kind,
            message: f.message,
            appVersion: f.appVersion,
            platform: f.platform,
            locale: f.locale,
            sentAt: iso(f.sentAt),
          })),
        }
      : 'unavailable',
  };
}

/** RFC 4180: quote everything, double the quotes inside. Nothing can break a row. */
const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/**
 * Everything this household has, in two shapes (SDD 12, P4-05). The consent
 * screen promises an export, so this is that promise kept: every entry,
 * including the deleted ones, because a copy that quietly left things out
 * would not be the data someone asked for.
 *
 * With someone signed in it also carries their own account: their id, email,
 * sign-in methods, consent records and feedback (legal review P0.10), which
 * the caller fetched from the server and passes in. The CSV stays entries
 * only: it is the spreadsheet of the baby's record, not of a person.
 *
 * Pure, so what is exported is exactly what it is given, and a test can
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
      ...(subject.account && { account: accountSection(subject.account) }),
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
