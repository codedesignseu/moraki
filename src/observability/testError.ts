import * as Sentry from '@sentry/react-native';

/**
 * A test error a tester sends on purpose, from a hidden action in Settings, to
 * check on a store build that crash reports arrive with file names and line
 * numbers (P4-F4). Its message is fixed: nothing from the phone goes in it,
 * and it still passes through `scrubEvent` like any other event (rule 8).
 */
export class SentryTestError extends Error {
  override name = 'SentryTestError';
}

export const TEST_ERROR_MESSAGE = 'Moraki Sentry test error, sent on purpose from Settings';

/** `off`: this build has no DSN, so crash reporting never started. */
export type TestErrorOutcome = 'sent' | 'off';

export async function sendTestError(): Promise<TestErrorOutcome> {
  if (!Sentry.getClient()) return 'off';
  Sentry.captureException(new SentryTestError(TEST_ERROR_MESSAGE));
  return 'sent';
}
