import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDevicePref } from '@/db/react';
import { NIGHT_MODES } from '@/domain/time/night';
import { useAuth } from '@/sync/AuthProvider';
import { useAccountHousehold } from '@/sync/useAccountHousehold';
import { useSyncStatus } from '@/sync/SyncProvider';
import { useSyncErrors } from '@/sync/useSyncErrors';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

import { useCaregivers, type CaregiverRow } from './useCaregivers';
import { Button, Card, Segmented } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * Settings (SDD 7). Account and night mode for now; reminders, caregivers,
 * the report and the rest join as their tasks land.
 */
const OP_LABEL = {
  insert: 'settings.sync.op.insert',
  patch: 'settings.sync.op.patch',
  delete: 'settings.sync.op.delete',
} as const;

const REASON_LABEL: Record<string, 'settings.sync.reason.forbidden'> = {
  forbidden: 'settings.sync.reason.forbidden',
  invalid: 'settings.sync.reason.invalid' as 'settings.sync.reason.forbidden',
  not_found: 'settings.sync.reason.not_found' as 'settings.sync.reason.forbidden',
};

/** Typed keys, so a new role can't quietly render nothing. */
const ROLE_LABEL = {
  owner: 'settings.account.role.owner',
  caregiver: 'settings.account.role.caregiver',
  viewer: 'settings.account.role.viewer',
} as const;

export function SettingsScreen({
  onSignIn,
  onSetUpHousehold,
  onJoinHousehold,
  onInvite,
}: {
  onSignIn: () => void;
  onSetUpHousehold: () => void;
  onJoinHousehold: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const [nightMode, setNightMode] = useDevicePref('nightMode');
  const { auth, state } = useAuth();
  const { household } = useAccountHousehold();
  const caregivers = useCaregivers();
  const sync = useSyncStatus();
  const syncErrors = useSyncErrors();

  return (
    <ScrollView contentContainerStyle={s.content}>
      {(state.status === 'signedIn' || state.status === 'signedOut') && (
        <Card testID="settings-account">
          <Text style={theme.text.heading}>{t('settings.account.title')}</Text>
          {state.status === 'signedIn' ? (
            <>
              <Text style={theme.text.body}>
                {t('settings.account.signedInAs', { email: state.user.email ?? '' })}
              </Text>
              {household ? (
                <>
                  <Text style={theme.text.body}>
                    {t('settings.account.household', { name: household.babyName })}
                  </Text>
                  {caregivers.length > 0 && (
                    <View style={s.caregivers} testID="settings-caregivers">
                      <Text style={s.muted}>{t('settings.account.caregivers')}</Text>
                      {caregivers.map((person: CaregiverRow) => (
                        <Text key={person.userId} style={theme.text.body}>
                          {t('settings.account.caregiver', {
                            name: person.you ? t('home.recent.you') : person.name,
                            role: t(ROLE_LABEL[person.role]),
                          })}
                        </Text>
                      ))}
                    </View>
                  )}
                  {household.role === 'owner' && (
                    <Button
                      label={t('settings.account.invite')}
                      variant="secondary"
                      onPress={onInvite}
                    />
                  )}
                </>
              ) : (
                <>
                  <Text style={s.muted}>{t('settings.account.setUpHint')}</Text>
                  <Button label={t('settings.account.setUpHousehold')} onPress={onSetUpHousehold} />
                  <Button
                    label={t('settings.account.joinHousehold')}
                    variant="secondary"
                    onPress={onJoinHousehold}
                  />
                </>
              )}
              <Button
                label={t('settings.account.signOut')}
                variant="secondary"
                onPress={() => void auth?.signOut()}
              />
            </>
          ) : (
            <>
              <Text style={s.muted}>{t('settings.account.signedOutHint')}</Text>
              <Button label={t('settings.account.signIn')} onPress={onSignIn} />
            </>
          )}
        </Card>
      )}
      {state.status === 'signedIn' && (
        <Card testID="settings-sync">
          <Text style={theme.text.heading}>{t('settings.sync.title')}</Text>
          {sync.blocked === 'not_linked' ? (
            <Text style={s.muted}>{t('settings.sync.notShared')}</Text>
          ) : (
            <>
              <Text style={theme.text.body} testID="settings-sync-pending">
                {sync.pending === 0
                  ? t('settings.sync.allSent')
                  : t('settings.sync.waiting', { count: sync.pending })}
              </Text>
              <Text style={s.muted}>
                {sync.lastPushAt === null
                  ? t('settings.sync.neverSent')
                  : t('settings.sync.lastSent', {
                      time: formatClock(sync.lastPushAt, deviceTimeZone()),
                    })}
              </Text>
            </>
          )}
          {syncErrors.length > 0 && (
            <View style={s.caregivers} testID="settings-sync-errors">
              <Text style={s.muted}>{t('settings.sync.refused')}</Text>
              {syncErrors.map((row) => (
                <Text key={row.id} style={theme.text.body}>
                  {t('settings.sync.refusedRow', {
                    what: t(OP_LABEL[row.op]),
                    reason: t(REASON_LABEL[row.reason] ?? 'settings.sync.reason.unknown'),
                  })}
                </Text>
              ))}
            </View>
          )}
        </Card>
      )}

      <Card testID="settings-night-mode">
        <Text style={theme.text.heading}>{t('settings.nightMode.title')}</Text>
        <Segmented
          options={NIGHT_MODES.map((mode) => ({
            value: mode,
            label: t(`settings.nightMode.${mode}`),
          }))}
          value={nightMode}
          onChange={setNightMode}
          accessibilityLabel={t('settings.nightMode.title')}
        />
        <Text style={s.muted}>{t(`settings.nightMode.${nightMode}Hint`)}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    caregivers: { gap: theme.spacing.xs },
  });
