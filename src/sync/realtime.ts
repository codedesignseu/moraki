import type { RealtimeChannel } from '@supabase/supabase-js';

import type { Auth } from './auth';

/**
 * Listens for changes to one household's events (SDD 5.4).
 *
 * The message is only a ping: it says something changed, never what. The
 * engine pulls afterwards and takes the server's rows through the same path
 * as any other pull, so nothing here can decide what this phone stores.
 *
 * The subscription is also how the app notices the connection came back
 * (P2-F9). The socket reconnects itself, and every time the channel joins
 * again, `onConnected` fires: the engine drops its backoff and tries at once
 * rather than waiting out a five minute step.
 */
export function watchHousehold(
  auth: Auth,
  householdId: string,
  handlers: { onPing: () => void; onConnected: () => void },
): { close: () => void } {
  // Realtime checks row level security with the signed-in token, and the
  // client hands it over only when it notices the session for itself. Hand it
  // over here too: a subscription that registers without one is simply told
  // nothing, and says nothing about why.
  void auth.client.auth.getSession().then(({ data }) => {
    if (data.session) void auth.client.realtime.setAuth(data.session.access_token);
  });

  const channel: RealtimeChannel = auth.client
    .channel(`household:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: `household_id=eq.${householdId}`,
      },
      () => handlers.onPing(),
    )
    .subscribe((status) => {
      // Joined, or joined again after the connection dropped.
      if (status === 'SUBSCRIBED') handlers.onConnected();
    });

  return {
    close: () => {
      void auth.client.removeChannel(channel);
    },
  };
}

export type HouseholdWatch = ReturnType<typeof watchHousehold>;
