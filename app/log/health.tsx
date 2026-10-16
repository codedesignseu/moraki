import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HealthSheet } from '@/features/health/HealthSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useSheetOptions } from '@/ui/theme';

export default function LogHealth() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.health.title'), ...sheet }} />
      <ActivitySheetHeader
        type="health"
        title={t('log.health.title')}
        onClose={() => router.back()}
      />
      <HealthSheet onDone={() => router.back()} />
    </>
  );
}
