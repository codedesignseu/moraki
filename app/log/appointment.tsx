import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppointmentSheet } from '@/features/appointments/AppointmentSheet';
import { useSheetOptions } from '@/ui/theme';

export default function LogAppointment() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.appointment.screen'), ...sheet }} />
      <AppointmentSheet onDone={() => router.back()} />
    </>
  );
}
