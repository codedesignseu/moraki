import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { JoinScreen } from '@/features/household/JoinScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

/** Joining by typing the code, for when the link can't be tapped. */
export default function JoinWithCode() {
  const router = useRouter();
  const toHome = useCallback(() => {
    // Opened from a link, there may be nothing to dismiss.
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  }, [router]);
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <JoinScreen
        code=""
        onDone={toHome}
        onClose={() => router.back()}
        onSignIn={() => router.push('/onboarding/sign-in')}
      />
    </>
  );
}
