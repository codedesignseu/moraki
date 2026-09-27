-- P2-F7: nothing limited guesses at an invite code. `accept_invite` is
-- security definer and each call is its own transaction (as PostgREST runs
-- it), so a wrong guess can never durably log itself from inside
-- accept_invite — any uncaught exception rolls back everything that call
-- did, a failed log row included. Proven directly against this database
-- (`supabase/migrations/20260927120000_invite_rate_limit.sql`'s header)
-- before this design was chosen over one that tried to fight that.
--
-- record_invite_attempt() is the thing that survives every call, because it
-- never raises AFTER writing — it raises instead of writing, or it writes and
-- returns. accept_invite then refuses outright unless a very recent attempt
-- exists, which is what forces every guess, wrong or right, through a call
-- that durably counts it.
--
-- invite_attempts has RLS on with no policies, same as this project's other
-- internal tables — nothing reads it directly, only the two security
-- definer functions below, which bypass RLS as their owner. So every
-- verification query here does what 06_invites.test.sql already does for
-- `invites.used_by`: `reset role` to look at the row itself, then back to
-- `authenticated` to keep acting as the caller.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'guesser@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'other@example.test');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;

create function pg_temp.attempts(n int) returns int language sql as $$
  select count(*)::int from public.invite_attempts
  where user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
$$;

create function pg_temp.fresh_attempts(n int) returns int language sql as $$
  select count(*)::int from public.invite_attempts
  where user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
    and attempted_at > now() - interval '1 hour'
$$;

set local role authenticated;

-- Signed out ----------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.record_invite_attempt()$$, '42501', null,
  'without a user, recording an attempt is refused');

-- accept_invite refuses with no recent attempt on record ---------------------
select pg_temp.login(1);
select throws_ok($$select public.accept_invite('ZZZZZZZZ', 'Guesser')$$, 'MKI05', null,
  'a guess with no record_invite_attempt() call first is refused, before the code is even looked up');

-- A recorded attempt lets the real lookup run --------------------------------
select lives_ok($$select public.record_invite_attempt()$$, 'recording an attempt itself always succeeds');
select throws_ok($$select public.accept_invite('ZZZZZZZZ', 'Guesser')$$, 'MKI01', null,
  'with a fresh attempt on record, the guess reaches the real check and is refused for being wrong, not MKI05');

-- The count survives every failed guess ---------------------------------------
reset role;
select is(pg_temp.attempts(1), 1,
  'the attempt is on record despite the accept_invite call that followed it failing');
set local role authenticated;
select pg_temp.login(1);

-- The limit itself -------------------------------------------------------------
-- Already recorded one above; 19 more reaches the limit of 20 exactly.
select is((select count(*)::int from (
    select public.record_invite_attempt() from generate_series(1, 19)) _), 19,
  'the next 19 attempts are all recorded (limit is 20/hour)');
reset role;
select is(pg_temp.attempts(1), 20, 'twenty attempts are now on record');
set local role authenticated;
select pg_temp.login(1);
select throws_ok($$select public.record_invite_attempt()$$, 'MKI05', null,
  'the 21st attempt in the hour is refused outright');
reset role;
select is(pg_temp.attempts(1), 20,
  'and adds nothing -- a caller already over the limit cannot grow the count further');
set local role authenticated;
select pg_temp.login(1);

-- Being over the limit does not immediately touch accept_invite: the 20
-- attempts just recorded are themselves still fresh (well within the 5
-- second window), so accept_invite honours them for a few seconds after the
-- cap is hit — a handful of guesses' grace, not a hole in the hourly cap,
-- and it closes for good once those attempts age past 5 seconds (next).

-- Staleness: an old attempt does not keep authorising new guesses forever ----
-- A minute is still well inside the hourly window (it counts toward the cap),
-- but too old for accept_invite's own 5 second freshness check. This is the
-- state a blocked caller is actually in a few seconds after hitting the cap:
-- record_invite_attempt refuses (already proven above) and now so does
-- accept_invite, durably, until the hour rolls over.
reset role;
update public.invite_attempts set attempted_at = now() - interval '1 minute'
  where user_id = '00000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.login(1);
select throws_ok($$select public.accept_invite('ZZZZZZZZ', 'Guesser')$$, 'MKI05', null,
  'a minute-old attempt is too stale for accept_invite to honour (the freshness window is 5 seconds)');

-- The window slides: attempts outside the hour stop counting toward the cap --
reset role;
update public.invite_attempts set attempted_at = now() - interval '2 hours'
  where user_id = '00000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.login(1);
select lives_ok($$select public.record_invite_attempt()$$,
  'once the old attempts are outside the hour, the limit is not stuck at refused forever');
reset role;
select is(pg_temp.fresh_attempts(1), 1,
  'the hour now holds only the one fresh attempt, not the twenty from before');
set local role authenticated;

-- One user's guessing never touches another's limit -------------------------
select pg_temp.login(2);
select lives_ok($$select public.record_invite_attempt()$$,
  'a second user starts with their own, unrelated count');
reset role;
select is(pg_temp.attempts(2), 1, 'and it is exactly theirs');
set local role authenticated;

-- Nothing here is reachable from the API directly -----------------------------
reset role;
select ok(
  (select relrowsecurity from pg_class where oid = 'public.invite_attempts'::regclass),
  'invite_attempts has row level security on, with no policies -- default deny, like the project''s other tables');

select * from finish();
rollback;
