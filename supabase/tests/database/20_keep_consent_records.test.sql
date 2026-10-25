-- Legal update Q1: consent records outlive the account by
-- consent_record_retention() (3 years), pseudonymous, then a daily job
-- erases them.
--
-- User 1 deletes their account through delete_account. User 2 stays and
-- tries to read user 1's records. User 3 is deleted straight from auth.users
-- (the dashboard or admin API path).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'three@example.test');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.history(n int) returns text[] language sql security definer as $$
  select coalesce(array_agg(purpose || ':' || action order by id), '{}')
  from public.consent_events
  where user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
$$;
create function pg_temp.stamped(n int) returns bigint language sql security definer as $$
  select count(*) from public.consent_events
  where user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
    and account_deleted_at is not null
$$;

-- The shape -------------------------------------------------------------------
select has_column('public', 'consent_events', 'account_deleted_at', 'consent_events has account_deleted_at');
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.consent_events'::regclass and contype = 'f'),
  0, 'consent_events.user_id no longer references auth.users');
select is(public.consent_record_retention(), interval '3 years',
  'the retention period is 3 years, in one place');
select ok(
  (select count(*) = 1 from cron.job
   where jobname = 'purge-old-consent-records' and schedule = '47 3 * * *'),
  'the purge runs daily at 03:47 UTC');
select ok(not has_function_privilege('authenticated', 'public.purge_old_consent_records()', 'execute'),
  'a client cannot run the purge');
select ok(not has_function_privilege('anon', 'public.purge_old_consent_records()', 'execute'),
  'nor can anyone signed out');

-- Grant and withdraw behave as before ---------------------------------------
set local role authenticated;
select pg_temp.login(1);
select isnt(public.grant_consent('en'), null, 'grant_consent still records');
select isnt(public.withdraw_consent('en'), null, 'withdraw_consent still records');
select isnt(public.record_consent('terms', '2026-10-24', 'grant', null, 'en'), null,
  'record_consent still records');
select is(pg_temp.history(1), array['health_data:grant', 'health_data:withdraw', 'terms:grant'],
  'the history is appended as before');
select is((select count(*)::int from public.consent_events where account_deleted_at is null), 3,
  'a live account reads its own records');
select throws_ok($$update public.consent_events set account_deleted_at = now()$$,
  '42501', null, 'a client cannot stamp its own records as deleted');

select pg_temp.login(3);
select isnt(public.record_consent('terms', '2026-10-24', 'grant'), null, 'user 3 agrees to the Terms');

-- Deleting the account keeps the records, stamped --------------------------
select pg_temp.login(1);
select lives_ok($$select public.delete_account()$$, 'user 1 deletes their account');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000001'),
  0, 'the account is gone, and its email with it');
select is(pg_temp.history(1), array['health_data:grant', 'health_data:withdraw', 'terms:grant'],
  'its consent records stay, the grant and withdrawal history linked by the uuid');
select is(pg_temp.stamped(1), 3::bigint, 'each is stamped with when the account was deleted');
select is((select count(*)::int from public.consents where user_id = '00000000-0000-0000-0000-000000000001'),
  0, 'the current-state consents row still goes with the account');

delete from auth.users where id = '00000000-0000-0000-0000-000000000003';
select is(pg_temp.stamped(3), 1::bigint, 'deleting from auth.users directly stamps them too');

-- Nobody reads them through the API ----------------------------------------
set local role authenticated;
select pg_temp.login(2);
select is_empty($$select 1 from public.consent_events$$,
  'another user reads none of them');
select pg_temp.login(1);
select is_empty($$select 1 from public.consent_events$$,
  'nor does a token that outlived the deleted account');
select throws_ok($$select public.record_consent('terms', '2026-10-24', 'grant')$$,
  '42501', null, 'and that token cannot add records for the deleted account');
reset role;

-- The purge erases only what is past the period ----------------------------
-- A deleted account from long ago, one deleted just inside the period, and
-- one past it by a day. User 2 is still an account: never purged.
insert into public.consent_events
  (user_id, purpose, version, action, text_key, created_at, account_deleted_at)
values
  ('00000000-0000-0000-0000-000000000004', 'terms', '2022-01-01', 'grant', 'terms',
   now() - interval '5 years', now() - interval '4 years'),
  ('00000000-0000-0000-0000-000000000005', 'terms', '2023-01-01', 'grant', 'terms',
   now() - interval '4 years', now() - interval '3 years' - interval '1 day'),
  ('00000000-0000-0000-0000-000000000006', 'terms', '2023-01-01', 'grant', 'terms',
   now() - interval '4 years', now() - interval '3 years' + interval '1 day'),
  ('00000000-0000-0000-0000-000000000002', 'terms', '2020-01-01', 'grant', 'terms',
   now() - interval '6 years', null);

select is(public.purge_old_consent_records(), 2, 'the purge erases the two past 3 years');
select is(
  (select array_agg(right(user_id::text, 1) order by user_id)
   from public.consent_events),
  array['1', '1', '1', '2', '3', '6'],
  'and keeps the recent deletions and every live account''s records, however old');
select * from finish();
rollback;
