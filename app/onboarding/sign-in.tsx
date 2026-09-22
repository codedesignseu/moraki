import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SignInScreen } from '@/features/auth/SignInScreen';

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: t('signIn.title'), presentation: 'modal' }} />
      <SignInScreen onDone={() => router.back()} />
    </>
  );
}
