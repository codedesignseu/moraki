import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';

import { useAuth } from '@/sync/AuthProvider';
import {
  FeedbackError,
  sendFeedback,
  type FeedbackContext,
  type FeedbackKind,
} from '@/sync/feedback';

export type FeedbackState = {
  /** Null until something goes wrong; a reason key otherwise. */
  problem: 'offline' | 'signed_out' | 'too_many' | 'unknown' | null;
  busy: boolean;
  sent: boolean;
  /** Resolves true only when the server took it, so the screen can say so. */
  send: (input: { kind: FeedbackKind; message: string }) => Promise<boolean>;
};

/**
 * Which build this is, which platform, and the language it is being read in.
 * Read at send time rather than kept, so it describes the phone as it is now.
 */
function context(): FeedbackContext {
  const platform = Platform.OS;
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    platform: platform === 'ios' || platform === 'android' ? platform : 'web',
    locale: getLocales()[0]?.languageTag ?? null,
  };
}

/**
 * Sending feedback from inside the app (P4-13). It needs an account, because
 * the row is the author's own and nobody else can read it; a phone with no
 * account is told that rather than left with a button that fails.
 */
export function useFeedback(): FeedbackState {
  const { auth, state } = useAuth();
  const [problem, setProblem] = useState<FeedbackState['problem']>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const userId = state.status === 'signedIn' ? state.user.id : null;

  const send = useCallback(
    async (input: { kind: FeedbackKind; message: string }): Promise<boolean> => {
      if (!auth || userId === null) {
        setProblem('signed_out');
        return false;
      }
      setProblem(null);
      setBusy(true);
      try {
        await sendFeedback(auth, userId, input, context());
        setSent(true);
        return true;
      } catch (thrown) {
        setProblem(thrown instanceof FeedbackError ? thrown.reason : 'unknown');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [auth, userId],
  );

  return { problem, busy, sent, send };
}
