import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useAdoption } from '@/sync/useAdoption';
import { Button, Card } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * The two G warning cards at the top of Settings (tabs/settings; NOTES.md:
 * feed tint by day, #3A3322 at night, with an icon): entries from another
 * account, and entries logged before this phone joined a household.
 */
export function AdoptionCards() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const adoption = useAdoption();

  return (
    <>
      {adoption.otherAccount && (
        <Card
          tone="warning"
          icon="alert"
          message={t('settings.otherAccount.title')}
          testID="settings-other-account"
        >
          <Text style={[theme.type.detail, s.ink]}>
            {t('settings.otherAccount.body', { name: adoption.babyName })}
          </Text>
          <Button
            label={t('settings.otherAccount.clear')}
            variant="secondary"
            onPress={adoption.clearPhone}
          />
        </Card>
      )}
      {adoption.question === 'ask' && (
        <Card
          tone="warning"
          icon="time"
          message={t('settings.localEntries.title')}
          testID="settings-local-entries"
        >
          <Text style={[theme.type.detail, s.ink]}>
            {t('settings.localEntries.body', {
              count: adoption.entries,
              name: adoption.babyName,
            })}
          </Text>
          <Button
            label={t('settings.localEntries.move')}
            variant="secondary"
            onPress={adoption.move}
          />
          <Button
            label={t('settings.localEntries.keep')}
            variant="secondary"
            onPress={adoption.keepForNow}
          />
          <Text style={[theme.type.small, s.soft]}>{t('settings.localEntries.hint')}</Text>
        </Card>
      )}
    </>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
  });
