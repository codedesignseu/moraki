import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, DateTimeField, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useAppointmentSheet } from './useAppointmentSheet';

/**
 * Add or change a clinic visit, and the questions to ask at it.
 *
 * The time is set with the picker alone. A visit is never "just happened",
 * so a relative stepper has no fast case to serve here the way it does for a
 * feed — it was thirty taps for a month out and nothing gained.
 */
export function AppointmentSheet({ onDone, entryId }: { onDone: () => void; entryId?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const sheet = useAppointmentSheet(entryId);

  return (
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

      <DateTimeField
        label={t('log.appointment.exact')}
        value={sheet.at}
        onChange={sheet.setAt}
        display={sheet.when}
        openLabel={t('log.exactTime')}
        testID="appointment-when"
      />

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

      <Text style={theme.type.tileTitle}>{t('log.appointment.questions')}</Text>
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
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      padding: theme.spacing.screen,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    question: { gap: theme.spacing.xs },
    questionText: { flexShrink: 1 },
  });
