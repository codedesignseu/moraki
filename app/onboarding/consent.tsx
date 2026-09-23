import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ConsentScreen } from '@/features/privacy/ConsentScreen';

export default function Consent() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('consent.title'), presentation: 'modal' }} />
      <ConsentScreen onDone={() => router.back()} />
    </>
  );
}
