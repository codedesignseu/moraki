-- Owner decision 2026-10-26: deleted entries are logged in erasure_log too,
-- and the log is emailed every night, one UTC day at a time, through RPCs
-- only the service role may call.
--
-- e1 deleted in the app (push_events), with a phone time 3 days ago -> logged
-- e2 deleted by the server (deleted_at set directly)                -> logged
-- e3 written already deleted                                        -> logged
-- e4 live, edited                                                    -> not logged
-- e2 purged afterwards                                               -> not logged again
-- household B deleted, with its entry e5                             -> household only
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'other@example.test');
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'B', '00000000-0000-0000-0000-000000000002');
insert into public.memberships (household_id, user_id, role, display_name, is_guardian) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'O1', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'owner', 'O2', true);
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Nia', now());
insert into public.events (id, household_id, baby_id, type, occurred_at, payload,
    created_by, updated_by, client_created_at)
select ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid,
  ('aaaaaaaa-0000-0000-0000-00000000000' || h)::uuid, ('bbbbbbbb-0000-0000-0000-00000000000' || h)::uuid,
  'feed_bottle', now() - interval '4 days', '{"ml": 90, "milk": "formula"}',
  ('00000000-0000-0000-0000-00000000000' || h)::uuid, ('00000000-0000-0000-0000-00000000000' || h)::uuid,
  now() - interval '4 days'
from (values (1, 1), (2, 1), (4, 1), (5, 2)) as t(n, h);

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.entry_log(n int) returns table (rows int, erased_at timestamptz, reason text,
  logged_now boolean) language sql as $$
  select count(*)::int, max(erased_at), max(reason), bool_and(logged_at = now()) from public.erasure_log
  where kind = 'entry' and subject_id = ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid
$$;
create function pg_temp.day(offset_days int) returns date language sql as $$
  select (now() at time zone 'UTC')::date + offset_days
$$;

-- Shape -----------------------------------------------------------------------
select columns_are('public', 'erasure_log',
  array['id', 'kind', 'subject_id', 'erased_at', 'reason', 'logged_at'],
  'the log holds a kind, an id, two times and a reason, nothing else');
select columns_are('public', 'erasure_journal', array['singleton', 'sent_until', 'claimed_at'],
  'the journal state is a time and a lease, no address and no id');
select is((select count(*)::int from public.erasure_journal), 1, 'the journal has one row');

-- Entry deletions are logged --------------------------------------------------------
set local role authenticated;
select pg_temp.login(1);
select is((select status::text from public.push_events(jsonb_build_array(jsonb_build_object(
    'op', 'delete', 'body', jsonb_build_object('id', 'eeeeeeee-0000-0000-0000-000000000001',
      'deleted_at', now() - interval '3 days'))))), 'applied', 'the owner deletes e1 from the app');
select throws_ok($$ select * from public.erasure_log $$, '42501', null, 'and can''t read the log');
select throws_ok($$ select * from public.erasure_journal $$, '42501', null, 'nor the journal');
reset role;
select set_config('request.jwt.claims', '', true);

select results_eq($$ select * from pg_temp.entry_log(1) $$,
  $$ values (1, now() - interval '3 days', 'user_request', true) $$,
  'e1 is logged once: erased_at is the phone''s deleted_at, logged_at the server''s time');
insert into public.events (id, household_id, baby_id, type, occurred_at, payload,
    created_by, updated_by, client_created_at, deleted_at) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'feed_bottle', now() - interval '1 day',
   '{"ml": 60, "milk": "formula"}', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 hour');
select is((select rows from pg_temp.entry_log(3)), 1, 'e3, written already deleted, is logged');

update public.events set deleted_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000002';
select results_eq($$ select rows, reason from pg_temp.entry_log(2) $$, $$ values (1, 'user_request') $$,
  'e2, deleted on the server, is logged');
update public.events set payload = '{"ml": 100, "milk": "formula"}'
  where id = 'eeeeeeee-0000-0000-0000-000000000004';
select is((select rows from pg_temp.entry_log(4)), 0, 'editing a live entry logs nothing');
update public.events set deleted_at = now() - interval '31 days'
  where id = 'eeeeeeee-0000-0000-0000-000000000002';
select is(public.purge_deleted_event_content(), 1, 'e2 is purged');
select is((select rows from pg_temp.entry_log(2)), 1, 'and changing or purging a deleted entry logs nothing more');

delete from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is((select rows from pg_temp.entry_log(5)), 0,
  'a household''s entries going with it are not logged one by one');
select is((select count(*)::int from public.erasure_log
           where kind = 'household' and subject_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 1,
  'the household is');
select throws_ok($$ insert into public.erasure_log (kind, subject_id, reason)
                    values ('baby', gen_random_uuid(), 'user_request') $$, '23514', null,
  'no other kind');

-- Who may run the journal ----------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.claim_erasure_journal(integer)', 'execute')
  and not has_function_privilege('anon', 'public.claim_erasure_journal(integer)', 'execute'),
  'nobody claims the journal through the API');
select ok(not has_function_privilege('authenticated', 'public.erasure_journal_rows(date)', 'execute')
  and not has_function_privilege('anon', 'public.erasure_journal_rows(date)', 'execute'),
  'nor reads its rows');
select ok(not has_function_privilege('authenticated', 'public.finish_erasure_journal_day(date)', 'execute')
  and not has_function_privilege('authenticated', 'public.release_erasure_journal()', 'execute')
  and not has_function_privilege('authenticated', 'public.request_erasure_journal()', 'execute'),
  'nor finishes, releases or requests it');
select ok(has_function_privilege('service_role', 'public.claim_erasure_journal(integer)', 'execute')
  and has_function_privilege('service_role', 'public.erasure_journal_rows(date)', 'execute')
  and has_function_privilege('service_role', 'public.finish_erasure_journal_day(date)', 'execute')
  and has_function_privilege('service_role', 'public.release_erasure_journal()', 'execute'),
  'the Edge Function, with the service role, does');
select ok((select count(*)::int from cron.job where jobname = 'send-erasure-journal'
           and schedule = '5 4 * * *' and command = 'select public.request_erasure_journal()') = 1,
  'it is requested once a night, at 04:05');
select ok((select count(distinct schedule)::int from cron.job) = (select count(*)::int from cron.job),
  'no two jobs share a time');
select is(public.request_erasure_journal(), null, 'without the Vault secrets, the request does nothing');

-- One email per whole UTC day, in order, once ------------------------------------------
delete from public.erasure_log;
insert into public.erasure_log (kind, subject_id, erased_at, reason, logged_at) values
  ('account', 'dddddddd-0000-0000-0000-000000000001', now(), 'user_request',
   pg_temp.day(-3)::timestamp at time zone 'UTC'),
  ('entry', 'dddddddd-0000-0000-0000-000000000002', now() - interval '9 days', 'user_request',
   (pg_temp.day(-3)::timestamp at time zone 'UTC') + interval '23 hours 59 minutes'),
  ('household', 'dddddddd-0000-0000-0000-000000000003', now(), 'inactivity',
   (pg_temp.day(-1)::timestamp at time zone 'UTC') + interval '3 hours'),
  ('entry', 'dddddddd-0000-0000-0000-000000000004', now(), 'user_request',
   pg_temp.day(0)::timestamp at time zone 'UTC');
update public.erasure_journal set sent_until = pg_temp.day(-3)::timestamp at time zone 'UTC';

select results_eq($$ select * from public.claim_erasure_journal() $$,
  $$ values (pg_temp.day(-3), 2), (pg_temp.day(-2), 0), (pg_temp.day(-1), 1) $$,
  'a run gets every whole day not yet sent, with its count; not today');
select is((select count(*)::int from public.claim_erasure_journal()), 0,
  'a second run while the first holds the journal gets nothing');
select results_eq($$ select * from public.erasure_journal_rows(pg_temp.day(-3)) $$,
  $$ values ('account', 'dddddddd-0000-0000-0000-000000000001'::uuid, now(), 'user_request'),
            ('entry', 'dddddddd-0000-0000-0000-000000000002'::uuid, now() - interval '9 days', 'user_request') $$,
  'a day''s rows: kind, id, erased_at and reason, by when they were logged');
select is((select count(*)::int from public.erasure_journal_rows(pg_temp.day(0))), 0,
  'today''s rows are not handed out before the day is over');
select is(public.finish_erasure_journal_day(pg_temp.day(-2)), false, 'days are finished in order only');
select is(public.finish_erasure_journal_day(pg_temp.day(-3)), true, 'the first day is finished');
select is(public.finish_erasure_journal_day(pg_temp.day(-3)), false, 'and finishing it again moves nothing');
select is(public.finish_erasure_journal_day(pg_temp.day(0)), false, 'today can''t be finished');

select public.release_erasure_journal();
select results_eq($$ select journal_day from public.claim_erasure_journal() $$,
  $$ values (pg_temp.day(-2)), (pg_temp.day(-1)) $$,
  'after a release the next run starts at the first day not sent');
select public.finish_erasure_journal_day(pg_temp.day(-2));
select public.finish_erasure_journal_day(pg_temp.day(-1));
select public.release_erasure_journal();
select is((select count(*)::int from public.claim_erasure_journal()), 0,
  'once every whole day is sent, nothing is due');

select * from finish();
rollback;
