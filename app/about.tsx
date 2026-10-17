import { Stack, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { AboutScreen } from '@/features/privacy/AboutScreen';
import { PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';

export default function About() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PUSHED_PAGE_OPTIONS} />
      <AboutScreen onOpenLink={(url) => void Linking.openURL(url)} onBack={() => router.back()} />
    </>
  );
}
