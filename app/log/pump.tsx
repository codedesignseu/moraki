import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PumpSheet } from '@/features/pump/PumpSheet';

export default function LogPump() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.pump.title'), presentation: 'modal' }} />
      <PumpSheet onDone={() => router.back()} />
    </>
  );
}
