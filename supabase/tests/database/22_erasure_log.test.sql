-- Legal update round 2, decision 2: every erased account and household is
-- logged (kind, id, time, reason; nothing else), for re-applying erasures
-- after a backup restore, readable by no client, and kept 35 days.
--
-- Household A: 1 owns it alone, deletes it.       -> household_deleted_by_owner
-- Household B: 2 alone, deletes their account.     -> household and account user_request
-- Household C: 3 alone, erased by erase_user.sql.  -> admin_request (both)
-- Household D: deleted from the dashboard.        -> admin_request
-- Household E: idle 30 months, warned 31 days ago, nobody to email: swept -> inactivity
-- Account 6: deleted from the dashboard.          -> admin_request
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, last_sign_in_at)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, n || '@example.test', now()
  from generate_series(1, 6) n;
insert into auth.users (id, email, last_sign_in_at) values
  ('00000000-0000-0000-0000-000000000007', null, now() - interval '30 months');
insert into public.households (id, name, created_by, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'B', '00000000-0000-0000-0000-000000000002', now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'C', '00000000-0000-0000-0000-000000000003', now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'D', '00000000-0000-0000-0000-000000000004', now()),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'E', '00000000-0000-0000-0000-000000000007',
   now() - interval '30 months');
insert into public.memberships (household_id, user_id, role, display_name, is_guardian, joined_at)
  select ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid,
         ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'owner', 'O' || n, true, now()
  from generate_series(1, 4) n;
insert into public.memberships (household_id, user_id, role, display_name, is_guardian, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007', 'owner', 'O7',
   true, now() - interval '30 months');
update public.households set inactivity_warned_at = now() - interval '31 days'
  where id = 'aaaaaaaa-0000-0000-0000-000000000005';
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.logged(kind text, n int, prefix text default 'aaaaaaaa') returns text language sql as $$
  select string_agg(reason, ',' order by id) from public.erasure_log
  where erasure_log.kind = logged.kind
    and subject_id = (prefix || '-0000-0000-0000-00000000000' || n)::uuid
$$;

-- Shape and access ------------------------------------------------------------
select columns_are('public', 'erasure_log', array['id', 'kind', 'subject_id', 'erased_at', 'reason'],
  'the log holds a kind, an id, a time and a reason, nothing else');
select ok((select relrowsecurity from pg_class where oid = 'public.erasure_log'::regclass),
  'row level security is on');
select is((select count(*)::int from pg_policies where tablename = 'erasure_log'), 0,
  'with no policy at all');
select ok(not has_table_privilege('authenticated', 'public.erasure_log', 'select')
  and not has_table_privilege('anon', 'public.erasure_log', 'select'),
  'nobody reads it through the API');
select ok(not has_table_privilege('authenticated', 'public.erasure_log', 'insert')
  and not has_table_privilege('authenticated', 'public.erasure_log', 'delete'),
  'nor writes or trims it');
select ok(not has_function_privilege('authenticated', 'public.purge_erasure_log()', 'execute'),
  'nor purges it');
select ok((select count(*)::int from cron.job where jobname = 'purge-erasure-log'
           and command = 'select public.purge_erasure_log()') = 1, 'the purge is scheduled once');
select ok((select count(distinct schedule)::int from cron.job) = (select count(*)::int from cron.job),
  'no two jobs share a time');

-- In the app ----------------------------------------------------------------------
set local role authenticated;
select pg_temp.login(1);
select lives_ok($$ select public.delete_household('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'the owner deletes household A');
select pg_temp.login(2);
select lives_ok($$ select public.delete_account() $$, '2 deletes their account');
select throws_ok($$ select * from public.erasure_log $$, '42501', null,
  'a signed-in user can''t read the log');
reset role;
select set_config('request.jwt.claims', '', true);

select is(pg_temp.logged('household', 1), 'household_deleted_by_owner', 'A: deleted by its owner');
select is(pg_temp.logged('household', 2), 'user_request', 'B, the household only 2 was in: their request');
select is(pg_temp.logged('account', 2, '00000000'), 'user_request', 'and 2''s account: their request');

-- By the controller ------------------------------------------------------------
-- erase_user.sql: says admin_request, then acts as the person.
select set_config('moraki.erasure_reason', 'admin_request', true);
select pg_temp.login(3);
select public.delete_account();
select set_config('request.jwt.claims', '', true);
select set_config('moraki.erasure_reason', '', true);
select is(pg_temp.logged('household', 3), 'admin_request', 'C, erased on request by email: admin_request');
select is(pg_temp.logged('account', 3, '00000000'), 'admin_request', 'and 3''s account too');

delete from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select is(pg_temp.logged('household', 4), 'admin_request', 'D, deleted from the dashboard: admin_request');
delete from auth.users where id = '00000000-0000-0000-0000-000000000006';
select is(pg_temp.logged('account', 6, '00000000'), 'admin_request', 'account 6, from the dashboard: admin_request');

-- By the inactivity sweep ------------------------------------------------------------
select is(public.sweep_inactive_households(), 1, 'the inactivity sweep deletes E');
select is(pg_temp.logged('household', 5), 'inactivity', 'logged as inactivity');

-- Retention ------------------------------------------------------------------------
insert into public.erasure_log (kind, subject_id, erased_at, reason) values
  ('account', gen_random_uuid(), now() - interval '36 days', 'user_request'),
  ('account', gen_random_uuid(), now() - interval '34 days', 'user_request');
select is(public.purge_erasure_log(), 1, 'the purge removes only the row older than 35 days');
select is((select count(*)::int from public.erasure_log), 9, 'and leaves the rest');

select * from finish();
rollback;
