import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Card } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useConsent } from './useConsent';

/**
 * Consent on its own screen, asked of every caregiver (SDD 12). It is not
 * bundled with terms, there is no pre-ticked box, and the way to say no is
 * the same size as the way to say yes: closing the screen.
 */
export function ConsentScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { granted, problem, busy, agree, withdraw } = useConsent();

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="consent-what">
        <Text style={theme.text.heading}>{t('consent.title')}</Text>
        <Text style={theme.text.body}>{t('consent.what')}</Text>
        <Text style={theme.text.body}>{t('consent.where')}</Text>
        <Text style={theme.text.body}>{t('consent.who')}</Text>
        <Text style={theme.text.body}>{t('consent.rights')}</Text>
        <Text style={s.muted}>{t('consent.version', { version: t('consent.versionName') })}</Text>
      </Card>

      {problem && (
        <Text style={s.problem} accessibilityRole="alert" testID="consent-problem">
          {t(`consent.problem.${problem}`)}
        </Text>
      )}

      {granted ? (
        <Card testID="consent-granted">
          <Text style={theme.text.body}>{t('consent.granted')}</Text>
          <Button
            label={t('consent.withdraw')}
            variant="secondary"
            disabled={busy}
            onPress={() => void withdraw()}
          />
          <Text style={s.muted}>{t('consent.withdrawHint')}</Text>
        </Card>
      ) : (
        <Button
          label={t(busy ? 'consent.working' : 'consent.agree')}
          disabled={busy}
          // Only leaves the screen once the server has it: a failure has to
          // stay visible, or someone thinks they agreed when they didn't.
          onPress={() => void agree().then((saved) => saved && onDone())}
        />
      )}
      <Button label={t('consent.notNow')} variant="secondary" onPress={onDone} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    problem: { ...theme.text.body, color: theme.colors.invalid },
  });
