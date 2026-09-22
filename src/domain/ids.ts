import { v7 } from 'uuid';

/**
 * A new client-generated id (SDD 2): UUID v7, so ids sort by creation time and
 * can be made offline without coordination. `random16` must return 16
 * cryptographically secure random bytes; the caller supplies it so this stays
 * pure (rule 3) and never touches a global crypto object.
 */
export function newId(now: number, random16: () => Uint8Array): string {
  return v7({ msecs: now, rng: random16 });
}
