import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ErasureScreen } from '@/features/settings/ErasureScreen';

export default function LeaveOrDelete() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('erasure.screenTitle') }} />
      <ErasureScreen onDone={() => router.replace('/')} />
    </>
  );
}
