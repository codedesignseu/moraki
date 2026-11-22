import { Stack, useRouter } from 'expo-router';

import { TermsScreen } from '@/features/privacy/TermsScreen';
import { useOpenLink } from '@/privacy/useOpenLink';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Terms() {
  const router = useRouter();
  const openLink = useOpenLink();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <TermsScreen onDone={() => router.back()} onOpenLink={openLink} />
    </>
  );
}
