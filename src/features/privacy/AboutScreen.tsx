import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Card } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * What this app is, and what it is not (SDD 12.2, ADR-006). Moraki records
 * and adds up what caregivers type; it reads nothing into those numbers, and
 * it is not a medical device. The disclaimer is a screen of its own so it can
 * be read, rather than a line nobody sees at sign-up.
 */
const SITE = 'https://moraki.app';
const CONTACT = 'info@codedesigns.eu';
const PAGES = ['privacy', 'terms', 'support'] as const;

/** The pages on moraki.app (P5-06), in Greek when the app is read in Greek. */
export function legalLink(page: (typeof PAGES)[number], language: string): string {
  return `${SITE}${language.startsWith('el') ? '/el' : ''}/${page}/`;
}

export function AboutScreen({ onOpenLink }: { onOpenLink: (url: string) => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card tone="feed" testID="about-disclaimer">
        <Text style={theme.type.tileTitle}>{t('about.disclaimer.title')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.notMedical')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.noInterpretation')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.askSomeone')}</Text>
        <Text style={theme.text.body}>{t('about.disclaimer.urgent')}</Text>
      </Card>
      <Card testID="about-what">
        <Text style={theme.type.tileTitle}>{t('about.what.title')}</Text>
        <Text style={theme.text.body}>{t('about.what.records')}</Text>
        <Text style={theme.text.body}>{t('about.what.shares')}</Text>
        <Text style={s.muted}>{t('about.what.offline')}</Text>
      </Card>
      <Card testID="about-legal">
        <Text style={theme.type.tileTitle}>{t('about.legal.title')}</Text>
        {PAGES.map((page) => (
          <Button
            key={page}
            label={t(`about.legal.${page}`)}
            variant="secondary"
            onPress={() => onOpenLink(legalLink(page, i18n.language))}
          />
        ))}
        <Text style={theme.text.body}>{t('about.legal.contact', { email: CONTACT })}</Text>
        <Button
          label={t('about.legal.email')}
          variant="secondary"
          onPress={() => onOpenLink(`mailto:${CONTACT}`)}
        />
      </Card>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    // By analogy with the 19 grouped cards.
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
  });
