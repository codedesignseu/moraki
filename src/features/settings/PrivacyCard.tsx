import { useTranslation } from 'react-i18next';

import { useConsent } from '@/privacy/useConsent';
import { useAuth } from '@/sync/AuthProvider';
import { TextButton } from '@/ui/primitives';

import { SettingsCard, ValueRow } from './SettingsCard';

/**
 * G Privacy card (tabs/settings): whether health data processing is agreed,
 * and "Review consent", which opens the consent screen. Signed in only, and
 * no date, version or Withdraw here (G3).
 */
export function PrivacyCard({ onConsent }: { onConsent: () => void }) {
  const { t } = useTranslation();
  const { state } = useAuth();
  const { granted } = useConsent();

  if (state.status !== 'signedIn') return null;
  const value = t(granted ? 'settings.privacy.agreed' : 'settings.privacy.notAgreed');
  return (
    <SettingsCard icon="private" title={t('settings.privacy.title')} testID="settings-privacy">
      <ValueRow
        label={t('settings.privacy.consent')}
        value={value}
        accessibilityLabel={t('settings.privacy.consentValue', { value })}
      />
      <TextButton label={t('settings.privacy.review')} onPress={onConsent} />
    </SettingsCard>
  );
}
