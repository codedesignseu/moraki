import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDevicePref } from '@/db/react';
import { NIGHT_MODES } from '@/domain/time/night';
import { useExport } from '@/privacy/useExport';
import { useAuth } from '@/sync/AuthProvider';
import { useAccountHousehold } from '@/sync/useAccountHousehold';
import {
  Button,
  Card,
  InlineError,
  ListGroup,
  ListRow,
  ScreenTitle,
  Segmented,
  TextButton,
  Toast,
} from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { AccountCard } from './AccountCard';
import { AdoptionCards } from './AdoptionCards';
import { GuardianCard } from './GuardianCard';
import { PrivacyCard } from './PrivacyCard';
import { RemindersCard } from './RemindersCard';
import { SettingsCard } from './SettingsCard';
import { SyncCard } from './SyncCard';
import { LANGUAGE_CHOICES, useLanguage } from './useLanguage';
import { useSentryTest } from './useSentryTest';

const REPORT_RANGES = [
  { range: '24h', copy: 'settings.report.range24h' },
  { range: '3d', copy: 'settings.report.range3d' },
  { range: '7d', copy: 'settings.report.range7d' },
] as const;

/**
 * Settings (SDD 7), in G's order (tabs/settings): warnings, Account, Sync,
 * Privacy, Reminders, Night mode, Language, Report, Data export, then rows
 * that open their own screens, and the version line.
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
  onGuardian = () => {},
  onTerms = () => {},
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
  /** Opens the guardian declaration (P0.1). */
  onGuardian?: () => void;
  /** Opens the Terms of Use (P0.9). */
  onTerms?: () => void;
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
  const sentryTest = useSentryTest();
  const signedIn = state.status === 'signedIn';

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
        <PrivacyCard onConsent={onConsent} onTerms={onTerms} />
        <GuardianCard onDeclare={onGuardian} />
        <RemindersCard />

        <SettingsCard
          icon="sleep"
          title={t('settings.nightMode.title')}
          testID="settings-night-mode"
        >
          <Segmented
            options={NIGHT_MODES.map((mode) => ({
              value: mode,
              label: t(`settings.nightMode.${mode}`),
            }))}
            value={nightMode}
            onChange={setNightMode}
            accessibilityLabel={t('settings.nightMode.title')}
          />
          <Text style={[theme.type.small, s.soft]}>{t(`settings.nightMode.${nightMode}Hint`)}</Text>
        </SettingsCard>

        <SettingsCard
          icon="tab-settings"
          title={t('settings.language.title')}
          testID="settings-language"
        >
          <Segmented
            options={LANGUAGE_CHOICES.map((choice) => ({
              value: choice,
              label: t(`settings.language.${choice}`),
            }))}
            value={language.choice}
            onChange={language.choose}
            accessibilityLabel={t('settings.language.title')}
          />
          <Text style={[theme.type.small, s.soft]}>
            {language.choice === 'device'
              ? t('settings.language.deviceHint', {
                  name: t(`settings.language.${language.language === 'el' ? 'el' : 'en'}`),
                })
              : t('settings.language.chosenHint')}
          </Text>
        </SettingsCard>

        <SettingsCard icon="share" title={t('settings.report.title')} testID="settings-report">
          <View>
            {REPORT_RANGES.map(({ range, copy }) => (
              <View key={range} style={s.ruled}>
                <ListRow grouped title={t(copy)} onPress={() => onReport(range)} />
              </View>
            ))}
            <ListRow grouped title={t('settings.report.call')} onPress={onCallScript} />
          </View>
        </SettingsCard>

        <SettingsCard icon="export" title={t('settings.data.title')} testID="settings-data">
          <Button
            label={t('settings.data.export')}
            variant="secondary"
            busy={exporting.busy}
            onPress={() => void exporting.exportAll()}
          />
          <Text style={[theme.type.small, s.soft]}>{t('settings.data.exportHint')}</Text>
          {exporting.problem && (
            <InlineError
              prefix={t('common.error')}
              message={t(`settings.data.exportProblem.${exporting.problem}`)}
              testID="export-problem"
            />
          )}
        </SettingsCard>

        <ListGroup testID="settings-help-rows">
          {signedIn ? (
            <ListRow
              grouped
              icon="link"
              title={t('settings.feedback.title')}
              detail={t('settings.feedback.body')}
              accessibilityLabel={t('settings.feedback.open')}
              onPress={onFeedback}
              testID="settings-feedback"
            />
          ) : (
            <ListRow
              grouped
              icon="link"
              title={t('settings.feedback.title')}
              detail={t('settings.feedback.needsAccount')}
              testID="settings-feedback"
            />
          )}
          <ListRow
            grouped
            icon="eu-shield"
            title={t('settings.about.title')}
            detail={t('about.disclaimer.title')}
            accessibilityLabel={t('settings.about.open')}
            onPress={onAbout}
            testID="settings-about"
          />
        </ListGroup>

        {signedIn && (
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
            <Text style={[theme.type.body, s.ink]}>{t('settings.sentryTest.confirm')}</Text>
            <Button label={t('settings.sentryTest.send')} onPress={sentryTest.confirm} />
            <TextButton
              label={t('settings.sentryTest.cancel')}
              align="center"
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

const styles = (theme: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    content: {
      paddingHorizontal: theme.spacing.screen,
      paddingBottom: theme.size.tabBarClearance,
      gap: theme.spacing.lg,
    },
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    ruled: { borderBottomWidth: theme.size.borderThin, borderBottomColor: theme.palette.line },
    version: {
      ...theme.type.small,
      color: theme.palette.textSoft,
      textAlign: 'center',
      paddingVertical: theme.spacing.sm,
    },
  });
