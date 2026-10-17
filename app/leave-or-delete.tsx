import { Stack, useRouter } from 'expo-router';

import { ErasureScreen } from '@/features/settings/ErasureScreen';
import { PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';

export default function LeaveOrDelete() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PUSHED_PAGE_OPTIONS} />
      <ErasureScreen onDone={() => router.replace('/')} onBack={() => router.back()} />
    </>
  );
}
