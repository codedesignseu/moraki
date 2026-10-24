import { useEffect, useRef } from 'react';

import { useCaregiverAgreement } from '@/privacy/useCaregiverAgreement';
import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { useTerms } from '@/privacy/useTerms';

/**
 * When the server says this account may not see its household yet (P0.2),
 * opens the screen for what is missing, once per app open: the caregiver
 * agreement for a member who isn't the baby's parent or guardian, or
 * health-data consent for a guardian. Draws nothing. The pull keeps the
 * answer up to date (SyncProvider); until it is `granted`, this phone keeps
 * what it has and neither reads nor sends.
 */
export function AccessGate({
  onNeedsAgreement,
  onNeedsConsent,
}: {
  onNeedsAgreement: () => void;
  onNeedsConsent: () => void;
}) {
  const { access } = useCaregiverAgreement();
  // One screen at a time: the Terms, then an owner's declaration, first.
  const { agreed: termsAgreed } = useTerms();
  const guardian = useGuardianDeclaration();
  const declarationFirst = guardian.owner && guardian.status === 'missing';
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || !termsAgreed || declarationFirst) return;
    if (access === 'needs_agreement') {
      shown.current = true;
      onNeedsAgreement();
    } else if (access === 'needs_consent') {
      shown.current = true;
      onNeedsConsent();
    }
  }, [access, termsAgreed, declarationFirst, onNeedsAgreement, onNeedsConsent]);

  return null;
}
