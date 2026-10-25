import { Stack, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';
import { useConsent } from '@/privacy/useConsent';
import { useTerms } from '@/privacy/useTerms';

export default function SignIn() {
  const router = useRouter();
  const { grantedBy } = useConsent();
  const { agree } = useTerms();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <SignInScreen
        onClose={() => router.back()}
        onOpenLink={(url) => void Linking.openURL(url)}
        // Signing in is the first moment there is an account to ask, so the
        // consent screen comes next unless this account has already answered
        // (P3-09). Nothing syncs until it does, so asking here saves someone
        // wondering later why nothing is sharing. The account is the one that
        // just signed in, which is why it is asked about by id.
        onDone={(user) => {
          // P0.9: ticked on the sign-in screen, recorded now there is an
          // account. If it doesn't reach the server, the Terms are asked
          // again on the next open, and nothing syncs until then.
          void agree(true, user.id);
          if (grantedBy(user.id)) router.back();
          else router.replace('/onboarding/consent');
        }}
      />
    </>
  );
}
