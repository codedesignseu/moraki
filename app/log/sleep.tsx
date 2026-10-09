import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SleepSheet } from '@/features/sleep/SleepSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogSleep() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.sleep.title'), ...sheet }} />
      <SleepSheet onDone={() => router.back()} />
    </>
  );
}
