import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useCaregiverAgreement } from '@/privacy/useCaregiverAgreement';
import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { Button, Card, Page, TextButton } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * The household is frozen (P0.3): no parent or guardian in it has consent in
 * force, so nobody sends or sees its baby data. Shown when that happens and
 * whenever the app opens to it.
 *
 * A guardian (the one who withdrew, say) can agree again, or, as owner,
 * delete the household; another guardian can resume it from their own
 * phone. Anyone else can confirm they are a parent or guardian and agree, or
 * leave. Everyone can still see and delete their own entries.
 */
export function HouseholdPausedScreen({
  onClose,
  onConsent,
  onGuardian,
  onLeaveOrDelete,
}: {
  onClose: () => void;
  onConsent: () => void;
  onGuardian: () => void;
  onLeaveOrDelete: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const agreement = useCaregiverAgreement();
  const declaration = useGuardianDeclaration();
  const guardian = !agreement.forThisAccount || declaration.status === 'on_record';
  const owner = agreement.role === 'owner';

  return (
    <Page
      title={t('paused.title')}
      kind="close"
      onBack={onClose}
      backLabel={t('common.close')}
      footer={
        <>
          {guardian ? (
            <Button label={t('paused.agree')} onPress={onConsent} />
          ) : (
            <Button label={t('paused.confirmGuardian')} onPress={onGuardian} />
          )}
          <TextButton
            label={t(owner ? 'paused.delete' : 'paused.leave')}
            align="center"
            onPress={onLeaveOrDelete}
          />
        </>
      }
    >
      <Card testID="household-paused">
        <Text style={s.body}>{t(guardian ? 'paused.guardian' : 'paused.member')}</Text>
        <Text style={s.body}>{t('paused.resume')}</Text>
        <Text style={s.small}>{t('paused.own')}</Text>
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    body: { ...theme.type.body, color: theme.palette.ink },
    small: { ...theme.type.small, color: theme.palette.textSoft },
  });
