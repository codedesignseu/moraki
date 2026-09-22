import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { InviteScreen } from '@/features/household/InviteScreen';

export default function Invite() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('invite.title'), presentation: 'modal' }} />
      <InviteScreen />
    </>
  );
}
