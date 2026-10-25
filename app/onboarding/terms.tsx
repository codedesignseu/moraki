import { Stack, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { TermsScreen } from '@/features/privacy/TermsScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Terms() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <TermsScreen onDone={() => router.back()} onOpenLink={(url) => void Linking.openURL(url)} />
    </>
  );
}
