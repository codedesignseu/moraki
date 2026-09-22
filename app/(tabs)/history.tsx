import { useRouter } from 'expo-router';

import { HistoryScreen } from '@/features/history/HistoryScreen';

export default function History() {
  const router = useRouter();
  return (
    <HistoryScreen onOpenEntry={(id) => router.push({ pathname: '/entry/[id]', params: { id } })} />
  );
}
