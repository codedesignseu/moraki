import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { AuthUser } from '@/sync/auth';
import { Button, Card, Page, TextButton, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { CODE_LENGTH, useSignIn } from './useSignIn';

/** The button that started the work under way, so only it shows the spinner. */
type Pressed = 'send' | 'apple' | 'google' | 'verify' | 'resend';

/**
 * Email OTP sign in (SDD 7, `onboarding/*`; G account/sign-in, -loading,
 * -code, code-expired): address, then the emailed code. One code field, as
 * the app takes 6 to 10 digits; a wrong and an expired code share one message,
 * as the auth layer reports them.
 */
export function SignInScreen({
  onDone,
  onClose,
}: {
  onDone: (user: AuthUser) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const signIn = useSignIn(onDone);
  const [pressed, setPressed] = useState<Pressed | null>(null);
  const problem = signIn.problem ? t(`signIn.problem.${signIn.problem}`) : undefined;
  const busyOn = (button: Pressed) => signIn.busy && pressed === button;
  const press = (button: Pressed, action: () => unknown) => () => {
    setPressed(button);
    void action();
  };

  if (signIn.step === 'email') {
    return (
      <Page title={t('signIn.title')} kind="close" onBack={onClose} backLabel={t('common.close')}>
        <Text style={s.intro}>{t('signIn.intro')}</Text>
        <Card>
          <TextField
            label={t('signIn.email')}
            icon="mail"
            value={signIn.email}
            onChangeText={signIn.setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            invalid={problem !== undefined}
            message={problem}
            errorPrefix={t('common.error')}
          />
          <Button
            label={t('signIn.sendCode')}
            onPress={press('send', signIn.sendCode)}
            busy={busyOn('send')}
            disabled={signIn.busy && !busyOn('send')}
          />
          {signIn.appleAvailable || signIn.googleAvailable ? (
            <>
              <Text style={s.or}>{t('signIn.or')}</Text>
              {signIn.appleAvailable ? (
                <Button
                  label={t('signIn.apple')}
                  variant="secondary"
                  onPress={press('apple', signIn.continueWithApple)}
                  busy={busyOn('apple')}
                  disabled={signIn.busy && !busyOn('apple')}
                />
              ) : null}
              {signIn.googleAvailable ? (
                <Button
                  label={t('signIn.google')}
                  variant="secondary"
                  onPress={press('google', signIn.continueWithGoogle)}
                  busy={busyOn('google')}
                  disabled={signIn.busy && !busyOn('google')}
                />
              ) : null}
            </>
          ) : null}
        </Card>
      </Page>
    );
  }

  return (
    <Page title={t('signIn.codeTitle')} onBack={signIn.changeEmail} backLabel={t('common.back')}>
      <Text style={s.intro}>{t('signIn.codeSent', { email: signIn.email.trim() })}</Text>
      <Card>
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
          errorPrefix={t('common.error')}
        />
        <Button
          label={t('signIn.verify')}
          onPress={press('verify', signIn.verify)}
          busy={busyOn('verify')}
          disabled={signIn.busy && !busyOn('verify')}
        />
        <View style={s.links}>
          <TextButton
            label={t('signIn.resend')}
            onPress={press('resend', signIn.resendCode)}
            disabled={signIn.busy}
          />
          <TextButton label={t('signIn.changeEmail')} onPress={signIn.changeEmail} />
        </View>
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    intro: { ...theme.type.body, color: theme.palette.textSoft },
    or: {
      ...theme.type.small,
      color: theme.palette.textSoft,
      textAlign: 'center',
      paddingVertical: theme.spacing.xs,
    },
    links: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: theme.spacing.grid,
    },
  });
