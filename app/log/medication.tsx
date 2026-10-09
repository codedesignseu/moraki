import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MedicationSheet } from '@/features/health/MedicationSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogMedication() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.medication.title'), ...sheet }} />
      <MedicationSheet onDone={() => router.back()} />
    </>
  );
}
