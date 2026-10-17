import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { INVITE_ROLES } from '@/sync/invites';
import {
  Button,
  Card,
  FieldLabel,
  InlineError,
  Page,
  Segmented,
  TextButton,
} from '@/ui/primitives';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useTheme, type Theme } from '@/ui/theme';

import { useInvite } from './useInvite';

/**
 * Invite another caregiver (G account/invite): pick the role, create a code,
 * share the link; open codes below, each with Revoke. The code shows in two
 * groups of four; what is shared is the code and link as before.
 */
export function InviteScreen({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const invite = useInvite();
  const date = (at: number) => formatDateTime(at, deviceTimeZone(), dateLocale(i18n.language));
  const page = {
    title: t('invite.title'),
    kind: 'close',
    onBack: onClose,
    backLabel: t('common.close'),
  } as const;

  if (!invite.canInvite) {
    return (
      <Page {...page}>
        <Card>
          <Text style={s.body}>{t('invite.ownerOnly')}</Text>
        </Card>
      </Page>
    );
  }

  const shareMessage = invite.invite
    ? t('invite.shareMessage', { link: invite.invite.link, code: invite.invite.code })
    : '';

  return (
    <Page {...page}>
      <Card testID="invite-role">
        <FieldLabel label={t('invite.roleTitle')} />
        <Segmented
          options={INVITE_ROLES.map((role) => ({ value: role, label: t(`invite.role.${role}`) }))}
          value={invite.role}
          onChange={invite.setRole}
          accessibilityLabel={t('invite.roleTitle')}
        />
        <Text style={s.soft}>{t(`invite.roleHint.${invite.role}`)}</Text>
        <Button
          label={t(invite.invite ? 'invite.createAnother' : 'invite.create')}
          onPress={invite.create}
          busy={invite.busy}
        />
        {invite.problem ? (
          <InlineError message={t(`invite.problem.${invite.problem}`)} prefix={t('common.error')} />
        ) : null}
      </Card>

      {invite.invite && (
        <Card tone="feed" testID="invite-code">
          <FieldLabel label={t('invite.codeTitle')} />
          <Text
            accessibilityLabel={t('invite.codeLabel', { code: invite.invite.code })}
            style={s.code}
          >
            {invite.invite.shown}
          </Text>
          <Text style={s.detail}>
            {t('invite.expires', { date: date(invite.invite.expiresAt) })}
          </Text>
          <Button
            label={t('invite.share')}
            icon="share"
            variant="secondary"
            onPress={() => invite.share(shareMessage)}
          />
          <Text style={s.detail}>{t('invite.singleUse')}</Text>
        </Card>
      )}

      {invite.open.length > 0 && (
        <Card testID="invite-open">
          <Text style={s.title} accessibilityRole="header">
            {t('invite.openTitle')}
          </Text>
          {invite.open.map((row, index) => (
            <Fragment key={row.code}>
              {index > 0 ? <View style={s.rule} /> : null}
              <View style={s.row} testID={`invite-open-${row.code}`}>
                <View style={s.rowText}>
                  <Text style={s.rowCode}>{row.shown}</Text>
                  <Text style={s.rowDetail}>
                    {t(row.expired ? 'invite.openDetailExpired' : 'invite.openDetail', {
                      role: t(`invite.role.${row.role}`),
                      date: date(row.expiresAt),
                    })}
                  </Text>
                </View>
                <TextButton
                  label={t('invite.revoke')}
                  accessibilityLabel={t('invite.revokeLabel', { code: row.shown })}
                  tone="destructive"
                  disabled={invite.busy}
                  onPress={() => invite.revoke(row.code)}
                />
              </View>
            </Fragment>
          ))}
          <Text style={s.rowDetail}>{t('invite.revokeHint')}</Text>
        </Card>
      )}
    </Page>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    body: { ...theme.type.body, color: theme.palette.ink },
    soft: { ...theme.type.detail, color: theme.palette.textSoft },
    title: { ...theme.type.formTitle, color: theme.palette.ink },
    code: { ...theme.type.code, color: theme.palette.ink },
    detail: { ...theme.type.detail, color: theme.palette.onTileSoft },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.grid },
    rowText: { flex: 1 },
    rowCode: { ...theme.type.codeRow, color: theme.palette.ink },
    rowDetail: { ...theme.type.small, color: theme.palette.textSoft },
    rule: { height: theme.size.borderThin, backgroundColor: theme.palette.line },
  });
