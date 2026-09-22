import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RELATIONS } from '@/sync/household';
import { Button, Card, Chip, Stepper, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { LIMITS, useHouseholdSetup } from './useHouseholdSetup';

/** First run after sign in (SDD 7, `onboarding/*`): about you, then the baby. */
export function HouseholdSetupScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const setup = useHouseholdSetup(onDone);
  const problem = (field: 'display_name' | 'baby_name' | 'birth_weight') =>
    setup.problem === field ? t(`householdSetup.problem.${field}`) : undefined;
  const general =
    setup.problem && !['display_name', 'baby_name', 'birth_weight'].includes(setup.problem)
      ? t(`householdSetup.problem.${setup.problem}` as 'householdSetup.problem.offline')
      : null;

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card testID="setup-you">
        <Text style={theme.text.heading}>{t('householdSetup.you.title')}</Text>
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
        />
        <Text style={s.muted}>{t('householdSetup.you.relation')}</Text>
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
        <Text style={theme.text.heading}>{t('householdSetup.baby.title')}</Text>
        <TextField
          label={t('householdSetup.baby.name')}
          value={setup.babyName}
          onChangeText={setup.setBabyName}
          maxLength={LIMITS.babyName}
          invalid={problem('baby_name') !== undefined}
          message={problem('baby_name')}
        />
        <Text style={s.muted}>{t('householdSetup.baby.born')}</Text>
        <Stepper
          value={setup.bornDaysAgo}
          onChange={setup.setBornDaysAgo}
          min={0}
          max={LIMITS.bornDaysAgo.max}
          unit={t('householdSetup.baby.daysAgo')}
          accessibilityLabel={t('householdSetup.baby.born')}
        />
        <Text style={theme.text.body}>
          {t('householdSetup.baby.bornOn', { date: setup.bornOn })}
        </Text>
        <TextField
          label={t('householdSetup.baby.birthWeight')}
          value={setup.birthWeight}
          onChangeText={setup.setBirthWeight}
          keyboardType="number-pad"
          maxLength={4}
          hint={t('householdSetup.baby.birthWeightHint')}
          invalid={problem('birth_weight') !== undefined}
          message={problem('birth_weight')}
        />
      </Card>

      {general && (
        <Text accessibilityRole="alert" style={s.alert}>
          {general}
        </Text>
      )}
      <Button label={t('householdSetup.save')} onPress={setup.save} disabled={setup.busy} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    alert: { ...theme.text.body, color: theme.colors.invalid },
  });
