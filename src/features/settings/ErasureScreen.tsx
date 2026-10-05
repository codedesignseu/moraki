import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Card, Segmented } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useErasure, type ErasureAction } from './useErasure';

/**
 * Leave the household, delete it, or delete the account (P4-06, App Store
 * guideline 5.1.1(v)). Each action says what it removes and asks once more
 * before anything is sent.
 */
export function ErasureScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const erasure = useErasure(onDone);
  const [confirming, setConfirming] = useState<ErasureAction | null>(null);

  const what = (action: ErasureAction) =>
    action === 'deleteAccount' && erasure.soleMember
      ? t('erasure.deleteAccount.whatAlone', { name: erasure.babyName })
      : t(`erasure.${action}.what`, { name: erasure.babyName });

  const section = (action: ErasureAction) => (
    <Card testID={`erasure-${action}`}>
      <Text style={theme.text.title}>{t(`erasure.${action}.title`)}</Text>
      <Text style={theme.text.body}>{what(action)}</Text>
      {confirming === action ? (
        <>
          {action !== 'deleteHousehold' && erasure.candidates.length > 0 && (
            <>
              <Text style={theme.text.body}>{t('erasure.successor.question')}</Text>
              <Segmented
                options={erasure.candidates.map((person) => ({
                  value: person.userId,
                  label: person.name,
                }))}
                value={erasure.successor}
                onChange={erasure.setSuccessor}
                accessibilityLabel={t('erasure.successor.question')}
                disabled={erasure.busy}
              />
            </>
          )}
          <Text style={theme.text.bodyStrong} accessibilityRole="alert">
            {t('erasure.cannotUndo')}
          </Text>
          <Button
            label={t(erasure.busy ? 'erasure.working' : `erasure.${action}.confirm`)}
            disabled={erasure.busy || !erasure.ready(action)}
            onPress={() => void erasure.run(action)}
          />
          <Button
            label={t('erasure.cancel')}
            variant="secondary"
            disabled={erasure.busy}
            onPress={() => setConfirming(null)}
          />
        </>
      ) : (
        <Button
          label={t(`erasure.${action}.button`)}
          variant="secondary"
          disabled={erasure.busy}
          onPress={() => setConfirming(action)}
        />
      )}
    </Card>
  );

  if (!erasure.signedIn) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Text style={theme.text.body}>{t('erasure.signedOut')}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      {erasure.canLeave && section('leave')}
      {erasure.canDeleteHousehold && section('deleteHousehold')}
      {section('deleteAccount')}
      {erasure.problem && (
        <Text style={s.alert} accessibilityRole="alert" testID="erasure-problem">
          {t(`erasure.problem.${erasure.problem}`)}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: theme.spacing.md },
    alert: { ...theme.text.body, color: theme.colors.invalid },
  });
