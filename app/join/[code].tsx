import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { JoinScreen } from '@/features/household/JoinScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

/** The invite link's destination: https://moraki.app/join/CODE. */
export default function Join() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const toHome = useCallback(() => {
    // Opened from a link, there may be nothing to dismiss.
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  }, [router]);
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <JoinScreen
        code={code ?? ''}
        onDone={toHome}
        // Opened from the link, there may be nothing to go back to.
        onClose={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
        onSignIn={() => router.push('/onboarding/sign-in')}
      />
    </>
  );
}
