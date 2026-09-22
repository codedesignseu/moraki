import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DiaperSheet } from '@/features/diaper/DiaperSheet';

export default function LogDiaper() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.diaper.title'), presentation: 'modal' }} />
      <DiaperSheet onDone={() => router.back()} />
    </>
  );
}
