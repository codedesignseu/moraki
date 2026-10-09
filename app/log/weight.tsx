import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WeightSheet } from '@/features/weight/WeightSheet';
import { useAccountHousehold } from '@/sync/useAccountHousehold';
import { useSheetOptions } from '@/ui/theme';

export default function LogWeight() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const { household } = useAccountHousehold();
  return (
    <>
      <Stack.Screen options={{ title: t('log.weight.title'), ...sheet }} />
      <WeightSheet birthWeightG={household?.birthWeightG ?? null} onDone={() => router.back()} />
    </>
  );
}
