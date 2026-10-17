import { Stack, useRouter } from 'expo-router';

import { CallScript } from '@/features/report/CallScript';
import { PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Call() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PUSHED_PAGE_OPTIONS} />
      <CallScript onBack={() => router.back()} />
    </>
  );
}
