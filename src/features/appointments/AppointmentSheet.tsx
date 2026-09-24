import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Stepper, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useAppointmentSheet } from './useAppointmentSheet';

const HOURS = { step: 1, min: 0, max: 23 } as const;
const MINUTES = { step: 15, min: 0, max: 45 } as const;

/**
 * Add or change a clinic visit, and the questions to ask at it. A visit is a
 * time someone was given, so it is set rather than guessed from the clock.
 */
export function AppointmentSheet({ onDone, entryId }: { onDone: () => void; entryId?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const sheet = useAppointmentSheet(entryId);

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <TextField
          label={t('log.appointment.title')}
          value={sheet.form.title}
          onChangeText={(title) => sheet.update({ title })}
          maxLength={sheet.limits.title}
        />

        <Text style={theme.text.body}>{t('log.appointment.inDays')}</Text>
        <Stepper
          value={sheet.time.days}
          onChange={(days) => sheet.setTime({ days })}
          step={sheet.daysAhead.step}
          min={sheet.daysAhead.min}
          max={sheet.daysAhead.max}
          unit={t('log.appointment.days')}
          accessibilityLabel={t('log.appointment.inDays')}
        />
        <View style={s.clock}>
          <Stepper
            value={sheet.time.hour}
            onChange={(hour) => sheet.setTime({ hour })}
            step={HOURS.step}
            min={HOURS.min}
            max={HOURS.max}
            unit={t('log.appointment.hour')}
            accessibilityLabel={t('log.appointment.atHour')}
          />
          <Stepper
            value={sheet.time.minute}
            onChange={(minute) => sheet.setTime({ minute })}
            step={MINUTES.step}
            min={MINUTES.min}
            max={MINUTES.max}
            unit={t('log.appointment.minute')}
            accessibilityLabel={t('log.appointment.atMinute')}
          />
        </View>
        <Text style={theme.text.title} testID="appointment-when">
          {sheet.when}
        </Text>

        <TextField
          label={t('log.appointment.doctor')}
          value={sheet.form.doctor}
          onChangeText={(doctor) => sheet.update({ doctor })}
          maxLength={sheet.limits.doctor}
        />
        <TextField
          label={t('log.appointment.clinic')}
          value={sheet.form.clinic}
          onChangeText={(clinic) => sheet.update({ clinic })}
          maxLength={sheet.limits.clinic}
        />
        <TextField
          label={t('log.appointment.notes')}
          value={sheet.form.notes}
          onChangeText={(notes) => sheet.update({ notes })}
          maxLength={sheet.limits.notes}
          multiline
        />

        <Text style={theme.text.heading}>{t('log.appointment.questions')}</Text>
        <Text style={s.muted}>{t('log.appointment.questionsHint')}</Text>
        {sheet.form.questions.map((question, index) => (
          <View key={`${index}-${question}`} style={s.question} testID={`question-${index}`}>
            <Text style={[theme.text.body, s.questionText]}>{question}</Text>
            <Button
              label={t('log.appointment.removeQuestion')}
              variant="secondary"
              onPress={() => sheet.removeQuestion(index)}
            />
          </View>
        ))}
        <TextField
          label={t('log.appointment.addQuestion')}
          value={sheet.draft}
          onChangeText={sheet.setDraft}
          maxLength={sheet.limits.question}
        />
        <Button
          label={t('log.appointment.add')}
          variant="secondary"
          onPress={sheet.addQuestion}
          disabled={sheet.draft.trim() === ''}
        />

        <Button
          label={t('log.save')}
          disabled={!sheet.canSave}
          onPress={() => {
            sheet.save();
            onDone();
          }}
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
    clock: { flexDirection: 'row', gap: theme.spacing.md },
    question: { gap: theme.spacing.xs },
    questionText: { flexShrink: 1 },
  });
