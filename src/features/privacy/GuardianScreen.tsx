import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { Button, Card, Checkbox, InlineError, Page, TextButton } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * The guardian declaration on its own screen (P0.1), for a member of an
 * existing household: an owner from before it existed, asked once, or a
 * caregiver who wants to be able to take over. Never pre-ticked, and apart
 * from health-data consent. Closes only once the server has it.
 *
 * A member who declares rests on their own health-data consent from then on,
 * not the caregiver agreement they joined with, so they go straight on to
 * it (`onNeedsConsent`).
 */
export function GuardianScreen({
  onDone,
  onNeedsConsent = onDone,
}: {
  onDone: () => void;
  onNeedsConsent?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const guardian = useGuardianDeclaration();
  const [ticked, setTicked] = useState(false);
  const unticked = guardian.problem === 'unticked' && !ticked;
  const general =
    guardian.problem && guardian.problem !== 'unticked'
      ? t(`guardian.problem.${guardian.problem}`)
      : null;

  return (
    <Page
      title={t('guardian.title')}
      kind="close"
      onBack={onDone}
      backLabel={t('common.close')}
      footer={
        <>
          {general ? <InlineError message={general} prefix={t('common.error')} /> : null}
          <Button
            label={t(guardian.busy ? 'guardian.working' : 'guardian.confirm')}
            busy={guardian.busy}
            onPress={() =>
              void guardian.declare(ticked).then((saved) => {
                if (saved) (guardian.owner ? onDone : onNeedsConsent)();
              })
            }
          />
          <TextButton label={t('guardian.notNow')} align="center" onPress={onDone} />
        </>
      }
    >
      <Card testID="guardian-declaration">
        <Text style={s.intro}>
          {t(guardian.owner ? 'guardian.introOwner' : 'guardian.introMember')}
        </Text>
        <Checkbox
          label={t('householdSetup.guardian.declaration')}
          checked={ticked}
          onChange={setTicked}
          invalid={unticked}
          message={unticked ? t('householdSetup.problem.guardian') : undefined}
          errorPrefix={t('common.error')}
        />
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    intro: { ...theme.type.body, color: theme.palette.ink },
  });
