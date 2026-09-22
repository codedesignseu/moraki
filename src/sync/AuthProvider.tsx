import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createAuth, type Auth, type AuthUser } from './auth';
import { sessionStore } from './sessionStore';
import { readSupabaseEnv } from './supabaseEnv';

export type AuthState =
  /** No Supabase settings in this build: sign in isn't offered. */
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: AuthUser };

const AuthContext = createContext<{ auth: Auth | null; state: AuthState }>({
  auth: null,
  state: { status: 'unavailable' },
});

/**
 * The app's auth, or null when the build has no Supabase settings. The app
 * works without them (SDD 8: everything but sign in and invites is offline),
 * so a missing setting only hides sign in.
 */
export function createAppAuth(): Auth | null {
  try {
    return createAuth(readSupabaseEnv(), sessionStore);
  } catch {
    return null;
  }
}

/** Who is signed in on this device, kept current, with token refresh only in the foreground. */
export function AuthProvider({ auth, children }: { auth: Auth | null; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    auth ? { status: 'loading' } : { status: 'unavailable' },
  );

  useEffect(() => {
    if (!auth) return;
    let active = true;
    const show = (user: AuthUser | null) =>
      active && setState(user ? { status: 'signedIn', user } : { status: 'signedOut' });
    void auth.currentUser().then(show);
    const unsubscribe = auth.onChange(show);
    auth.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (next) =>
      auth.setForeground(next === 'active'),
    );
    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
      auth.setForeground(false);
    };
  }, [auth]);

  return <AuthContext.Provider value={{ auth, state }}>{children}</AuthContext.Provider>;
}

export function useAuth(): { auth: Auth | null; state: AuthState } {
  return useContext(AuthContext);
}
