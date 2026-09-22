import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedSheet } from '@/features/feed/FeedSheet';

export default function LogFeed() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.feed.title'), presentation: 'modal' }} />
      <FeedSheet onDone={() => router.back()} />
    </>
  );
}
