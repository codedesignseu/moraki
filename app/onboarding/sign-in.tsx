import { Stack, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';
import { useTerms } from '@/privacy/useTerms';

export default function SignIn() {
  const router = useRouter();
  const { agree } = useTerms();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <SignInScreen
        onClose={() => router.back()}
        onOpenLink={(url) => void Linking.openURL(url)}
        // Back to where signing in started. Health-data consent is the
        // parent's or guardian's (P0.2): it is asked when they set up a
        // household, or when the server says a guardian's is missing, and
        // never of someone who joins as a caregiver.
        onDone={(user) => {
          // P0.9: ticked on the sign-in screen, recorded now there is an
          // account. If it doesn't reach the server, the Terms are asked
          // again on the next open, and nothing syncs until then.
          void agree(true, user.id);
          router.back();
        }}
      />
    </>
  );
}
