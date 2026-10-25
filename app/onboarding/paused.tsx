import { Stack, useRouter } from 'expo-router';

import { HouseholdPausedScreen } from '@/features/privacy/HouseholdPausedScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Paused() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <HouseholdPausedScreen
        onClose={() => router.back()}
        onConsent={() => router.replace('/onboarding/consent')}
        onGuardian={() => router.replace('/onboarding/guardian')}
        onLeaveOrDelete={() => router.replace('/leave-or-delete')}
      />
    </>
  );
}
