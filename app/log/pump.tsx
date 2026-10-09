import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PumpSheet } from '@/features/pump/PumpSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogPump() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.pump.title'), ...sheet }} />
      <PumpSheet onDone={() => router.back()} />
    </>
  );
}
