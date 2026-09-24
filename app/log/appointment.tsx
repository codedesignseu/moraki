import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppointmentSheet } from '@/features/appointments/AppointmentSheet';

export default function LogAppointment() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.appointment.screen'), presentation: 'modal' }} />
      <AppointmentSheet onDone={() => router.back()} />
    </>
  );
}
