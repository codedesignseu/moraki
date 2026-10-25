import { useEffect, useRef } from 'react';

import { useDevicePref } from '@/db/react';
import { CONSENT_VERSION } from '@/domain/consent/consent';
import { useCaregiverAgreement } from '@/privacy/useCaregiverAgreement';
import { useConsent } from '@/privacy/useConsent';
import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { useTerms } from '@/privacy/useTerms';

/**
 * When the consent text has a new version and this account's agreement to
 * the one before still counts (its 90-day grace), offers the new text once
 * per version on this phone, at the next app open. "Not now" is an answer:
 * it isn't offered again for that version, and everything keeps working
 * until the grace ends. After that the server says `needs_consent`, and
 * AccessGate asks again. Draws nothing.
 */
export function ConsentUpdateGate({ onAsk }: { onAsk: () => void }) {
  const { standing } = useConsent();
  const [seen, setSeen] = useDevicePref('consentPromptSeen');
  const { forThisAccount: notGuardian } = useCaregiverAgreement();
  // One screen at a time: the Terms, then an owner's declaration, first.
  const { agreed: termsAgreed } = useTerms();
  const guardian = useGuardianDeclaration();
  const declarationFirst = guardian.owner && guardian.status === 'missing';
  const shown = useRef(false);
  const ask =
    standing === 'grace' &&
    !notGuardian &&
    termsAgreed &&
    !declarationFirst &&
    seen !== CONSENT_VERSION;

  useEffect(() => {
    if (!ask || shown.current) return;
    shown.current = true;
    setSeen(CONSENT_VERSION);
    onAsk();
  }, [ask, setSeen, onAsk]);

  return null;
}
