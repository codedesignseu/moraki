import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DiaperSheet } from '@/features/diaper/DiaperSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogDiaper() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.diaper.title'), ...sheet }} />
      <DiaperSheet onDone={() => router.back()} />
    </>
  );
}
