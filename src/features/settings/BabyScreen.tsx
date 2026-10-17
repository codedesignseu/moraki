import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import {
  Button,
  Card,
  FieldLabel,
  InlineError,
  Page,
  Segmented,
  Stepper,
  TextField,
} from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { BABY_LIMITS, useBabyProfile } from './useBabyProfile';

/**
 * Correct the baby's name, birth date and birth weight (P4-10; G
 * account/baby). G's read-only variant for caregivers is design only (G3).
 */
export function BabyScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const baby = useBabyProfile();

  return (
    <Page
      title={t('baby.title')}
      onBack={onBack}
      backLabel={t('common.back')}
      footer={
        <>
          {baby.problem ? (
            <InlineError
              message={t(`baby.problem.${baby.problem}`)}
              prefix={t('common.error')}
              testID="baby-problem"
            />
          ) : null}
          {baby.saved ? (
            <Text style={s.soft} testID="baby-saved">
              {t('baby.saved')}
            </Text>
          ) : null}
          <Button
            label={t(baby.busy ? 'baby.saving' : 'baby.save')}
            busy={baby.busy}
            disabled={!baby.canEdit}
            onPress={() => void baby.save()}
          />
        </>
      }
    >
      <Card testID="baby-details">
        <TextField
          label={t('baby.name')}
          value={baby.name}
          onChangeText={baby.setName}
          maxLength={BABY_LIMITS.name}
        />

        <FieldLabel label={t('baby.born')} />
        <Stepper
          value={baby.bornDaysAgo}
          onChange={baby.setBornDaysAgo}
          step={BABY_LIMITS.bornDaysAgo.step}
          min={BABY_LIMITS.bornDaysAgo.min}
          max={BABY_LIMITS.bornDaysAgo.max}
          unit={t('baby.daysAgo')}
          accessibilityLabel={t('baby.born')}
          size="compact"
        />
        <Text style={s.bornOn} testID="baby-born-on">
          {t('householdSetup.baby.bornOn', { date: baby.bornOn })}
        </Text>

        <FieldLabel label={t('baby.birthWeight')} />
        <Segmented
          options={[
            { value: 'known', label: t('baby.weightKnown') },
            { value: 'unknown', label: t('baby.weightUnknown') },
          ]}
          value={baby.birthWeightG === null ? 'unknown' : 'known'}
          onChange={(choice) =>
            baby.setBirthWeightG(choice === 'unknown' ? null : BABY_LIMITS.birthWeightG.min + 2900)
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
            size="compact"
          />
        )}
        <Text style={s.soft}>{t('baby.weightHint')}</Text>
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    soft: { ...theme.type.detail, color: theme.palette.textSoft },
    bornOn: { ...theme.type.detail, color: theme.palette.textSoft, textAlign: 'center' },
  });
