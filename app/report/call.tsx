import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CallScript } from '@/features/report/CallScript';

export default function Call() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('report.call.title') }} />
      <CallScript />
    </>
  );
}
