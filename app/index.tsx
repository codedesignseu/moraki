import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HomeScreen } from '@/features/home/HomeScreen';
import { Button } from '@/ui/primitives';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('app.name') }} />
      <HomeScreen
        actions={
          <>
            <Button label={t('home.logFeed')} onPress={() => router.push('/log/feed')} />
            <Button
              label={t('home.actions.diaper')}
              variant="secondary"
              onPress={() => router.push('/log/diaper')}
            />
            <Button
              label={t('home.actions.sleep')}
              variant="secondary"
              onPress={() => router.push('/log/sleep')}
            />
          </>
        }
      />
    </>
  );
}
