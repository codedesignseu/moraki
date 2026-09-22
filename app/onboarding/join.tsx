import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { JoinScreen } from '@/features/household/JoinScreen';

/** Joining by typing the code, for when the link can't be tapped. */
export default function JoinWithCode() {
  const { t } = useTranslation();
  const router = useRouter();
  const toHome = useCallback(() => {
    // Opened from a link, there may be nothing to dismiss.
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  }, [router]);
  return (
    <>
      <Stack.Screen options={{ title: t('join.title'), presentation: 'modal' }} />
      <JoinScreen code="" onDone={toHome} onSignIn={() => router.push('/onboarding/sign-in')} />
    </>
  );
}
