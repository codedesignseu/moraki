import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/icons';
import { Button, Card, IconCircle, InlineError, Page, TextButton } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useConsent } from '@/privacy/useConsent';

const PARAGRAPHS: readonly {
  key: 'consent.what' | 'consent.where' | 'consent.who' | 'consent.rights' | 'consent.withdrawal';
  icon: IconName;
}[] = [
  { key: 'consent.what', icon: 'health' },
  { key: 'consent.where', icon: 'eu-shield' },
  { key: 'consent.who', icon: 'private' },
  { key: 'consent.rights', icon: 'export' },
  { key: 'consent.withdrawal', icon: 'stop' },
];

/**
 * Consent on its own screen, asked of every caregiver (SDD 12). It is not
 * bundled with terms, there is no pre-ticked box, and the way to say no is
 * always there: "Not now" and the close button.
 *
 * G account/consent and consent-agreed: one white card of icon rows, the
 * fifth (what withdrawing does) added with the 2026-10-18 text. No titles,
 * intro or date (decision G3).
 */
export function ConsentScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { granted, problem, busy, agree, withdraw } = useConsent();

  return (
    <Page
      title={t('consent.title')}
      kind="close"
      onBack={onDone}
      backLabel={t('common.close')}
      footer={
        <>
          {problem ? (
            <InlineError
              message={t(`consent.problem.${problem}`)}
              prefix={t('common.error')}
              testID="consent-problem"
            />
          ) : null}
          {granted ? (
            <>
              <Button label={t('consent.withdraw')} busy={busy} onPress={() => void withdraw()} />
              <Text style={s.hint}>{t('consent.withdrawHint')}</Text>
            </>
          ) : (
            <Button
              label={t(busy ? 'consent.working' : 'consent.agree')}
              busy={busy}
              // Only leaves the screen once the server has it: a failure has to
              // stay visible, or someone thinks they agreed when they didn't.
              onPress={() => void agree().then((saved) => saved && onDone())}
            />
          )}
          <TextButton label={t('consent.notNow')} align="center" onPress={onDone} />
        </>
      }
    >
      {granted ? (
        <Card tone="pump" testID="consent-granted">
          <View style={s.agreed}>
            <IconCircle icon="check" tone="card" />
            <Text style={s.agreedText}>{t('consent.granted')}</Text>
          </View>
        </Card>
      ) : null}
      <Card testID="consent-what">
        {PARAGRAPHS.map(({ key, icon }, index) => (
          <Fragment key={key}>
            {index > 0 ? <View style={s.gap} /> : null}
            <View style={s.row}>
              <IconCircle icon={icon} tone="chip" />
              <Text style={s.paragraph}>{t(key)}</Text>
            </View>
          </Fragment>
        ))}
      </Card>
      <Text style={s.version}>{t('consent.version', { version: t('consent.versionName') })}</Text>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
    // G: 18 between rows; the card's own gap gives 12.
    gap: { height: theme.spacing.tile },
    paragraph: { ...theme.type.body, flex: 1, color: theme.palette.ink },
    agreed: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    agreedText: { ...theme.type.lead, flex: 1, color: theme.palette.ink },
    version: { ...theme.type.small, color: theme.palette.textSoft },
    hint: { ...theme.type.small, color: theme.palette.textSoft, textAlign: 'center' },
  });
