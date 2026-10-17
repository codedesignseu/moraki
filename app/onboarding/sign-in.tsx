import { Stack, useRouter } from 'expo-router';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';
import { useConsent } from '@/privacy/useConsent';

export default function SignIn() {
  const router = useRouter();
  const { grantedBy } = useConsent();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <SignInScreen
        onClose={() => router.back()}
        // Signing in is the first moment there is an account to ask, so the
        // consent screen comes next unless this account has already answered
        // (P3-09). Nothing syncs until it does, so asking here saves someone
        // wondering later why nothing is sharing. The account is the one that
        // just signed in, which is why it is asked about by id.
        onDone={(user) =>
          grantedBy(user.id) ? router.back() : router.replace('/onboarding/consent')
        }
      />
    </>
  );
}
