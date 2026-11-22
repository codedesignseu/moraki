import { Stack, useRouter } from 'expo-router';

import { ConsentScreen } from '@/features/privacy/ConsentScreen';
import { useOpenLink } from '@/privacy/useOpenLink';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Consent() {
  const router = useRouter();
  const openLink = useOpenLink();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <ConsentScreen onDone={() => router.back()} onOpenLink={openLink} />
    </>
  );
}
