import { useRouter } from 'expo-router';

import { InsightsScreen } from '@/features/insights/InsightsScreen';
import { WeightCard } from '@/features/weight/WeightCard';

export default function Insights() {
  const router = useRouter();
  return <InsightsScreen weight={<WeightCard onAddWeight={() => router.push('/log/weight')} />} />;
}
