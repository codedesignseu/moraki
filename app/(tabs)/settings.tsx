import { useRouter } from 'expo-router';

import { SettingsScreen } from '@/features/settings/SettingsScreen';

export default function Settings() {
  const router = useRouter();
  return (
    <SettingsScreen
      onSignIn={() => router.push('/onboarding/sign-in')}
      onSetUpHousehold={() => router.push('/onboarding/household')}
      onJoinHousehold={() => router.push('/onboarding/join')}
      onInvite={() => router.push('/invite')}
      onReport={(range) => router.push({ pathname: '/report/[range]', params: { range } })}
      onCallScript={() => router.push('/report/call')}
    />
  );
}
