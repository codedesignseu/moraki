import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BabyScreen } from '@/features/settings/BabyScreen';

export default function Baby() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('baby.title') }} />
      <BabyScreen />
    </>
  );
}
