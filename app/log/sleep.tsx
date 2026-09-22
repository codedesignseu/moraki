import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SleepSheet } from '@/features/sleep/SleepSheet';

export default function LogSleep() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.sleep.title'), presentation: 'modal' }} />
      <SleepSheet onDone={() => router.back()} />
    </>
  );
}
