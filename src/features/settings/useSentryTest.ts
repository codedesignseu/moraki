import { useCallback, useEffect, useState } from 'react';

import { sendTestError, type TestErrorOutcome } from '@/observability/testError';

/** Taps on the version number that open the hidden action. */
export const VERSION_TAPS = 7;
/** How long the result stays on screen. */
export const RESULT_MS = 4000;

/**
 * The hidden "send a test error to Sentry" action (P4-F4's device check):
 * seven taps on the version number, then a confirm, then a toast saying
 * whether it was sent.
 */
export function useSentryTest(send: () => Promise<TestErrorOutcome> = sendTestError) {
  const [taps, setTaps] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<TestErrorOutcome | null>(null);

  useEffect(() => {
    if (result === null) return;
    const timer = setTimeout(() => setResult(null), RESULT_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const confirm = useCallback(async () => {
    setConfirming(false);
    setResult(await send());
  }, [send]);

  return {
    tapVersion: () => {
      const next = taps + 1;
      setTaps(next < VERSION_TAPS ? next : 0);
      if (next >= VERSION_TAPS) setConfirming(true);
    },
    confirming,
    confirm: () => void confirm(),
    cancel: () => setConfirming(false),
    result,
    dismiss: () => setResult(null),
  };
}
