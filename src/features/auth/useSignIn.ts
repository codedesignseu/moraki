import { useEffect, useState } from 'react';

import { AuthError, type AuthFailure, type AuthUser } from '@/sync/auth';
import { useAuth } from '@/sync/AuthProvider';
import { readGoogleIosClientId, readGoogleWebClientId } from '@/sync/googleEnv';

import {
  SocialSignInCancelled,
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from './socialSignIn';

/**
 * Supabase sends a code of 6 to 10 digits, whichever the project is set to
 * (Auth settings, "Email OTP length"). The app takes whatever arrives rather
 * than insisting on one length and refusing a valid code.
 */
export const CODE_LENGTH = { min: 6, max: 10 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignInProblem = AuthFailure | 'invalid_email' | 'short_code';

/** Two steps: the email address, then the six-digit code sent to it. */
export function useSignIn(onDone: (user: AuthUser) => void) {
  const { auth } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((value) => active && setAppleAvailable(value));
    return () => {
      active = false;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (!auth) return;
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (error) {
      // Dismissing the native sheet isn't a failure to explain — same as
      // pressing "not now" anywhere else in the app.
      if (!(error instanceof SocialSignInCancelled)) {
        setProblem(error instanceof AuthError ? error.reason : 'unknown');
      }
    } finally {
      setBusy(false);
    }
  }

  const address = email.trim().toLowerCase();
  const googleWebClientId = readGoogleWebClientId();

  return {
    step,
    email,
    setEmail: (value: string) => {
      setEmail(value);
      setProblem(null);
    },
    code,
    setCode: (value: string) => {
      setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH.max));
      setProblem(null);
    },
    busy,
    problem,
    sendCode: () => {
      if (!EMAIL.test(address)) return setProblem('invalid_email');
      return run(async () => {
        await auth!.requestCode(address);
        setCode('');
        setStep('code');
      });
    },
    resendCode: () => run(() => auth!.requestCode(address)),
    verify: () => {
      if (code.length < CODE_LENGTH.min) return setProblem('short_code');
      return run(async () => {
        // The account that just signed in, handed on so the caller can decide
        // what comes next for it (P3-09's consent step).
        onDone(await auth!.verifyCode(address, code));
      });
    },
    changeEmail: () => {
      setStep('email');
      setCode('');
      setProblem(null);
    },
    appleAvailable,
    continueWithApple: () =>
      run(async () => {
        const { identityToken, nonce } = await signInWithApple();
        onDone(await auth!.signInWithIdToken('apple', identityToken, nonce));
      }),
    googleAvailable: googleWebClientId !== undefined,
    continueWithGoogle: () =>
      run(async () => {
        const idToken = await signInWithGoogle(googleWebClientId!, readGoogleIosClientId());
        onDone(await auth!.signInWithIdToken('google', idToken));
      }),
  };
}
