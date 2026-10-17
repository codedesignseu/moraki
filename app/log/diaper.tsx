import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DiaperSheet } from '@/features/diaper/DiaperSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useNowSubtitle } from '@/features/sheet/useNowSubtitle';
import { useSheetOptions } from '@/ui/theme';

export default function LogDiaper() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const subtitle = useNowSubtitle();
  return (
    <>
      <Stack.Screen options={{ title: t('log.diaper.title'), ...sheet }} />
      <ActivitySheetHeader
        type="diaper"
        title={t('log.diaper.title')}
        subtitle={subtitle}
        onClose={() => router.back()}
      />
      <DiaperSheet onDone={() => router.back()} />
    </>
  );
}
