import { Stack, useRouter } from 'expo-router';

import { GuardianScreen } from '@/features/privacy/GuardianScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Guardian() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <GuardianScreen onDone={() => router.back()} />
    </>
  );
}
