import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MedicationSheet } from '@/features/health/MedicationSheet';

export default function LogMedication() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.medication.title'), presentation: 'modal' }} />
      <MedicationSheet onDone={() => router.back()} />
    </>
  );
}
