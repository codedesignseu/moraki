import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedbackScreen } from '@/features/feedback/FeedbackScreen';

export default function Feedback() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('feedback.title') }} />
      <FeedbackScreen onDone={() => router.back()} />
    </>
  );
}
