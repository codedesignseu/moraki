import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, DateTimeField, IconButton, TextField } from '@/ui/primitives';
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

      <Text style={[theme.type.cardTitle, s.ink]} accessibilityRole="header">
        {t('log.appointment.questions')}
      </Text>
      <Text style={s.muted}>{t('log.appointment.questionsHint')}</Text>
      {sheet.form.questions.map((question, index) => (
        // Keyed by place, not text: the field is edited in place and a key
        // that changed with every letter would drop the keyboard.
        <View key={index} style={s.question} testID={`question-${index}`}>
          <View style={s.questionField}>
            <TextField
              label={t('log.appointment.question', { n: index + 1 })}
              value={question}
              onChangeText={(text) => sheet.editQuestion(index, text)}
              maxLength={sheet.limits.question}
            />
          </View>
          <View style={s.remove}>
            <IconButton
              icon="close"
              tone="chip"
              size="large"
              accessibilityLabel={t('log.appointment.removeQuestion', { n: index + 1 })}
              onPress={() => sheet.removeQuestion(index)}
            />
          </View>
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
        icon="plus"
        onPress={sheet.addQuestion}
        disabled={sheet.draft.trim() === ''}
      />

      <View style={s.footer}>
        <Button
          label={sheet.editing ? t('entry.saveChanges') : t('log.save')}
          disabled={!sheet.canSave}
          onPress={() => {
            sheet.save();
            onDone();
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    // G sheets/appointment: the feed sheet's spacing.
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.section,
    },
    ink: { color: theme.palette.ink },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    // The field and its round remove button, the button level with the box.
    question: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md },
    questionField: { flex: 1 },
    remove: { marginBottom: (theme.size.input - theme.size.circleControl) / 2 },
    footer: { marginTop: 'auto' },
  });
