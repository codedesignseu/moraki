import type { Auth } from './auth';

/** What a message is about. The three the form offers, and the table's check. */
export const FEEDBACK_KINDS = ['problem', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** The table's check, repeated here so the form can count down to it. */
export const MESSAGE_MAX = 2000;

/**
 * What travels with the message: which build, which platform, which language.
 * Enough to reproduce a bug and nothing more — no event, no name, no address,
 * and nothing about the baby (CLAUDE.md rule 8).
 */
export type FeedbackContext = {
  appVersion: string | null;
  platform: 'ios' | 'android' | 'web' | null;
  locale: string | null;
};

export class FeedbackError extends Error {
  override name = 'FeedbackError';
  constructor(readonly reason: 'offline' | 'signed_out' | 'too_many' | 'unknown') {
    super(`Feedback failed: ${reason}`);
  }
}

/**
 * Sends one message to this project's own `feedback` table (P4-13). No support
 * desk, no analytics service, no third party at all: it goes to the same EU
 * database as everything else, where only its author can read it back.
 */
export async function sendFeedback(
  auth: Auth,
  userId: string,
  input: { kind: FeedbackKind; message: string },
  context: FeedbackContext,
): Promise<void> {
  const { error } = await auth.client.from('feedback').insert({
    user_id: userId,
    kind: input.kind,
    message: input.message.trim(),
    app_version: context.appVersion,
    platform: context.platform,
    locale: context.locale,
  });
  if (!error) return;
  // postgrest-js reports a failed request with the fetch error's message and no code.
  if (!error.code && /fetch|network/i.test(error.message ?? '')) {
    throw new FeedbackError('offline');
  }
  // The hourly ceiling in the migration's trigger.
  if (error.code === '54000') throw new FeedbackError('too_many');
  if (error.code === '42501') throw new FeedbackError('signed_out');
  throw new FeedbackError('unknown');
}
