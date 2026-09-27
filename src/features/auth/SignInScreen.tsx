import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { AuthUser } from '@/sync/auth';
import { Button, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { CODE_LENGTH, useSignIn } from './useSignIn';

/** Email OTP sign in (SDD 7, `onboarding/*`): address, then the emailed code. */
export function SignInScreen({ onDone }: { onDone: (user: AuthUser) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const signIn = useSignIn(onDone);
  const problem = signIn.problem ? t(`signIn.problem.${signIn.problem}`) : undefined;

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {signIn.step === 'email' ? (
        <>
          <Text style={theme.text.body}>{t('signIn.intro')}</Text>
          <TextField
            label={t('signIn.email')}
            value={signIn.email}
            onChangeText={signIn.setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            invalid={problem !== undefined}
            message={problem}
          />
          <Button
            label={t('signIn.sendCode')}
            onPress={() => void signIn.sendCode()}
            disabled={signIn.busy}
          />
          {signIn.appleAvailable || signIn.googleAvailable ? (
            <>
              <Text style={theme.text.body}>{t('signIn.or')}</Text>
              {signIn.appleAvailable ? (
                <Button
                  label={t('signIn.apple')}
                  variant="secondary"
                  onPress={() => void signIn.continueWithApple()}
                  disabled={signIn.busy}
                />
              ) : null}
              {signIn.googleAvailable ? (
                <Button
                  label={t('signIn.google')}
                  variant="secondary"
                  onPress={() => void signIn.continueWithGoogle()}
                  disabled={signIn.busy}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={theme.text.body}>
            {t('signIn.codeSent', { email: signIn.email.trim() })}
          </Text>
          <TextField
            label={t('signIn.code')}
            value={signIn.code}
            onChangeText={signIn.setCode}
            maxLength={CODE_LENGTH.max}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            invalid={problem !== undefined}
            message={problem}
          />
          <Button
            label={t('signIn.verify')}
            onPress={() => void signIn.verify()}
            disabled={signIn.busy}
          />
          <Button
            label={t('signIn.resend')}
            variant="secondary"
            onPress={() => void signIn.resendCode()}
            disabled={signIn.busy}
          />
          <Button
            label={t('signIn.changeEmail')}
            variant="secondary"
            onPress={signIn.changeEmail}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  });
