import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Card, Segmented, Stepper, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { BABY_LIMITS, useBabyProfile } from './useBabyProfile';

/** Correct the baby's name, birth date and birth weight (P4-10). */
export function BabyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const baby = useBabyProfile();

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Card testID="baby-details">
          <TextField
            label={t('baby.name')}
            value={baby.name}
            onChangeText={baby.setName}
            maxLength={BABY_LIMITS.name}
          />

          <Text style={theme.text.body}>{t('baby.born')}</Text>
          <Stepper
            value={baby.bornDaysAgo}
            onChange={baby.setBornDaysAgo}
            step={BABY_LIMITS.bornDaysAgo.step}
            min={BABY_LIMITS.bornDaysAgo.min}
            max={BABY_LIMITS.bornDaysAgo.max}
            unit={t('baby.daysAgo')}
            accessibilityLabel={t('baby.born')}
          />
          <Text style={theme.text.title} testID="baby-born-on">
            {baby.bornOn}
          </Text>

          <Text style={theme.text.body}>{t('baby.birthWeight')}</Text>
          <Segmented
            options={[
              { value: 'known', label: t('baby.weightKnown') },
              { value: 'unknown', label: t('baby.weightUnknown') },
            ]}
            value={baby.birthWeightG === null ? 'unknown' : 'known'}
            onChange={(choice) =>
              baby.setBirthWeightG(
                choice === 'unknown' ? null : BABY_LIMITS.birthWeightG.min + 2900,
              )
            }
            accessibilityLabel={t('baby.birthWeight')}
          />
          {baby.birthWeightG !== null && (
            <Stepper
              value={baby.birthWeightG}
              onChange={baby.setBirthWeightG}
              step={BABY_LIMITS.birthWeightG.step}
              min={BABY_LIMITS.birthWeightG.min}
              max={BABY_LIMITS.birthWeightG.max}
              unit={t('baby.grams')}
              accessibilityLabel={t('baby.birthWeightGrams')}
            />
          )}
          <Text style={s.muted}>{t('baby.weightHint')}</Text>
        </Card>

        {baby.problem && (
          <Text style={s.alert} accessibilityRole="alert" testID="baby-problem">
            {t(`baby.problem.${baby.problem}`)}
          </Text>
        )}
        {baby.saved && (
          <Text style={s.muted} testID="baby-saved">
            {t('baby.saved')}
          </Text>
        )}

        <Button
          label={t(baby.busy ? 'baby.saving' : 'baby.save')}
          disabled={!baby.canEdit || baby.busy}
          onPress={() => void baby.save()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: theme.spacing.md },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    alert: { ...theme.text.body, color: theme.colors.invalid },
  });
