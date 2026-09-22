import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { JoinScreen } from '@/features/household/JoinScreen';

/** The invite link's destination: https://moraki.app/join/CODE. */
export default function Join() {
  const { t } = useTranslation();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const toHome = useCallback(() => {
    // Opened from a link, there may be nothing to dismiss.
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  }, [router]);
  return (
    <>
      <Stack.Screen options={{ title: t('join.title'), presentation: 'modal' }} />
      <JoinScreen
        code={code ?? ''}
        onDone={toHome}
        onSignIn={() => router.push('/onboarding/sign-in')}
      />
    </>
  );
}
