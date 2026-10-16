import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDevicePref } from '@/db/react';
import { NIGHT_MODES } from '@/domain/time/night';
import { useAuth } from '@/sync/AuthProvider';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

import { useExport } from '@/privacy/useExport';
import { useRemindersState } from '@/notifications/RemindersProvider';
import { INTERVAL_MIN, SECOND_MIN, useReminderSettings } from '@/sync/useReminderSettings';

import { LANGUAGE_CHOICES, useLanguage } from './useLanguage';
import { AccountCard } from './AccountCard';
import { AdoptionCards } from './AdoptionCards';
import { PrivacyCard } from './PrivacyCard';
import { SyncCard } from './SyncCard';
import { useSentryTest } from './useSentryTest';
import type { IconName } from '@/ui/icons';
import {
  Button,
  Card,
  Icon,
  ListGroup,
  ListRow,
  ScreenTitle,
  Segmented,
  Stepper,
  Toast,
} from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * Settings (SDD 7), in G's order (tabs/settings): warnings, Account, Sync,
 * Privacy, Reminders, Night mode, Language, Report, Data export, then rows
 * that open their own screens.
 */
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
  const exporting = useExport();
  const reminders = useRemindersState();
  const reminderSettings = useReminderSettings();
  const sentryTest = useSentryTest();

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenTitle title={t('tabs.settings')} />
        <AdoptionCards />
        <AccountCard
          onSignIn={onSignIn}
          onSetUpHousehold={onSetUpHousehold}
          onJoinHousehold={onJoinHousehold}
          onInvite={onInvite}
        />
        <SyncCard />
        <PrivacyCard onConsent={onConsent} />
        <Card testID="settings-reminders">
          <CardTitle icon="reminder" badge="feed" title={t('settings.reminders.title')} />
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
              {t('settings.reminders.everyMinutes', {
                count: reminderSettings.settings.intervalMin,
              })}
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
          <CardTitle icon="sleep" badge="sleep" title={t('settings.nightMode.title')} />
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
          <CardTitle icon="tab-settings" badge="pump" title={t('settings.language.title')} />
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

        <Card testID="settings-report">
          <CardTitle icon="share" badge="sleep" title={t('settings.report.title')} />
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
          <CardTitle icon="export" badge="sleep" title={t('settings.data.title')} />
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
          <CardTitle icon="link" badge="pump" title={t('settings.feedback.title')} />
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
          <CardTitle icon="eu-shield" badge="pump" title={t('settings.about.title')} />
          <Text style={s.muted}>{t('about.disclaimer.title')}</Text>
          <Button label={t('settings.about.open')} variant="secondary" onPress={onAbout} />
        </Card>

        {state.status === 'signedIn' && (
          <ListGroup testID="settings-account-rows">
            {household && (
              <ListRow grouped icon="health" title={t('settings.account.baby')} onPress={onBaby} />
            )}
            <ListRow
              grouped
              icon="delete"
              title={t('settings.account.leaveOrDelete')}
              onPress={onLeaveOrDelete}
            />
          </ListGroup>
        )}

        {sentryTest.confirming && (
          <Card testID="settings-sentry-test">
            <Text style={theme.text.body}>{t('settings.sentryTest.confirm')}</Text>
            <Button label={t('settings.sentryTest.send')} onPress={sentryTest.confirm} />
            <Button
              label={t('settings.sentryTest.cancel')}
              variant="secondary"
              onPress={sentryTest.cancel}
            />
          </Card>
        )}
        {/* Seven taps open the hidden Sentry test action (P4-F4's device check). */}
        <Text style={s.version} onPress={sentryTest.tapVersion} testID="settings-version">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
        </Text>
      </ScrollView>
      {sentryTest.result && (
        <Toast
          message={t(`settings.sentryTest.${sentryTest.result}`)}
          actionLabel={t('settings.sentryTest.ok')}
          onAction={sentryTest.dismiss}
        />
      )}
    </View>
  );
}

/** Sage 19 group heading: a round tile-coloured badge with the icon, then the title. */
function CardTitle({
  icon,
  badge,
  title,
}: {
  icon: IconName;
  badge: 'feed' | 'sleep' | 'diaper' | 'pump';
  title: string;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.titleRow}>
      <View style={[s.badge, { backgroundColor: theme.palette[badge] }]}>
        <Icon name={icon} color={theme.palette.onTile} />
      </View>
      <Text style={[theme.type.tileTitle, s.title]}>{title}</Text>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    content: {
      paddingHorizontal: theme.spacing.screen,
      paddingBottom: theme.size.tabBarClearance,
      gap: theme.spacing.lg,
    },
    version: { ...theme.type.detail, color: theme.palette.textSoft, textAlign: 'center' },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    alert: { ...theme.type.body, color: theme.palette.invalid },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    badge: {
      width: theme.size.rowBadge,
      height: theme.size.rowBadge,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1 },
  });
