import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useDevicePref } from '@/db/react';
import { NIGHT_MODES } from '@/domain/time/night';
import { Card, Segmented } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * Settings (SDD 7). Night mode for now; reminders, caregivers, the report and
 * the rest join as their tasks land.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const [nightMode, setNightMode] = useDevicePref('nightMode');

  return (
    <ScrollView contentContainerStyle={s.content}>
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
  });
