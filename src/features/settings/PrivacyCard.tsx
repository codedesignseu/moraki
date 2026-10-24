import { useTranslation } from 'react-i18next';

import { useCaregiverAgreement } from '@/privacy/useCaregiverAgreement';
import { useConsent } from '@/privacy/useConsent';
import { useAuth } from '@/sync/AuthProvider';
import { TextButton } from '@/ui/primitives';

import { SettingsCard, ValueRow } from './SettingsCard';

/**
 * G Privacy card (tabs/settings): whether health data processing is agreed,
 * and "Review consent", which opens the consent screen. Signed in only, and
 * no date, version or Withdraw here (G3). Consent is the parent's or
 * guardian's (P0.2): anyone else in a household sees their caregiver
 * agreement here instead.
 */
export function PrivacyCard({
  onConsent,
  onAgreement = () => {},
  onTerms = () => {},
}: {
  onConsent: () => void;
  /** Opens the caregiver agreement (P0.2). */
  onAgreement?: () => void;
  /** Opens the Terms of Use, to read and agree to (P0.9). */
  onTerms?: () => void;
}) {
  const { t } = useTranslation();
  const { state } = useAuth();
  const { granted } = useConsent();
  const agreement = useCaregiverAgreement();

  if (state.status !== 'signedIn') return null;
  const value = agreement.forThisAccount
    ? t(agreement.accepted ? 'settings.privacy.accepted' : 'settings.privacy.notAccepted')
    : t(granted ? 'settings.privacy.agreed' : 'settings.privacy.notAgreed');
  return (
    <SettingsCard icon="private" title={t('settings.privacy.title')} testID="settings-privacy">
      {agreement.forThisAccount ? (
        <>
          <ValueRow
            label={t('settings.privacy.agreement')}
            value={value}
            accessibilityLabel={t('settings.privacy.agreementValue', { value })}
          />
          <TextButton label={t('settings.privacy.readAgreement')} onPress={onAgreement} />
        </>
      ) : (
        <>
          <ValueRow
            label={t('settings.privacy.consent')}
            value={value}
            accessibilityLabel={t('settings.privacy.consentValue', { value })}
          />
          <TextButton label={t('settings.privacy.review')} onPress={onConsent} />
        </>
      )}
      <TextButton label={t('settings.privacy.terms')} onPress={onTerms} />
    </SettingsCard>
  );
}
