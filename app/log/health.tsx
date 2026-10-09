import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HealthSheet } from '@/features/health/HealthSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogHealth() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.health.title'), ...sheet }} />
      <HealthSheet onDone={() => router.back()} />
    </>
  );
}
