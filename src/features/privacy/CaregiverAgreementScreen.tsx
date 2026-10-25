import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useCaregiverAgreement } from '@/privacy/useCaregiverAgreement';
import { Button, Card, Checkbox, InlineError, Page, TextButton } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * The caregiver agreement on its own screen (P0.2), for a member who isn't
 * the baby's parent or guardian: what they see (every entry, past and
 * future), and that they keep it to the household. Asked once of members
 * from before it existed, and readable later from Settings. Never pre-ticked;
 * closes only once the server has it.
 */
export function CaregiverAgreementScreen({
  onDone,
  onWithdraw = () => {},
}: {
  onDone: () => void;
  /** P0.3: withdrawing the agreement is leaving, confirmed on its own screen. */
  onWithdraw?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const agreement = useCaregiverAgreement();
  const [ticked, setTicked] = useState(false);
  const unticked = agreement.problem === 'unticked' && !ticked;
  const general =
    agreement.problem && agreement.problem !== 'unticked'
      ? t(`agreement.problem.${agreement.problem}`)
      : null;
  const role = agreement.role === 'viewer' ? 'viewer' : 'caregiver';

  return (
    <Page
      title={t('agreement.title')}
      kind="close"
      onBack={onDone}
      backLabel={t('common.close')}
      footer={
        agreement.accepted ? (
          <>
            <TextButton label={t('agreement.withdraw')} align="center" onPress={onWithdraw} />
            <Text style={s.hint}>{t('agreement.withdrawHint')}</Text>
          </>
        ) : (
          <>
            {general ? <InlineError message={general} prefix={t('common.error')} /> : null}
            <Button
              label={t(agreement.busy ? 'agreement.working' : 'agreement.accept')}
              busy={agreement.busy}
              onPress={() => void agreement.accept(ticked).then((saved) => saved && onDone())}
            />
            <TextButton label={t('agreement.notNow')} align="center" onPress={onDone} />
          </>
        )
      }
    >
      <Card testID="caregiver-agreement">
        {agreement.accepted ? (
          <Text style={s.lead}>{t('agreement.accepted')}</Text>
        ) : (
          <Text style={s.body}>{t('agreement.introMember')}</Text>
        )}
        <Text style={s.body}>
          {t(`agreement.roleMember.${role}`, { name: agreement.babyName })}
        </Text>
        <Text style={s.body}>{t('agreement.history')}</Text>
        {agreement.accepted ? (
          <Text style={s.body}>{t('agreement.statement')}</Text>
        ) : (
          <Checkbox
            label={t('agreement.statement')}
            checked={ticked}
            onChange={setTicked}
            invalid={unticked}
            message={unticked ? t('agreement.problem.unticked') : undefined}
            errorPrefix={t('common.error')}
            testID="agreement-statement"
          />
        )}
        <Text style={s.small}>{t('agreement.leave')}</Text>
      </Card>
      <Text style={s.small}>{t('agreement.version', { version: t('agreement.versionName') })}</Text>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    lead: { ...theme.type.lead, color: theme.palette.ink },
    body: { ...theme.type.body, color: theme.palette.ink },
    small: { ...theme.type.small, color: theme.palette.textSoft },
    hint: { ...theme.type.small, color: theme.palette.textSoft, textAlign: 'center' },
  });
