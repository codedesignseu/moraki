import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { HouseholdSetupScreen } from '@/features/onboarding/HouseholdSetupScreen';

export default function HouseholdSetup() {
  const { t } = useTranslation();
  const router = useRouter();
  // Ends on home (P2-05 done-when), whichever tab it was opened from.
  const toHome = useCallback(() => {
    router.dismissAll();
    router.navigate('/');
  }, [router]);
  return (
    <>
      <Stack.Screen options={{ title: t('householdSetup.title'), presentation: 'modal' }} />
      <HouseholdSetupScreen onDone={toHome} />
    </>
  );
}
