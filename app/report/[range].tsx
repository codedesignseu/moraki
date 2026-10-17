import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { REPORT_RANGES, type ReportRange } from '@/domain/report/buildReport';
import { ReportPreview } from '@/features/report/ReportPreview';
import { PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';

const isRange = (value: string | undefined): value is ReportRange =>
  REPORT_RANGES.includes(value as ReportRange);

export default function ReportRangeScreen() {
  const router = useRouter();
  const { range } = useLocalSearchParams<{ range?: string }>();
  const chosen: ReportRange = isRange(range) ? range : '24h';
  return (
    <>
      <Stack.Screen options={PUSHED_PAGE_OPTIONS} />
      <ReportPreview range={chosen} onBack={() => router.back()} />
    </>
  );
}
