import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppointmentSheet } from '@/features/appointments/AppointmentSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { useSheetOptions } from '@/ui/theme';

export default function LogAppointment() {
  const { t } = useTranslation();
  const sheet = useSheetOptions();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('log.appointment.screen'), ...sheet }} />
      <ActivitySheetHeader
        type="appointment"
        title={t('log.appointment.screen')}
        onClose={() => router.back()}
      />
      <AppointmentSheet onDone={() => router.back()} />
    </>
  );
}
