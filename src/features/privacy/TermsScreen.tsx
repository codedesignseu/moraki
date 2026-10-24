import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { legalLink, PRIVACY_VERSION, TERMS_VERSION } from '@/domain/consent/consent';
import { useTerms } from '@/privacy/useTerms';
import { Button, Card, Checkbox, InlineError, Page, TextButton } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * The Terms of Use for an account that hasn't agreed to the version in force
 * (P0.9): never agreed in the app, or agreed before they changed ("We
 * updated our Terms", P1.4). Links to both documents, a box never ticked for
 * them, and the one-line medical disclaimer. Closes only once the server has
 * it.
 */
export function TermsScreen({
  onDone,
  onOpenLink,
}: {
  onDone: () => void;
  onOpenLink: (url: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const terms = useTerms();
  const [ticked, setTicked] = useState(false);
  const updated = terms.status === 'outdated';
  const unticked = terms.problem === 'unticked' && !ticked;
  const general =
    terms.problem && terms.problem !== 'unticked' ? t(`terms.problem.${terms.problem}`) : null;

  return (
    <Page
      title={t(updated ? 'terms.updatedTitle' : 'terms.title')}
      kind="close"
      onBack={onDone}
      backLabel={t('common.close')}
      footer={
        <>
          {general ? <InlineError message={general} prefix={t('common.error')} /> : null}
          <Button
            label={t(terms.busy ? 'terms.working' : 'terms.continue')}
            busy={terms.busy}
            onPress={() => void terms.agree(ticked).then((saved) => saved && onDone())}
          />
          <TextButton label={t('terms.notNow')} align="center" onPress={onDone} />
        </>
      }
    >
      <Card testID="terms-agreement">
        <Text style={s.body}>{t(updated ? 'terms.updatedIntro' : 'terms.intro')}</Text>
        <TextButton
          label={t('terms.termsLink')}
          onPress={() => onOpenLink(legalLink('terms', i18n.language))}
        />
        <TextButton
          label={t('terms.privacyLink')}
          onPress={() => onOpenLink(legalLink('privacy', i18n.language))}
        />
        <Checkbox
          label={t('terms.agree')}
          checked={ticked}
          onChange={setTicked}
          invalid={unticked}
          message={unticked ? t('terms.problem.unticked') : undefined}
          errorPrefix={t('common.error')}
        />
      </Card>
      <Text style={s.soft} testID="terms-disclaimer">
        {t('terms.disclaimer')}
      </Text>
      <Text style={s.soft}>
        {t('terms.version', { terms: TERMS_VERSION, privacy: PRIVACY_VERSION })}
      </Text>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    body: { ...theme.type.body, color: theme.palette.ink },
    soft: { ...theme.type.small, color: theme.palette.textSoft },
  });
