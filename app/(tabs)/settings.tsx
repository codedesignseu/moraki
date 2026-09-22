import { useRouter } from 'expo-router';

import { SettingsScreen } from '@/features/settings/SettingsScreen';

export default function Settings() {
  const router = useRouter();
  return <SettingsScreen onSignIn={() => router.push('/onboarding/sign-in')} />;
}
