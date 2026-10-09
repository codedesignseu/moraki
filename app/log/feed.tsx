import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedSheet } from '@/features/feed/FeedSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogFeed() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.feed.title'), ...sheet }} />
      <FeedSheet onDone={() => router.back()} />
    </>
  );
}
