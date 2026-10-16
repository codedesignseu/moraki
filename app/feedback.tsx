import { Stack, useRouter } from 'expo-router';

import { FeedbackScreen } from '@/features/feedback/FeedbackScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Feedback() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <FeedbackScreen onDone={() => router.back()} />
    </>
  );
}
