import { readdirSync, readFileSync } from 'node:fs';

import { BABY_NAME_MAX } from '../babyName';
import { listActivities } from './index';

/**
 * The server checks entries and baby names with the app's own limits (P0.8).
 * These keep the two from drifting: a new activity type the server does not
 * know would have every entry of it refused as invalid.
 */
const migrations = readdirSync('supabase/migrations')
  .sort()
  .map((name) => readFileSync(`supabase/migrations/${name}`, 'utf8'))
  .join('\n');

/** The last definition wins, as it does when the migrations run in order. */
function last(pattern: RegExp): RegExpExecArray {
  const all = [...migrations.matchAll(pattern)];
  const found = all[all.length - 1];
  if (!found) throw new Error(`No match for ${pattern}`);
  return found;
}

describe('the server checks match the app (P0.8)', () => {
  it('knows every registered activity type, and no other', () => {
    const list = last(/constraint events_payload_valid check \(\s*type in \(([^)]*)\)/g)[1] ?? '';
    const server = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(server).toEqual(
      listActivities()
        .map((m) => m.type)
        .sort(),
    );
  });

  it('checks every registered type field by field', () => {
    const body = last(/function public\.event_payload_valid[\s\S]*?\$\$;/g)[0];
    for (const { type } of listActivities()) expect(body).toContain(`when '${type}' then`);
  });

  it('allows the same longest baby name', () => {
    const between = last(/babies_name_length\s+check \(char_length\(name\) between 1 and (\d+)\)/g);
    expect(Number(between[1])).toBe(BABY_NAME_MAX);
  });
});
