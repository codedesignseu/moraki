import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useRemindersState } from '@/notifications/RemindersProvider';
import { INTERVAL_MIN, SECOND_MIN, useReminderSettings } from '@/sync/useReminderSettings';
import { Segmented, Stepper } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { SettingsCard } from './SettingsCard';

/**
 * G Reminders card (tabs/settings): "Feed reminder every" over the stepper,
 * a rule, then the second reminder. The app keeps its on/off choice and the
 * permission hint above them, and shows the household's values read-only to
 * anyone who isn't the owner.
 */
export function RemindersCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const reminders = useRemindersState();
  const { settings, canChange, sharedWithHousehold, setIntervalMin, setSecondReminderMin } =
    useReminderSettings();

  return (
    <SettingsCard icon="reminder" title={t('settings.reminders.title')} testID="settings-reminders">
      <View style={s.field}>
        <Text style={[theme.type.small, s.soft]}>{t('settings.reminders.toggle')}</Text>
        <Segmented
          options={[
            { value: 'on', label: t('settings.reminders.on') },
            { value: 'off', label: t('settings.reminders.off') },
          ]}
          value={reminders.enabled ? 'on' : 'off'}
          onChange={(choice) => void reminders.setEnabled(choice === 'on')}
          accessibilityLabel={t('settings.reminders.toggle')}
        />
        <Text style={[theme.type.small, s.soft]}>
          {reminders.permission === 'denied'
            ? t('settings.reminders.denied')
            : t('settings.reminders.hint')}
        </Text>
      </View>
      <View style={s.divider} />

      <View style={s.field}>
        <Text style={[theme.type.small, s.soft]}>{t('settings.reminders.every')}</Text>
        {canChange ? (
          <Stepper
            value={settings.intervalMin}
            onChange={setIntervalMin}
            step={INTERVAL_MIN.step}
            min={INTERVAL_MIN.min}
            max={INTERVAL_MIN.max}
            unit={t('settings.reminders.minutes')}
            size="compact"
            accessibilityLabel={t('settings.reminders.interval')}
          />
        ) : (
          <Text style={[theme.type.figureRow, s.ink]}>
            {t('settings.reminders.everyMinutes', { count: settings.intervalMin })}
          </Text>
        )}
      </View>
      <View style={s.divider} />

      <View style={s.field}>
        <Text style={[theme.type.small, s.soft]}>{t('settings.reminders.second')}</Text>
        {canChange ? (
          <>
            <Segmented
              options={[
                { value: 'off', label: t('settings.reminders.secondOff') },
                { value: 'on', label: t('settings.reminders.secondOn') },
              ]}
              value={settings.secondReminderMin === null ? 'off' : 'on'}
              onChange={(choice) => setSecondReminderMin(choice === 'off' ? null : SECOND_MIN.min)}
              accessibilityLabel={t('settings.reminders.second')}
            />
            {settings.secondReminderMin !== null && (
              <Stepper
                value={settings.secondReminderMin}
                onChange={setSecondReminderMin}
                step={SECOND_MIN.step}
                min={SECOND_MIN.min}
                max={SECOND_MIN.max}
                unit={t('settings.reminders.minutes')}
                size="compact"
                accessibilityLabel={t('settings.reminders.secondAfter')}
              />
            )}
          </>
        ) : (
          <Text style={[theme.type.figureRow, s.ink]}>
            {settings.secondReminderMin === null
              ? t('settings.reminders.secondOff')
              : t('settings.reminders.everyMinutes', { count: settings.secondReminderMin })}
          </Text>
        )}
      </View>
      <Text style={[theme.type.small, s.soft]}>
        {t(
          sharedWithHousehold
            ? 'settings.reminders.forEveryone'
            : canChange
              ? 'settings.reminders.forThisPhone'
              : 'settings.reminders.ownerSets',
        )}
      </Text>
    </SettingsCard>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    field: { gap: theme.spacing.sm },
    divider: { height: theme.size.borderThin, backgroundColor: theme.palette.line },
  });
