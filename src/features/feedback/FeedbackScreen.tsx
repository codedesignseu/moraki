import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { FEEDBACK_KINDS, MESSAGE_MAX, type FeedbackKind } from '@/sync/feedback';
import { Button, Card, Segmented, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useFeedback } from './useFeedback';

/**
 * Telling us something is wrong, from inside the app (P4-13). It goes to this
 * project's own database and nowhere else: no support desk, no analytics, no
 * third party. The copy asks for the app, not the baby, because a message is
 * read by a person and health details do not belong in one.
 */
export function FeedbackScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const [kind, setKind] = useState<FeedbackKind>('problem');
  const [message, setMessage] = useState('');
  const { problem, busy, sent, send } = useFeedback();
  const ready = message.trim().length > 0;

  if (sent) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Card testID="feedback-sent">
          <Text style={theme.text.heading}>{t('feedback.sent.title')}</Text>
          <Text style={theme.text.body}>{t('feedback.sent.body')}</Text>
        </Card>
        <Button label={t('feedback.close')} onPress={onDone} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="feedback-form">
        <Text style={theme.text.body}>{t('feedback.intro')}</Text>
        <Segmented
          options={FEEDBACK_KINDS.map((value) => ({ value, label: t(`feedback.kind.${value}`) }))}
          value={kind}
          onChange={setKind}
          accessibilityLabel={t('feedback.kindLabel')}
        />
        <TextField
          label={t('feedback.message')}
          value={message}
          onChangeText={setMessage}
          maxLength={MESSAGE_MAX}
          multiline
          hint={t('feedback.messageHint')}
        />
        <Text style={s.muted}>{t('feedback.sends')}</Text>
      </Card>

      {problem && (
        <Text style={s.problem} accessibilityRole="alert" testID="feedback-problem">
          {t(`feedback.problem.${problem}`)}
        </Text>
      )}

      <Button
        label={t(busy ? 'feedback.sending' : 'feedback.send')}
        disabled={busy || !ready}
        onPress={() => void send({ kind, message })}
      />
      <Button label={t('feedback.notNow')} variant="secondary" onPress={onDone} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    problem: { ...theme.text.body, color: theme.colors.invalid },
  });
