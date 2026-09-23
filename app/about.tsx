import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AboutScreen } from '@/features/privacy/AboutScreen';

export default function About() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('about.title') }} />
      <AboutScreen />
    </>
  );
}
