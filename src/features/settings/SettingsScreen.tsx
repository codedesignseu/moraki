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

import { useConsent } from '@/privacy/useConsent';
import { useExport } from '@/privacy/useExport';
import { useRemindersState } from '@/notifications/RemindersProvider';
import { INTERVAL_MIN, SECOND_MIN, useReminderSettings } from '@/sync/useReminderSettings';

import { LANGUAGE_CHOICES, useLanguage } from './useLanguage';
import { useCaregivers, type CaregiverRow } from './useCaregivers';
import { useRoles } from './useRoles';
import { useSignOut } from './useSignOut';
import { useAdoption } from '@/sync/useAdoption';
import { Button, Card, Segmented, Stepper } from '@/ui/primitives';
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
  onReport,
  onCallScript,
  onAbout,
  onBaby,
  onConsent,
  onFeedback,
  onLeaveOrDelete,
}: {
  onSignIn: () => void;
  onSetUpHousehold: () => void;
  onJoinHousehold: () => void;
  onInvite: () => void;
  /** Opens a report for a range (P3-08). */
  onReport: (range: '24h' | '3d' | '7d') => void;
  /** Opens the call script (P3-07). */
  onCallScript: () => void;
  /** Opens the disclaimer and what the app does (P3-10). */
  onAbout: () => void;
  /** Opens the baby's details to correct them (P4-10). */
  onBaby: () => void;
  /** Opens the consent screen (P3-09). */
  onConsent: () => void;
  /** Opens the feedback form (P4-13). */
  onFeedback: () => void;
  /** Opens leaving a household and deleting the account (P4-06). */
  onLeaveOrDelete: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const [nightMode, setNightMode] = useDevicePref('nightMode');
  const language = useLanguage();
  const { state } = useAuth();
  const { household } = useAccountHousehold();
  const caregivers = useCaregivers();
  const { granted: consented } = useConsent();
  const exporting = useExport();
  const reminders = useRemindersState();
  const reminderSettings = useReminderSettings();
  const roles = useRoles();
  const sync = useSyncStatus();
  const syncErrors = useSyncErrors();
  const adoption = useAdoption();
  const signOut = useSignOut();

  return (
    <ScrollView contentContainerStyle={s.content}>
      {adoption.otherAccount && (
        <Card testID="settings-other-account">
          <Text style={theme.text.heading}>{t('settings.otherAccount.title')}</Text>
          <Text style={theme.text.body}>
            {t('settings.otherAccount.body', { name: adoption.babyName })}
          </Text>
          <Button label={t('settings.otherAccount.clear')} onPress={adoption.clearPhone} />
        </Card>
      )}
      {adoption.question === 'ask' && (
        <Card testID="settings-local-entries">
          <Text style={theme.text.heading}>{t('settings.localEntries.title')}</Text>
          <Text style={theme.text.body}>
            {t('settings.localEntries.body', {
              count: adoption.entries,
              name: adoption.babyName,
            })}
          </Text>
          <Button label={t('settings.localEntries.move')} onPress={adoption.move} />
          <Button
            label={t('settings.localEntries.keep')}
            variant="secondary"
            onPress={adoption.keepForNow}
          />
          <Text style={s.muted}>{t('settings.localEntries.hint')}</Text>
        </Card>
      )}
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
                        <View
                          key={person.userId}
                          style={s.caregiver}
                          testID={`caregiver-${person.userId}`}
                        >
                          <Text style={theme.text.body}>
                            {t('settings.account.caregiver', {
                              name: person.you ? t('home.recent.you') : person.name,
                              role: t(ROLE_LABEL[person.role]),
                            })}
                          </Text>
                          {/* The owner's own row has no controls: changing
                              your own role or removing yourself is leaving,
                              which is its own question (P4-06). */}
                          {roles.canManage && !person.you && person.role !== 'owner' && (
                            <>
                              <Segmented
                                options={[
                                  {
                                    value: 'caregiver',
                                    label: t('settings.account.role.caregiver'),
                                  },
                                  { value: 'viewer', label: t('settings.account.role.viewer') },
                                ]}
                                value={person.role}
                                onChange={(role) => void roles.setRole(person.userId, role)}
                                accessibilityLabel={t('settings.roles.whatTheyCanDo', {
                                  name: person.name,
                                })}
                                disabled={roles.busy}
                              />
                              <Button
                                label={t('settings.roles.remove', { name: person.name })}
                                variant="secondary"
                                disabled={roles.busy}
                                onPress={() => void roles.remove(person.userId)}
                              />
                            </>
                          )}
                        </View>
                      ))}
                      {roles.problem && (
                        <Text style={s.alert} accessibilityRole="alert" testID="roles-problem">
                          {t(`settings.roles.problem.${roles.problem}`)}
                        </Text>
                      )}
                      {roles.canManage && <Text style={s.muted}>{t('settings.roles.hint')}</Text>}
                    </View>
                  )}
                  <Button label={t('settings.account.baby')} variant="secondary" onPress={onBaby} />
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
              {signOut.asking ? (
                <View testID="settings-sign-out" style={s.group}>
                  <Text style={theme.text.body}>{t('settings.signOut.question')}</Text>
                  {signOut.unsent > 0 && (
                    <Text style={theme.text.bodyStrong}>
                      {t('settings.signOut.unsent', { count: signOut.unsent })}
                    </Text>
                  )}
                  <Button label={t('settings.signOut.keep')} onPress={signOut.keep} />
                  <Button
                    label={t('settings.signOut.clear')}
                    variant="secondary"
                    onPress={signOut.clear}
                  />
                  <Button
                    label={t('settings.signOut.cancel')}
                    variant="secondary"
                    onPress={signOut.cancel}
                  />
                </View>
              ) : (
                <Button
                  label={t('settings.account.signOut')}
                  variant="secondary"
                  onPress={signOut.ask}
                />
              )}
              <Button
                label={t('settings.account.leaveOrDelete')}
                variant="secondary"
                onPress={onLeaveOrDelete}
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
          {sync.blocked === 'no_consent' ? (
            <Text style={s.muted}>{t('settings.sync.noConsent')}</Text>
          ) : sync.blocked === 'not_linked' ? (
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

      {state.status === 'signedIn' && (
        <Card testID="settings-privacy">
          <Text style={theme.text.heading}>{t('settings.privacy.title')}</Text>
          <Text style={s.muted}>
            {t(consented ? 'settings.privacy.agreed' : 'settings.privacy.notAgreed')}
          </Text>
          <Button label={t('settings.privacy.consent')} variant="secondary" onPress={onConsent} />
        </Card>
      )}

      <Card testID="settings-report">
        <Text style={theme.text.heading}>{t('settings.report.title')}</Text>
        <Button label={t('settings.report.call')} variant="secondary" onPress={onCallScript} />
        <Button
          label={t('settings.report.range24h')}
          variant="secondary"
          onPress={() => onReport('24h')}
        />
        <Button
          label={t('settings.report.range3d')}
          variant="secondary"
          onPress={() => onReport('3d')}
        />
        <Button
          label={t('settings.report.range7d')}
          variant="secondary"
          onPress={() => onReport('7d')}
        />
      </Card>

      <Card testID="settings-data">
        <Text style={theme.text.heading}>{t('settings.data.title')}</Text>
        <Button
          label={t(exporting.busy ? 'settings.data.exporting' : 'settings.data.export')}
          variant="secondary"
          disabled={exporting.busy}
          onPress={() => void exporting.exportAll()}
        />
        <Text style={s.muted}>{t('settings.data.exportHint')}</Text>
        {exporting.problem && (
          <Text style={s.alert} accessibilityRole="alert" testID="export-problem">
            {t(`settings.data.exportProblem.${exporting.problem}`)}
          </Text>
        )}
      </Card>

      <Card testID="settings-feedback">
        <Text style={theme.text.heading}>{t('settings.feedback.title')}</Text>
        <Text style={s.muted}>
          {t(
            state.status === 'signedIn'
              ? 'settings.feedback.body'
              : 'settings.feedback.needsAccount',
          )}
        </Text>
        {state.status === 'signedIn' && (
          <Button label={t('settings.feedback.open')} variant="secondary" onPress={onFeedback} />
        )}
      </Card>

      <Card testID="settings-about">
        <Text style={theme.text.heading}>{t('settings.about.title')}</Text>
        <Text style={s.muted}>{t('about.disclaimer.title')}</Text>
        <Button label={t('settings.about.open')} variant="secondary" onPress={onAbout} />
      </Card>

      <Card testID="settings-reminders">
        <Text style={theme.text.heading}>{t('settings.reminders.title')}</Text>
        <Text style={theme.text.body}>{t('settings.reminders.toggle')}</Text>
        <Segmented
          options={[
            { value: 'on', label: t('settings.reminders.on') },
            { value: 'off', label: t('settings.reminders.off') },
          ]}
          value={reminders.enabled ? 'on' : 'off'}
          onChange={(choice) => void reminders.setEnabled(choice === 'on')}
          accessibilityLabel={t('settings.reminders.toggle')}
        />
        <Text style={s.muted}>
          {reminders.permission === 'denied'
            ? t('settings.reminders.denied')
            : t('settings.reminders.hint')}
        </Text>

        <Text style={theme.text.body}>{t('settings.reminders.interval')}</Text>
        {reminderSettings.canChange ? (
          <Stepper
            value={reminderSettings.settings.intervalMin}
            onChange={reminderSettings.setIntervalMin}
            step={INTERVAL_MIN.step}
            min={INTERVAL_MIN.min}
            max={INTERVAL_MIN.max}
            unit={t('settings.reminders.minutes')}
            accessibilityLabel={t('settings.reminders.interval')}
          />
        ) : (
          <Text style={theme.text.title}>
            {t('settings.reminders.everyMinutes', { count: reminderSettings.settings.intervalMin })}
          </Text>
        )}

        <Text style={theme.text.body}>{t('settings.reminders.second')}</Text>
        {reminderSettings.canChange ? (
          <>
            <Segmented
              options={[
                { value: 'off', label: t('settings.reminders.secondOff') },
                { value: 'on', label: t('settings.reminders.secondOn') },
              ]}
              value={reminderSettings.settings.secondReminderMin === null ? 'off' : 'on'}
              onChange={(choice) =>
                reminderSettings.setSecondReminderMin(choice === 'off' ? null : SECOND_MIN.min)
              }
              accessibilityLabel={t('settings.reminders.second')}
            />
            {reminderSettings.settings.secondReminderMin !== null && (
              <Stepper
                value={reminderSettings.settings.secondReminderMin}
                onChange={reminderSettings.setSecondReminderMin}
                step={SECOND_MIN.step}
                min={SECOND_MIN.min}
                max={SECOND_MIN.max}
                unit={t('settings.reminders.minutes')}
                accessibilityLabel={t('settings.reminders.secondAfter')}
              />
            )}
          </>
        ) : (
          <Text style={theme.text.title}>
            {reminderSettings.settings.secondReminderMin === null
              ? t('settings.reminders.secondOff')
              : t('settings.reminders.everyMinutes', {
                  count: reminderSettings.settings.secondReminderMin,
                })}
          </Text>
        )}
        <Text style={s.muted}>
          {t(
            reminderSettings.sharedWithHousehold
              ? 'settings.reminders.forEveryone'
              : reminderSettings.canChange
                ? 'settings.reminders.forThisPhone'
                : 'settings.reminders.ownerSets',
          )}
        </Text>
      </Card>

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

      <Card testID="settings-language">
        <Text style={theme.text.heading}>{t('settings.language.title')}</Text>
        <Segmented
          options={LANGUAGE_CHOICES.map((choice) => ({
            value: choice,
            label: t(`settings.language.${choice}`),
          }))}
          value={language.choice}
          onChange={language.choose}
          accessibilityLabel={t('settings.language.title')}
        />
        <Text style={s.muted}>
          {language.choice === 'device'
            ? t('settings.language.deviceHint', {
                name: t(`settings.language.${language.language === 'el' ? 'el' : 'en'}`),
              })
            : t('settings.language.chosenHint')}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    alert: { ...theme.text.body, color: theme.colors.invalid },
    caregivers: { gap: theme.spacing.md },
    caregiver: { gap: theme.spacing.xs },
    group: { gap: theme.spacing.sm },
  });
