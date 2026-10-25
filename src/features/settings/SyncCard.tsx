import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/domain/time/formatClock';
import { useAuth } from '@/sync/AuthProvider';
import { useSyncStatus } from '@/sync/SyncProvider';
import { useSyncErrors } from '@/sync/useSyncErrors';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Icon } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { SettingsCard } from './SettingsCard';

const OP_LABEL = {
  insert: 'settings.sync.op.insert',
  patch: 'settings.sync.op.patch',
  delete: 'settings.sync.op.delete',
} as const;

const REASON_LABEL: Record<string, 'settings.sync.reason.forbidden'> = {
  forbidden: 'settings.sync.reason.forbidden',
  invalid: 'settings.sync.reason.invalid' as 'settings.sync.reason.forbidden',
  not_found: 'settings.sync.reason.not_found' as 'settings.sync.reason.forbidden',
};

/**
 * G Sync card (tabs/settings): "All sent" with a check, or how many entries
 * wait, and when this phone last sent; then any entries the server refused.
 * Signed in only (G3: no sync card when signed out).
 */
export function SyncCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { state } = useAuth();
  const sync = useSyncStatus();
  const syncErrors = useSyncErrors();

  if (state.status !== 'signedIn') return null;
  return (
    <SettingsCard icon="time" title={t('settings.sync.title')} testID="settings-sync">
      {sync.blocked === 'no_consent' ? (
        <Text style={[theme.type.detail, s.soft]}>{t('settings.sync.noConsent')}</Text>
      ) : sync.blocked === 'frozen' ? (
        <Text style={[theme.type.detail, s.soft]}>{t('settings.sync.frozen')}</Text>
      ) : sync.blocked === 'no_agreement' ? (
        <Text style={[theme.type.detail, s.soft]}>{t('settings.sync.noAgreement')}</Text>
      ) : sync.blocked === 'no_terms' ? (
        <Text style={[theme.type.detail, s.soft]}>{t('settings.sync.noTerms')}</Text>
      ) : sync.blocked === 'no_guardian' ? (
        <Text style={[theme.type.detail, s.soft]}>{t('settings.sync.noGuardian')}</Text>
      ) : sync.blocked === 'not_linked' ? (
        <Text style={[theme.type.detail, s.soft]}>{t('settings.sync.notShared')}</Text>
      ) : (
        <View style={s.status}>
          <View style={s.pending}>
            {sync.pending === 0 && <Icon name="check" color={theme.palette.ink} />}
            <Text style={[theme.type.figureRow, s.ink]} testID="settings-sync-pending">
              {sync.pending === 0
                ? t('settings.sync.allSent')
                : t('settings.sync.waiting', { count: sync.pending })}
            </Text>
          </View>
          <Text style={[theme.type.detail, s.soft]}>
            {sync.lastPushAt === null
              ? t('settings.sync.neverSent')
              : t('settings.sync.lastSent', {
                  time: formatClock(sync.lastPushAt, deviceTimeZone()),
                })}
          </Text>
        </View>
      )}
      {syncErrors.length > 0 && (
        <View style={s.errors} testID="settings-sync-errors">
          <Text style={[theme.type.detailBold, s.ink]}>{t('settings.sync.refused')}</Text>
          {syncErrors.map((row) => (
            <Text key={row.id} style={[theme.type.detail, s.ink]}>
              {t('settings.sync.refusedRow', {
                what: t(OP_LABEL[row.op]),
                reason: t(REASON_LABEL[row.reason] ?? 'settings.sync.reason.unknown'),
              })}
            </Text>
          ))}
        </View>
      )}
    </SettingsCard>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    status: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: theme.spacing.md,
    },
    pending: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 1 },
    errors: { gap: theme.spacing.xs },
  });
