import { useCallback, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useCaregiversRepository, useDevicePref, useEvents } from '@/db/react';
import {
  exportCsv,
  exportFileName,
  exportJson,
  type ExportAccount,
  type ExportSubject,
} from '@/domain/export/exportHousehold';
import { fetchAccountRecords } from '@/sync/accountRecords';
import { useAuth } from '@/sync/AuthProvider';

import { removeQuietly } from './removeQuietly';

export type ExportState = {
  /** Null until something goes wrong; a reason key otherwise. */
  problem: 'unavailable' | 'failed' | null;
  busy: boolean;
  exportAll: () => Promise<void>;
};

/**
 * Everything this household has, handed to the share sheet as two files
 * (SDD 12, P4-05). The consent screen promises it, so it exists.
 *
 * Both files are written on the device and shared from there: nothing is
 * uploaded to make an export, and where the copy goes is the share sheet's
 * business, not ours. Each file is deleted once its share sheet closes, or
 * once anything fails, so no copy is left behind in the cache.
 *
 * Signed in, the JSON also carries the person's own account (legal review
 * P0.10): id, email and sign-in methods from the session on this phone, and
 * their consent records and feedback, read from the server as them at the
 * moment they tap. Offline, those server records are marked unavailable and
 * the export still goes ahead. Signed out, there is no account section.
 */
export function useExport(): ExportState {
  const events = useEvents();
  const caregivers = useCaregiversRepository();
  const { auth, state } = useAuth();
  const user = state.status === 'signedIn' ? state.user : null;
  const [household] = useDevicePref('accountHousehold');
  const [problem, setProblem] = useState<ExportState['problem']>(null);
  const [busy, setBusy] = useState(false);

  const exportAll = useCallback(async () => {
    setProblem(null);
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setProblem('unavailable');
        return;
      }
      const account: ExportAccount | null =
        auth && user
          ? {
              userId: user.id,
              email: user.email,
              providers: await auth.providers(),
              records: await fetchAccountRecords(auth, user.id),
            }
          : null;
      const at = Date.now();
      const subject: ExportSubject = {
        householdId: household?.householdId ?? null,
        baby: household
          ? {
              name: household.babyName,
              bornAt: household.bornAt ?? null,
              birthWeightG: household.birthWeightG ?? null,
            }
          : null,
        caregivers: caregivers.list().map((row) => ({
          userId: row.userId,
          displayName: row.displayName,
          role: row.role,
        })),
        account,
      };
      const name = household?.babyName ?? '';

      for (const [kind, text, mime] of [
        ['json', exportJson(events, subject, at), 'application/json'],
        ['csv', exportCsv(events), 'text/csv'],
      ] as const) {
        const file = new File(Paths.cache, exportFileName(name, at, kind));
        try {
          file.create({ overwrite: true });
          file.write(text);
          await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: `public.${kind}` });
        } finally {
          // The share sheet has handed the copy on, or it failed: either way
          // a whole household's history must not sit in the cache after.
          removeQuietly(file);
        }
      }
    } catch {
      // The reason is never shown: it can name a file holding health data
      // (rule 8).
      setProblem('failed');
    } finally {
      setBusy(false);
    }
  }, [events, caregivers, household, auth, user]);

  return { problem, busy, exportAll };
}
