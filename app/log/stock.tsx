import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { StockPlace } from '@/domain/activities';
import { StockSheet } from '@/features/stock/StockSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogStock() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const { place } = useLocalSearchParams<{ place?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('log.stock.title'), ...sheet }} />
      <StockSheet
        place={place === 'freezer' ? 'freezer' : ('fridge' as StockPlace)}
        onDone={() => router.back()}
      />
    </>
  );
}
