import { Stack, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { ConsentScreen } from '@/features/privacy/ConsentScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Consent() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <ConsentScreen onDone={() => router.back()} onOpenLink={(url) => void Linking.openURL(url)} />
    </>
  );
}
