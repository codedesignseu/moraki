import { useRouter } from 'expo-router';

import { HomeScreen, type LogKind } from '@/features/home/HomeScreen';
import { useAuth } from '@/sync/AuthProvider';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

const LOG_ROUTES = {
  feed: '/log/feed',
  sleep: '/log/sleep',
  diaper: '/log/diaper',
  pump: '/log/pump',
  health: '/log/health',
  medication: '/log/medication',
} as const satisfies Record<LogKind, string>;

export default function Home() {
  const router = useRouter();
  // Joining needs the server; the household is undefined when signed out,
  // null when signed in without one.
  const { auth } = useAuth();
  const { household } = useAccountHousehold();
  const canJoin = auth !== null && !household;
  const join = { onJoin: () => router.push('/onboarding/join') };
  return (
    <HomeScreen
      onLog={(kind) => router.push(LOG_ROUTES[kind])}
      onOpenEntry={(id) => router.push({ pathname: '/entry/[id]', params: { id } })}
      onAdjustStock={(place) => router.push({ pathname: '/log/stock', params: { place } })}
      onAppointment={(id) =>
        id === undefined
          ? router.push('/log/appointment')
          : router.push({ pathname: '/entry/[id]', params: { id } })
      }
      {...(canJoin ? join : {})}
    />
  );
}
