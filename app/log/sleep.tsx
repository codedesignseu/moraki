import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useNowSubtitle } from '@/features/sheet/useNowSubtitle';
import { SleepSheet } from '@/features/sleep/SleepSheet';
import { useSleepRunning } from '@/features/sleep/useSleepSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogSleep() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const subtitle = useNowSubtitle();
  const title = useSleepRunning() ? t('log.sleep.titleRunning') : t('log.sleep.title');
  return (
    <>
      <Stack.Screen options={{ title, ...sheet }} />
      <ActivitySheetHeader
        type="sleep"
        title={title}
        subtitle={subtitle}
        onClose={() => router.back()}
      />
      <SleepSheet onDone={() => router.back()} />
    </>
  );
}
