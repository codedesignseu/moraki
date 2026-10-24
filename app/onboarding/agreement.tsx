import { Stack, useRouter } from 'expo-router';

import { CaregiverAgreementScreen } from '@/features/privacy/CaregiverAgreementScreen';
import { PAGE_OPTIONS } from '@/ui/pageOptions';

export default function Agreement() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={PAGE_OPTIONS} />
      <CaregiverAgreementScreen
        onDone={() => router.back()}
        onWithdraw={() => router.replace('/leave-or-delete')}
      />
    </>
  );
}
