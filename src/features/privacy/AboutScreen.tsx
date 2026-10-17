import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/icons';
import { Card, ListGroup, ListRow, Page } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * What this app is, and what it is not (SDD 12.2, ADR-006). Moraki records
 * and adds up what caregivers type; it reads nothing into those numbers, and
 * it is not a medical device. The disclaimer is a screen of its own so it can
 * be read, rather than a line nobody sees at sign-up.
 */
const SITE = 'https://moraki.app';
const CONTACT = 'hello@moraki.app';
const PAGES = ['privacy', 'terms', 'support'] as const;

/** The pages on moraki.app (P5-06), in Greek when the app is read in Greek. */
export function legalLink(page: (typeof PAGES)[number], language: string): string {
  return `${SITE}${language.startsWith('el') ? '/el' : ''}/${page}/`;
}

const ROW_ICONS = {
  privacy: 'private',
  terms: 'link',
  support: 'link',
} as const satisfies Record<(typeof PAGES)[number], IconName>;

/**
 * G account/about: the disclaimer card with its alert badge, "What it does",
 * then the pages and the email as › rows. Every paragraph is the app's; G's
 * version line is left out (G3).
 */
export function AboutScreen({
  onOpenLink,
  onBack,
}: {
  onOpenLink: (url: string) => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Page title={t('about.title')} onBack={onBack} backLabel={t('common.back')}>
      <Card
        tone="warning"
        icon="alert"
        message={t('about.disclaimer.title')}
        testID="about-disclaimer"
      >
        <Text style={s.body}>{t('about.disclaimer.notMedical')}</Text>
        <Text style={s.body}>{t('about.disclaimer.noInterpretation')}</Text>
        <Text style={s.body}>{t('about.disclaimer.askSomeone')}</Text>
        <Text style={s.body}>{t('about.disclaimer.urgent')}</Text>
      </Card>
      <Card testID="about-what">
        <Text style={s.title} accessibilityRole="header">
          {t('about.what.title')}
        </Text>
        <Text style={s.soft}>{t('about.what.records')}</Text>
        <Text style={s.soft}>{t('about.what.shares')}</Text>
        <Text style={s.soft}>{t('about.what.offline')}</Text>
      </Card>
      <View style={s.legal} testID="about-legal">
        <Text style={s.title} accessibilityRole="header">
          {t('about.legal.title')}
        </Text>
        <ListGroup>
          {PAGES.map((page) => (
            <ListRow
              key={page}
              grouped
              icon={ROW_ICONS[page]}
              title={t(`about.legal.${page}`)}
              onPress={() => onOpenLink(legalLink(page, i18n.language))}
            />
          ))}
          <ListRow
            grouped
            icon="mail"
            title={t('about.legal.email')}
            onPress={() => onOpenLink(`mailto:${CONTACT}`)}
          />
        </ListGroup>
        <Text style={s.soft}>{t('about.legal.contact', { email: CONTACT })}</Text>
      </View>
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    title: { ...theme.type.formTitle, color: theme.palette.ink },
    body: { ...theme.type.body, color: theme.palette.ink },
    soft: { ...theme.type.body, color: theme.palette.textSoft },
    legal: { gap: theme.spacing.md },
  });
