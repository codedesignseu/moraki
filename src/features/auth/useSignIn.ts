import { useState } from 'react';

import { AuthError, type AuthFailure } from '@/sync/auth';
import { useAuth } from '@/sync/AuthProvider';

export const CODE_LENGTH = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignInProblem = AuthFailure | 'invalid_email' | 'short_code';

/** Two steps: the email address, then the six-digit code sent to it. */
export function useSignIn(onDone: () => void) {
  const { auth } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);

  async function run(action: () => Promise<void>) {
    if (!auth) return;
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(error instanceof AuthError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  const address = email.trim().toLowerCase();

  return {
    step,
    email,
    setEmail: (value: string) => {
      setEmail(value);
      setProblem(null);
    },
    code,
    setCode: (value: string) => {
      setCode(value.replace(/\D/g, ''));
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
      if (code.length !== CODE_LENGTH) return setProblem('short_code');
      return run(async () => {
        await auth!.verifyCode(address, code);
        onDone();
      });
    },
    changeEmail: () => {
      setStep('email');
      setCode('');
      setProblem(null);
    },
  };
}
