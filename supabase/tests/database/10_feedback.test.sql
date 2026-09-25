-- P4-13: in-app feedback (CLAUDE.md rule 11 — an RLS change ships with these).
--
-- User 1 and user 2 are two accounts with no household between them: feedback
-- is from a person, not from a household, and this proves it needs neither.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.test');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.send(n int, message text) returns text language sql as $$
  select format($f$insert into public.feedback (user_id, kind, message)
    values ('00000000-0000-0000-0000-00000000000%s', 'problem', %L)$f$, n, message)
$$;

-- The shape of the table ---------------------------------------------------
select has_table('public', 'feedback', 'feedback exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.feedback'::regclass),
  'with row level security on');
-- No household and no baby, so nothing here can be joined to health data.
select hasnt_column('public', 'feedback', 'household_id', 'feedback has no household');
select hasnt_column('public', 'feedback', 'baby_id', 'feedback has no baby');

-- Anon ---------------------------------------------------------------------
set local role anon;
select throws_ok(pg_temp.send(1, 'from nobody'), '42501',
  'new row violates row-level security policy for table "feedback"',
  'a stranger cannot leave feedback');
select is((select count(*)::int from public.feedback), 0, 'and reads none either');

-- Signed in ----------------------------------------------------------------
set local role authenticated;
select pg_temp.login(1);
select lives_ok(pg_temp.send(1, 'the sleep timer stopped'), 'a signed-in account may write its own');
select lives_ok(
  $$insert into public.feedback (user_id, kind, message, app_version, platform, locale)
    values ('00000000-0000-0000-0000-000000000001', 'idea', 'a widget would help',
            '1.0.0 (42)', 'android', 'en')$$,
  'with the build details that help fix it');
select throws_ok(pg_temp.send(2, 'not mine'), '42501',
  'new row violates row-level security policy for table "feedback"',
  'but not feedback in someone else name');

-- What the checks refuse ---------------------------------------------------
select throws_ok(pg_temp.send(1, '   '), '23514', null, 'a message of spaces is not a message');
select throws_ok(pg_temp.send(1, repeat('x', 2001)), '23514', null, 'and 2,001 characters is too long');
select throws_ok(
  $$insert into public.feedback (user_id, kind, message)
    values ('00000000-0000-0000-0000-000000000001', 'rant', 'hello')$$,
  '23514', null, 'kind is one of the three the form offers');
select throws_ok(
  $$insert into public.feedback (user_id, kind, message, platform)
    values ('00000000-0000-0000-0000-000000000001', 'other', 'hello', 'blackberry')$$,
  '23514', null, 'platform is one the app runs on');

-- Reading back -------------------------------------------------------------
select is((select count(*)::int from public.feedback), 2, 'an account reads what it sent');
select pg_temp.login(2);
select is((select count(*)::int from public.feedback), 0, 'and nothing anyone else sent');

-- Sent is sent: no policy allows changing or withdrawing it -----------------
select pg_temp.login(1);
select is((select count(*)::int from public.feedback where message = 'edited'), 0,
  'nothing is edited yet');
select lives_ok($$update public.feedback set message = 'edited'$$,
  'an update touches no row rather than raising');
select is((select count(*)::int from public.feedback where message = 'edited'), 0,
  'because no policy allows editing a sent message');
select lives_ok($$delete from public.feedback$$, 'a delete touches no row either');
select is((select count(*)::int from public.feedback), 2, 'so both messages are still there');

-- The hourly ceiling -------------------------------------------------------
reset role;
insert into public.feedback (user_id, kind, message)
select '00000000-0000-0000-0000-000000000001', 'other', 'filler ' || n
from generate_series(3, 10) as n;
set local role authenticated;
select pg_temp.login(1);
select throws_ok(pg_temp.send(1, 'the eleventh in an hour'), '54000', 'feedback rate limit',
  'the eleventh message in an hour is refused');

select * from finish();
rollback;
