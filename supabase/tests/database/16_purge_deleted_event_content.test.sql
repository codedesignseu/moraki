-- P0.6: a deleted entry's content is purged 30 days after it was deleted,
-- and the empty tombstone can never be changed or brought back.
--   e1 deleted 31 days ago -> purged
--   e2 deleted 29 days ago -> kept as it is, for now
--   e3 live, written 60 days ago -> kept
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'carer@example.test');
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ella', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Maria'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Nik');
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now());

insert into public.events (id, household_id, baby_id, type, occurred_at, ended_at, payload, group_id,
    created_by, updated_by, client_created_at, deleted_at)
select ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid, 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', 'feed_bottle', now() - interval '60 days',
  now() - interval '60 days' + interval '20 minutes', '{"ml": 90, "milk": "formula"}',
  'cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002', now() - interval '60 days', deleted
from (values (1, now() - interval '31 days'), (2, now() - interval '29 days'), (3, null::timestamptz))
  as t(n, deleted);

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.push(op jsonb) returns table (status text, reason text)
language sql as $$ select status::text, reason from public.push_events(jsonb_build_array(op)) $$;
create temp table before_purge as select id, seq, deleted_at from public.events;
grant select on before_purge to authenticated;

select has_function('public', 'purge_deleted_event_content', 'the purge exists');
select ok(
  (select count(*)::int from cron.job where jobname = 'purge-deleted-event-content'
     and command = 'select public.purge_deleted_event_content()') = 1,
  'the purge is scheduled once, not just callable by hand');
select ok(not has_function_privilege('authenticated', 'public.purge_deleted_event_content()', 'execute'),
  'nothing but the schedule may run it');

-- The purge -------------------------------------------------------------------
select is(public.purge_deleted_event_content(), 1, 'one entry is past its 30 days');
select results_eq(
  $$select type, payload, ended_at, group_id, occurred_at = deleted_at, purged_at is not null,
      created_by, deleted_at = (select deleted_at from before_purge b where b.id = e.id)
    from public.events e where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('feed_bottle', '{}'::jsonb, null::timestamptz, null::uuid, true, true,
    '00000000-0000-0000-0000-000000000002'::uuid, true)$$,
  'its content is gone, its time is the delete time, and the tombstone keeps what sync needs');
select ok(
  (select e.seq > b.seq from public.events e join before_purge b using (id)
   where e.id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'it takes a new seq, so every phone pulls the empty tombstone');
select results_eq(
  $$select id, payload, ended_at is not null, purged_at from public.events
    where id <> 'eeeeeeee-0000-0000-0000-000000000001' order by id$$,
  $$values ('eeeeeeee-0000-0000-0000-000000000002'::uuid, '{"ml": 90, "milk": "formula"}'::jsonb, true, null::timestamptz),
           ('eeeeeeee-0000-0000-0000-000000000003'::uuid, '{"ml": 90, "milk": "formula"}'::jsonb, true, null::timestamptz)$$,
  'an entry deleted 29 days ago and a live one keep their content');
select ok(
  (select bool_and(e.seq = b.seq) from public.events e join before_purge b using (id)
   where e.id <> 'eeeeeeee-0000-0000-0000-000000000001'),
  'and are not touched at all');

create temp table after_first as select id, seq from public.events;
select is(public.purge_deleted_event_content(), 0, 'a second run finds nothing');
select ok(
  (select bool_and(e.seq = a.seq) from public.events e join after_first a using (id)),
  'and writes nothing: no seq moves');

-- The tombstone wins ----------------------------------------------------------
set local role authenticated;
select pg_temp.login(2);

select results_eq(
  $$select * from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "payload":{"ml":120}}}'::jsonb)$$,
  $$values ('ignored', 'deleted')$$, 'an offline edit to a purged entry is ignored');
select results_eq(
  $$select * from pg_temp.push(jsonb_build_object('op', 'insert', 'body', jsonb_build_object(
    'id', 'eeeeeeee-0000-0000-0000-000000000001', 'household_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'baby_id', 'bbbbbbbb-0000-0000-0000-000000000001', 'type', 'feed_bottle',
    'occurred_at', 1793620800000::bigint, 'payload', '{"ml": 90, "milk": "formula"}'::jsonb,
    'created_by', '00000000-0000-0000-0000-000000000002', 'updated_by', '00000000-0000-0000-0000-000000000002',
    'client_created_at', 1793620800000::bigint)))$$,
  $$values ('ignored', 'deleted')$$, 'so is a late retry of its insert');
select results_eq(
  $$select * from pg_temp.push('{"op":"delete","body":{"id":"eeeeeeee-0000-0000-0000-000000000001"}}'::jsonb)$$,
  $$values ('ignored', 'deleted')$$, 'and a second delete');
select is((select payload from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '{}'::jsonb, 'the tombstone is still empty');

select throws_ok(
  $$update public.events set deleted_at = null where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'a writer can''t bring a purged entry back by updating the table');
select throws_ok(
  $$update public.events set payload = '{"ml": 90}' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'or write content into it');
select throws_ok(
  $$update public.events set deleted_at = null where id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  '23514', null, 'or bring back an entry deleted but not yet purged');
select throws_ok(
  $$update public.events set purged_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000003'$$,
  '23514', null, 'a client can''t mark an entry purged');
select throws_ok(
  $$insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by,
      updated_by, client_created_at, deleted_at, purged_at)
    values ('eeeeeeee-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '{}', '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000002', now(), now(), now())$$,
  '23514', null, 'or insert one already marked purged');
select lives_ok(
  $$update public.events set payload = '{"ml": 100, "milk": "formula"}'
    where id = 'eeeeeeee-0000-0000-0000-000000000003'$$,
  'a live entry still takes an edit');

reset role;
select throws_ok(
  $$update public.events set payload = '{"ml": 90}' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'not even the server can change a purged row');
select throws_ok(
  $$update public.events set purged_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  '23514', null, 'a row marked purged must be empty (the shape check)');

-- A purge is not use (sweep_inactive_households) -------------------------------
-- Household 2: everything 30 months old, its one entry deleted then too.
insert into auth.users (id, email, last_sign_in_at) values
  ('00000000-0000-0000-0000-000000000003', 'idle@example.test', now() - interval '30 months');
insert into public.households (id, name, created_by, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Idle', '00000000-0000-0000-0000-000000000003',
   now() - interval '30 months');
insert into public.memberships (household_id, user_id, role, display_name, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'owner', 'Idle',
   now() - interval '30 months');
insert into public.babies (id, household_id, name, born_at, updated_at) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'b',
   now() - interval '30 months', now() - interval '30 months');
insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by, updated_by,
    client_created_at, deleted_at)
  values ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000002', 'diaper', now() - interval '30 months', '{"kind": "wet"}',
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
    now() - interval '30 months', now() - interval '30 months');
alter table public.events disable trigger events_stamp_seq;
update public.events set server_updated_at = now() - interval '30 months'
  where id = 'eeeeeeee-0000-0000-0000-000000000005';
alter table public.events enable trigger events_stamp_seq;

select is(public.purge_deleted_event_content(), 1, 'its old deleted entry is purged today');
select is((select server_updated_at from public.events where id = 'eeeeeeee-0000-0000-0000-000000000005'),
  now(), 'which stamps the row as written today');
select is(public.sweep_inactive_households(), 1, 'yet the household is still swept as unused');
select is((select count(*)::int from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1, 'and the household in use is not');

select * from finish();
rollback;
