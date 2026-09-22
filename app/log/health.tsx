import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HealthSheet } from '@/features/health/HealthSheet';

export default function LogHealth() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.health.title'), presentation: 'modal' }} />
      <HealthSheet onDone={() => router.back()} />
    </>
  );
}
