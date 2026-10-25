import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, InlineError, Page } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useErasure, type ErasureAction } from './useErasure';

/**
 * Leave the household, delete it, or delete the account (P4-06, App Store
 * guideline 5.1.1(v)). Each action says what it removes and asks once more
 * before anything is sent. G account/leave: successor as chips, the confirm
 * inline in a pink panel. The text is the app's, unchanged.
 */
export function ErasureScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const erasure = useErasure(onDone);
  const [confirming, setConfirming] = useState<ErasureAction | null>(null);

  const what = (action: ErasureAction) =>
    action === 'deleteAccount' && erasure.soleMember
      ? t('erasure.deleteAccount.whatAlone', { name: erasure.babyName })
      : t(`erasure.${action}.what`, { name: erasure.babyName });

  const page = {
    title: t('erasure.screenTitle'),
    onBack,
    backLabel: t('common.back'),
  };

  const section = (action: ErasureAction) => (
    <Card testID={`erasure-${action}`}>
      <Text style={s.title} accessibilityRole="header">
        {t(`erasure.${action}.title`)}
      </Text>
      <Text style={s.what}>{what(action)}</Text>
      {confirming === action ? (
        <>
          {action !== 'deleteHousehold' && erasure.candidates.length > 0 && (
            <>
              {/* Read out: the chips below carry no group name of their own. */}
              <Text style={s.label}>{t('erasure.successor.question')}</Text>
              <Text style={s.label}>{t('erasure.successor.hint')}</Text>
              <View style={s.chips}>
                {erasure.candidates.map((person) => (
                  <Chip
                    key={person.userId}
                    label={person.name}
                    selected={erasure.successor === person.userId}
                    onPress={() => erasure.setSuccessor(person.userId)}
                    disabled={erasure.busy}
                  />
                ))}
              </View>
            </>
          )}
          {/* G account/leave: the confirm panel inside the card. */}
          <View style={s.confirm}>
            <Text style={s.cannotUndo} accessibilityRole="alert">
              {t('erasure.cannotUndo')}
            </Text>
            <View style={s.buttons}>
              <View style={s.button}>
                <Button
                  label={t(erasure.busy ? 'erasure.working' : `erasure.${action}.confirm`)}
                  variant="destructive"
                  busy={erasure.busy}
                  disabled={!erasure.ready(action)}
                  onPress={() => void erasure.run(action)}
                />
              </View>
              <View style={s.button}>
                <Button
                  label={t('erasure.cancel')}
                  variant="secondary"
                  disabled={erasure.busy}
                  onPress={() => setConfirming(null)}
                />
              </View>
            </View>
          </View>
        </>
      ) : (
        <Button
          label={t(`erasure.${action}.button`)}
          variant={action === 'leave' ? 'secondary' : 'destructive'}
          disabled={erasure.busy}
          onPress={() => setConfirming(action)}
        />
      )}
    </Card>
  );

  if (!erasure.signedIn) {
    return (
      <Page {...page}>
        <Card>
          <Text style={s.what}>{t('erasure.signedOut')}</Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page {...page}>
      {erasure.canLeave && section('leave')}
      {erasure.noGuardian && (
        <Card testID="erasure-leave-blocked">
          <Text style={s.what}>{t('erasure.successor.none')}</Text>
        </Card>
      )}
      {erasure.canDeleteHousehold && section('deleteHousehold')}
      {section('deleteAccount')}
      {erasure.problem && (
        <InlineError
          message={t(`erasure.problem.${erasure.problem}`)}
          prefix={t('common.error')}
          testID="erasure-problem"
        />
      )}
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    title: { ...theme.type.formTitle, color: theme.palette.ink },
    what: { ...theme.type.body, color: theme.palette.textSoft },
    label: { ...theme.type.small, color: theme.palette.textSoft },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    confirm: {
      backgroundColor: theme.palette.errorSurface,
      borderRadius: theme.radius.card,
      padding: theme.spacing.field,
      gap: theme.spacing.md,
    },
    cannotUndo: { ...theme.type.buttonSecondary, color: theme.palette.ink },
    buttons: { flexDirection: 'row', gap: theme.spacing.grid },
    button: { flex: 1 },
  });
