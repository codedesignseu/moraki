import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { INVITE_ROLES } from '@/sync/invites';
import { Button, Card, Segmented } from '@/ui/primitives';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useTheme, type Theme } from '@/ui/theme';

import { useInvite } from './useInvite';

/** Invite another caregiver: pick what they may do, create a code, share the link. */
export function InviteScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const invite = useInvite();

  if (!invite.canInvite) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Text style={theme.text.body}>{t('invite.ownerOnly')}</Text>
      </ScrollView>
    );
  }

  const shareMessage = invite.invite
    ? t('invite.shareMessage', { link: invite.invite.link, code: invite.invite.code })
    : '';

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="invite-role">
        <Text style={theme.type.tileTitle}>{t('invite.roleTitle')}</Text>
        <Segmented
          options={INVITE_ROLES.map((role) => ({ value: role, label: t(`invite.role.${role}`) }))}
          value={invite.role}
          onChange={invite.setRole}
          accessibilityLabel={t('invite.roleTitle')}
        />
        <Text style={s.muted}>{t(`invite.roleHint.${invite.role}`)}</Text>
        <Button
          label={t(invite.invite ? 'invite.createAnother' : 'invite.create')}
          onPress={invite.create}
          disabled={invite.busy}
        />
        {invite.problem && (
          <Text accessibilityRole="alert" style={s.alert}>
            {t(`invite.problem.${invite.problem}`)}
          </Text>
        )}
      </Card>

      {invite.invite && (
        <Card testID="invite-code">
          <Text style={theme.type.tileTitle}>{t('invite.codeTitle')}</Text>
          <Text
            accessibilityLabel={t('invite.codeLabel', { code: invite.invite.code })}
            style={s.code}
          >
            {invite.invite.code}
          </Text>
          <Text style={s.muted}>
            {t('invite.expires', {
              date: formatDateTime(
                invite.invite.expiresAt,
                deviceTimeZone(),
                dateLocale(i18n.language),
              ),
            })}
          </Text>
          <Button label={t('invite.share')} onPress={() => invite.share(shareMessage)} />
          <Text style={s.muted}>{t('invite.singleUse')}</Text>
        </Card>
      )}

      {invite.open.length > 0 && (
        <Card testID="invite-open">
          <Text style={theme.type.tileTitle}>{t('invite.openTitle')}</Text>
          {invite.open.map((row) => (
            <View key={row.code} style={s.row} testID={`invite-open-${row.code}`}>
              <Text style={theme.text.body}>
                {t(row.expired ? 'invite.openRowExpired' : 'invite.openRow', {
                  code: row.shown,
                  role: t(`invite.role.${row.role}`),
                  date: formatDateTime(row.expiresAt, deviceTimeZone(), dateLocale(i18n.language)),
                })}
              </Text>
              <Button
                label={t('invite.revoke')}
                variant="secondary"
                disabled={invite.busy}
                onPress={() => invite.revoke(row.code)}
              />
            </View>
          ))}
          <Text style={s.muted}>{t('invite.revokeHint')}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    alert: { ...theme.type.body, color: theme.palette.invalid },
    // Sage 20 invite card: the code large and letter-spaced, on the chip colour.
    code: {
      ...theme.type.title,
      letterSpacing: theme.spacing.xs,
      textAlign: 'center',
      backgroundColor: theme.palette.chip,
      borderRadius: theme.radius.card,
      paddingVertical: theme.spacing.md,
      overflow: 'hidden',
    },
    row: { gap: theme.spacing.xs },
  });
