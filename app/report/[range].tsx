import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { REPORT_RANGES, type ReportRange } from '@/domain/report/buildReport';
import { ReportPreview } from '@/features/report/ReportPreview';

const isRange = (value: string | undefined): value is ReportRange =>
  REPORT_RANGES.includes(value as ReportRange);

export default function ReportRangeScreen() {
  const { t } = useTranslation();
  const { range } = useLocalSearchParams<{ range?: string }>();
  const chosen: ReportRange = isRange(range) ? range : '24h';
  return (
    <>
      <Stack.Screen options={{ title: t(`report.pdf.range.${chosen}`) }} />
      <ReportPreview range={chosen} />
    </>
  );
}
