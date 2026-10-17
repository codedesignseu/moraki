import { Stack, useRouter } from 'expo-router';

import { BabyScreen } from '@/features/settings/BabyScreen';
import { PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Baby() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PUSHED_PAGE_OPTIONS} />
      <BabyScreen onBack={() => router.back()} />
    </>
  );
}
