import { Stack, useRouter } from 'expo-router';

import { AboutScreen } from '@/features/privacy/AboutScreen';
import { useOpenLink } from '@/privacy/useOpenLink';
import { PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';

export default function About() {
  const router = useRouter();
  const openLink = useOpenLink();
  return (
    <>
      <Stack.Screen options={PUSHED_PAGE_OPTIONS} />
      <AboutScreen onOpenLink={openLink} onBack={() => router.back()} />
    </>
  );
}
