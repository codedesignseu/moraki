import { useCallback, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useCaregiversRepository, useDevicePref, useEvents } from '@/db/react';
import {
  exportCsv,
  exportFileName,
  exportJson,
  type ExportSubject,
} from '@/domain/export/exportHousehold';

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
 * business, not ours.
 */
export function useExport(): ExportState {
  const events = useEvents();
  const caregivers = useCaregiversRepository();
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
      };
      const name = household?.babyName ?? '';

      for (const [kind, text, mime] of [
        ['json', exportJson(events, subject, at), 'application/json'],
        ['csv', exportCsv(events), 'text/csv'],
      ] as const) {
        const file = new File(Paths.cache, exportFileName(name, at, kind));
        file.create({ overwrite: true });
        file.write(text);
        await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: `public.${kind}` });
      }
    } catch {
      // The reason is never shown: it can name a file holding health data
      // (rule 8).
      setProblem('failed');
    } finally {
      setBusy(false);
    }
  }, [events, caregivers, household]);

  return { problem, busy, exportAll };
}
