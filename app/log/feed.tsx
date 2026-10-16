import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedSheet } from '@/features/feed/FeedSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useNowSubtitle } from '@/features/sheet/useNowSubtitle';
import { useSheetOptions } from '@/ui/theme';

export default function LogFeed() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  const subtitle = useNowSubtitle();
  return (
    <>
      <Stack.Screen options={{ title: t('log.feed.title'), ...sheet }} />
      <ActivitySheetHeader
        type="feed_bottle"
        title={t('log.feed.title')}
        subtitle={subtitle}
        onClose={() => router.back()}
      />
      <FeedSheet onDone={() => router.back()} />
    </>
  );
}
