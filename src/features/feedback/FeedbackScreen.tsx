import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { FEEDBACK_KINDS, MESSAGE_MAX, type FeedbackKind } from '@/sync/feedback';
import {
  Button,
  Card,
  FieldLabel,
  IconCircle,
  InlineError,
  Page,
  Segmented,
  TextButton,
  TextField,
} from '@/ui/primitives';
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
  const page = {
    title: t('feedback.title'),
    kind: 'close',
    onBack: onDone,
    backLabel: t('common.close'),
  } as const;

  if (sent) {
    // G account/feedback-thanks: a green card with a check, Close at the foot.
    return (
      <Page
        {...page}
        footer={<Button label={t('feedback.close')} variant="secondary" onPress={onDone} />}
      >
        <Card tone="pump" testID="feedback-sent">
          <IconCircle icon="check" tone="card" size="tile" />
          <Text style={s.thanksTitle} accessibilityRole="header">
            {t('feedback.sent.title')}
          </Text>
          <Text style={s.soft}>{t('feedback.sent.body')}</Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      {...page}
      footer={
        <>
          {problem ? (
            <InlineError
              message={t(`feedback.problem.${problem}`)}
              prefix={t('common.error')}
              testID="feedback-problem"
            />
          ) : null}
          <Button
            label={t(busy ? 'feedback.sending' : 'feedback.send')}
            busy={busy}
            disabled={!ready}
            onPress={() => void send({ kind, message })}
          />
          <TextButton label={t('feedback.notNow')} align="center" onPress={onDone} />
        </>
      }
    >
      <Card testID="feedback-form">
        <Text style={s.soft}>{t('feedback.intro')}</Text>
        <FieldLabel label={t('feedback.kindLabel')} />
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
        <Text style={s.soft}>{t('feedback.sends')}</Text>
      </Card>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    soft: { ...theme.type.detail, color: theme.palette.textSoft },
    thanksTitle: { ...theme.type.heading, color: theme.palette.ink },
  });
