import { useEffect, useRef } from 'react';

import { useCaregiverAgreement } from '@/privacy/useCaregiverAgreement';
import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { useTerms } from '@/privacy/useTerms';

/**
 * When the server says this account may not see its household (P0.2, P0.3),
 * opens the screen for it: the caregiver agreement for a member who isn't
 * the baby's parent or guardian, or health-data consent for a guardian,
 * each when the app first finds it missing; and the household paused, each
 * time it becomes so. A guardian who has just withdrawn isn't asked straight
 * back. Draws nothing. The pull keeps the answer up to date (SyncProvider);
 * until it is `granted`, this phone keeps what it has and neither reads nor
 * sends.
 */
export function AccessGate({
  onNeedsAgreement,
  onNeedsConsent,
  onFrozen = () => {},
}: {
  onNeedsAgreement: () => void;
  onNeedsConsent: () => void;
  onFrozen?: () => void;
}) {
  const { access } = useCaregiverAgreement();
  // One screen at a time: the Terms, then an owner's declaration, first.
  const { agreed: termsAgreed } = useTerms();
  const guardian = useGuardianDeclaration();
  const declarationFirst = guardian.owner && guardian.status === 'missing';
  // The last answer acted on, this app open.
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!termsAgreed || declarationFirst || access === 'unknown') return;
    const previous = seen.current;
    if (previous === access) return;
    seen.current = access;
    if (access === 'frozen') onFrozen();
    else if (previous !== null) return;
    else if (access === 'needs_agreement') onNeedsAgreement();
    else if (access === 'needs_consent') onNeedsConsent();
  }, [access, termsAgreed, declarationFirst, onNeedsAgreement, onNeedsConsent, onFrozen]);

  return null;
}
