import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { HouseholdSetupScreen } from '@/features/onboarding/HouseholdSetupScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function HouseholdSetup() {
  const router = useRouter();
  // Ends on home (P2-05 done-when), whichever tab it was opened from.
  const toHome = useCallback(() => {
    // Opened from a link, there may be nothing to dismiss.
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  }, [router]);
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <HouseholdSetupScreen onDone={toHome} onClose={() => router.back()} />
    </>
  );
}
