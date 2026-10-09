import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/icons';
import { Button, Card, Icon } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useConsent } from '@/privacy/useConsent';

const PARAGRAPHS: readonly {
  key: 'consent.what' | 'consent.where' | 'consent.who' | 'consent.rights';
  icon: IconName;
  colour: 'feed' | 'sleep' | 'diaper' | 'pump';
}[] = [
  { key: 'consent.what', icon: 'health', colour: 'feed' },
  { key: 'consent.where', icon: 'eu-shield', colour: 'diaper' },
  { key: 'consent.who', icon: 'private', colour: 'sleep' },
  { key: 'consent.rights', icon: 'export', colour: 'pump' },
];

/**
 * Consent on its own screen, asked of every caregiver (SDD 12). It is not
 * bundled with terms, there is no pre-ticked box, and the way to say no is
 * the same size as the way to say yes: closing the screen.
 */
export function ConsentScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { granted, problem, busy, agree, withdraw } = useConsent();

  return (
    <ScrollView contentContainerStyle={s.content}>
      {/* Sage 04: the existing paragraphs, each beside an icon. Text unchanged. */}
      <View style={s.what} testID="consent-what">
        <Text style={theme.type.title} accessibilityRole="header">
          {t('consent.title')}
        </Text>
        {PARAGRAPHS.map(({ key, icon, colour }) => (
          <View key={key} style={[s.row, { backgroundColor: theme.palette[colour] }]}>
            <View style={s.badge}>
              <Icon name={icon} color={theme.palette.onTile} />
            </View>
            <Text style={[theme.type.body, s.rowText]}>{t(key)}</Text>
          </View>
        ))}
        <Text style={s.muted}>{t('consent.version', { version: t('consent.versionName') })}</Text>
      </View>

      {problem && (
        <Text style={s.problem} accessibilityRole="alert" testID="consent-problem">
          {t(`consent.problem.${problem}`)}
        </Text>
      )}

      {granted ? (
        <Card testID="consent-granted">
          <Text style={theme.text.body}>{t('consent.granted')}</Text>
          <Button
            label={t('consent.withdraw')}
            variant="secondary"
            disabled={busy}
            onPress={() => void withdraw()}
          />
          <Text style={s.muted}>{t('consent.withdrawHint')}</Text>
        </Card>
      ) : (
        <Button
          label={t(busy ? 'consent.working' : 'consent.agree')}
          disabled={busy}
          // Only leaves the screen once the server has it: a failure has to
          // stay visible, or someone thinks they agreed when they didn't.
          onPress={() => void agree().then((saved) => saved && onDone())}
        />
      )}
      <Button label={t('consent.notNow')} variant="secondary" onPress={onDone} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    what: { gap: theme.spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.card,
    },
    badge: {
      width: theme.size.rowBadge,
      height: theme.size.rowBadge,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.palette.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, color: theme.palette.onTile },
    muted: { ...theme.type.small, color: theme.palette.textSoft },
    problem: { ...theme.type.body, color: theme.palette.invalid },
  });
