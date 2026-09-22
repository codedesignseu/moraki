import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HomeScreen } from '@/features/home/HomeScreen';

export default function Home() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('app.name') }} />
      <HomeScreen />
    </>
  );
}
