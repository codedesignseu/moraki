import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * What this app is, and what it is not (SDD 12.2, ADR-006). Moraki records
 * and adds up what caregivers type; it reads nothing into those numbers, and
 * it is not a medical device. The disclaimer is a screen of its own so it can
 * be read, rather than a line nobody sees at sign-up.
 */
export function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="about-disclaimer">
        <Text style={theme.text.heading}>{t('about.disclaimer.title')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.notMedical')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.noInterpretation')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.askSomeone')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.urgent')}</Text>
      </Card>
      <Card testID="about-what">
        <Text style={theme.text.heading}>{t('about.what.title')}</Text>
        <Text style={theme.text.body}>{t('about.what.records')}</Text>
        <Text style={theme.text.body}>{t('about.what.shares')}</Text>
        <Text style={s.muted}>{t('about.what.offline')}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
  });
