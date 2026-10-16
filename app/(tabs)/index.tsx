import { useRouter } from 'expo-router';

import { HomeScreen, type LogKind } from '@/features/home/HomeScreen';

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
    />
  );
}
