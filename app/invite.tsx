import { Stack, useRouter } from 'expo-router';

import { InviteScreen } from '@/features/household/InviteScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Invite() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <InviteScreen onClose={() => router.back()} />
    </>
  );
}
