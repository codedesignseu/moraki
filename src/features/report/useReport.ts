import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { useDevicePref, useEvents } from '@/db/react';
import { buildReport, type Report, type ReportRange } from '@/domain/report/buildReport';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useNow } from '@/ui/useNow';

import { reportFileName, reportHtml } from './reportHtml';
import { reportLabels } from './reportLabels';

const TICK_MS = 60_000;
const UNKNOWN_BABY = { name: '', bornAt: 0, birthWeightG: null };

export type ReportView = {
  report: Report;
  labels: ReturnType<typeof reportLabels>;
  babyName: string;
  /** Null while nothing has gone wrong; a reason key when sharing failed. */
  problem: 'unavailable' | 'failed' | null;
  sharing: boolean;
  share: () => Promise<void>;
};

/**
 * A report and the PDF made from it (SDD 6.5). The PDF is rendered on the
 * device by expo-print, so health data never leaves the phone to become one,
 * and the share sheet decides where it goes from there.
 */
export function useReport(range: ReportRange): ReportView {
  const events = useEvents();
  const [household] = useDevicePref('accountHousehold');
  const { t, i18n } = useTranslation();
  const now = useNow(TICK_MS);
  const tz = deviceTimeZone();
  const [problem, setProblem] = useState<'unavailable' | 'failed' | null>(null);
  const [sharing, setSharing] = useState(false);

  const babyName = household?.babyName ?? '';
  const bornAt = household?.bornAt;
  const baby = useMemo(
    () =>
      bornAt === undefined
        ? UNKNOWN_BABY
        : { name: babyName, bornAt, birthWeightG: household?.birthWeightG ?? null },
    [bornAt, babyName, household?.birthWeightG],
  );

  const report = useMemo(
    () => buildReport(events, baby, range, now, tz),
    [events, baby, range, now, tz],
  );

  const locale = dateLocale(i18n.language);
  const labels = useMemo(
    () =>
      reportLabels(
        report,
        t as unknown as (key: string, values?: Record<string, string | number>) => string,
        tz,
        babyName,
        (at: number) => formatDateTime(at, tz, locale),
      ),
    [report, t, tz, babyName, locale],
  );

  const share = useCallback(async () => {
    setProblem(null);
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setProblem('unavailable');
        return;
      }
      const { uri } = await Print.printToFileAsync({
        html: reportHtml(report, labels, i18n.language),
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: labels.title,
      });
    } catch {
      // The reason is never shown or logged: it can name a file holding
      // health data (rule 8).
      setProblem('failed');
    } finally {
      setSharing(false);
    }
  }, [report, labels, i18n.language]);

  return { report, labels, babyName, problem, sharing, share };
}

export { reportFileName };
