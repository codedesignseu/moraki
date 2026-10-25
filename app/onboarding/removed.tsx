import { Stack, useRouter } from 'expo-router';

import { RemovedScreen } from '@/features/household/RemovedNotice';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Removed() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <RemovedScreen onDone={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
    </>
  );
}
