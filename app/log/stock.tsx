import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { StockPlace } from '@/domain/activities';
import { StockSheet } from '@/features/stock/StockSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useNowSubtitle } from '@/features/sheet/useNowSubtitle';
import { useSheetOptions } from '@/ui/theme';

export default function LogStock() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const subtitle = useNowSubtitle();
  const { place } = useLocalSearchParams<{ place?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('log.stock.title'), ...sheet }} />
      <ActivitySheetHeader
        type="stock_adjust"
        title={t('log.stock.title')}
        subtitle={subtitle}
        onClose={() => router.back()}
      />
      <StockSheet
        place={place === 'freezer' ? 'freezer' : ('fridge' as StockPlace)}
        onDone={() => router.back()}
      />
    </>
  );
}
