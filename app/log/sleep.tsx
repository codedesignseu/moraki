import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SleepSheet } from '@/features/sleep/SleepSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useSheetOptions } from '@/ui/theme';

export default function LogSleep() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.sleep.title'), ...sheet }} />
      <ActivitySheetHeader
        type="sleep"
        title={t('log.sleep.title')}
        onClose={() => router.back()}
      />
      <SleepSheet onDone={() => router.back()} />
    </>
  );
}
