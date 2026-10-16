import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MedicationSheet } from '@/features/health/MedicationSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useNowSubtitle } from '@/features/sheet/useNowSubtitle';
import { useSheetOptions } from '@/ui/theme';

export default function LogMedication() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const subtitle = useNowSubtitle();
  return (
    <>
      <Stack.Screen options={{ title: t('log.medication.title'), ...sheet }} />
      <ActivitySheetHeader
        type="medication"
        title={t('log.medication.title')}
        subtitle={subtitle}
        onClose={() => router.back()}
      />
      <MedicationSheet onDone={() => router.back()} />
    </>
  );
}
