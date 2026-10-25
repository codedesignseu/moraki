import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RELATIONS } from '@/sync/household';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  FieldLabel,
  InlineError,
  Page,
  Stepper,
  TextButton,
  TextField,
} from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { LIMITS, useHouseholdSetup } from './useHouseholdSetup';

/**
 * First run after sign in (SDD 7, `onboarding/*`; G account/setup): the
 * "You" and "Baby" cards, then the button at the foot. The app's relation
 * list is kept (Caregiver, not G's Nanny).
 */
export function HouseholdSetupScreen({
  onDone,
  onClose,
  onConsent = () => {},
}: {
  onDone: () => void;
  onClose: () => void;
  /** Opens the health-data consent screen (P0.2). */
  onConsent?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const setup = useHouseholdSetup(onDone);
  const problem = (
    field: 'display_name' | 'baby_name' | 'birth_weight' | 'guardian' | 'consent',
  ) => (setup.problem === field ? t(`householdSetup.problem.${field}`) : undefined);
  const general =
    setup.problem &&
    !['display_name', 'baby_name', 'birth_weight', 'guardian', 'consent'].includes(setup.problem)
      ? t(`householdSetup.problem.${setup.problem}` as 'householdSetup.problem.offline')
      : null;

  return (
    <Page
      title={t('householdSetup.title')}
      kind="close"
      onBack={onClose}
      backLabel={t('common.close')}
      footer={
        <>
          {general ? <InlineError message={general} prefix={t('common.error')} /> : null}
          <Button label={t('householdSetup.save')} onPress={setup.save} busy={setup.busy} />
        </>
      }
    >
      <Card testID="setup-you">
        <Text style={s.title} accessibilityRole="header">
          {t('householdSetup.you.title')}
        </Text>
        <TextField
          label={t('householdSetup.you.name')}
          value={setup.displayName}
          onChangeText={setup.setDisplayName}
          maxLength={LIMITS.displayName}
          autoComplete="name"
          textContentType="givenName"
          hint={t('householdSetup.you.nameHint')}
          invalid={problem('display_name') !== undefined}
          message={problem('display_name')}
          errorPrefix={t('common.error')}
        />
        {/* Read out: the chips below carry no group name of their own. */}
        <Text style={s.label}>{t('householdSetup.you.relation')}</Text>
        <View style={s.chips}>
          {RELATIONS.map((relation) => (
            <Chip
              key={relation}
              label={t(`householdSetup.relation.${relation}`)}
              selected={setup.relation === relation}
              onPress={() => setup.toggleRelation(relation)}
            />
          ))}
        </View>
      </Card>

      <Card testID="setup-baby">
        <Text style={s.title} accessibilityRole="header">
          {t('householdSetup.baby.title')}
        </Text>
        <TextField
          label={t('householdSetup.baby.name')}
          value={setup.babyName}
          onChangeText={setup.setBabyName}
          maxLength={LIMITS.babyName}
          invalid={problem('baby_name') !== undefined}
          message={problem('baby_name')}
          errorPrefix={t('common.error')}
        />
        <FieldLabel label={t('householdSetup.baby.born')} />
        <Stepper
          value={setup.bornDaysAgo}
          onChange={setup.setBornDaysAgo}
          min={0}
          max={LIMITS.bornDaysAgo.max}
          unit={t('householdSetup.baby.daysAgo')}
          accessibilityLabel={t('householdSetup.baby.born')}
          size="compact"
        />
        <Text style={s.bornOn}>{t('householdSetup.baby.bornOn', { date: setup.bornOn })}</Text>
        <TextField
          label={t('householdSetup.baby.birthWeight')}
          value={setup.birthWeight}
          onChangeText={setup.setBirthWeight}
          keyboardType="number-pad"
          maxLength={4}
          suffix={t('baby.grams')}
          hint={t('householdSetup.baby.birthWeightHint')}
          invalid={problem('birth_weight') !== undefined}
          message={problem('birth_weight')}
          errorPrefix={t('common.error')}
        />
      </Card>

      {/* P0.1: its own statement, apart from health-data consent, never pre-ticked. */}
      <Card testID="setup-guardian">
        <Text style={s.title} accessibilityRole="header">
          {t('householdSetup.guardian.title')}
        </Text>
        <Checkbox
          label={t('householdSetup.guardian.declaration')}
          checked={setup.guardianDeclared}
          onChange={setup.setGuardianDeclared}
          invalid={problem('guardian') !== undefined}
          message={problem('guardian')}
          errorPrefix={t('common.error')}
          testID="setup-guardian-declaration"
        />
        <Text style={s.label}>{t('householdSetup.guardian.hint')}</Text>
      </Card>

      {/* P0.2: the guardian's health-data consent, on its own screen, first. */}
      <Card testID="setup-consent">
        <Text style={s.title} accessibilityRole="header">
          {t('householdSetup.consent.title')}
        </Text>
        {setup.consentGranted ? (
          <Text style={s.label}>{t('householdSetup.consent.agreed')}</Text>
        ) : (
          <>
            <Text style={s.label}>{t('householdSetup.consent.body')}</Text>
            {problem('consent') ? (
              <InlineError message={problem('consent')!} prefix={t('common.error')} />
            ) : null}
            <TextButton label={t('householdSetup.consent.button')} onPress={onConsent} />
          </>
        )}
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    title: { ...theme.type.formTitle, color: theme.palette.ink },
    label: { ...theme.type.small, color: theme.palette.textSoft },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    bornOn: { ...theme.type.detail, color: theme.palette.textSoft, textAlign: 'center' },
  });
