-- P2-07: push_events (SDD 5.2). Household one has user 1 owner, user 2
-- caregiver, user 3 viewer; user 4 owns household two.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'carer@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'viewer@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'other@example.test');
-- P3-09: writing an event needs consent for the version in force.
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ella', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Leo', '00000000-0000-0000-0000-000000000004');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Maria'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Nik'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'viewer', 'Yiayia'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'owner', 'Stranger');
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Leo', now());

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
-- An insert op as the client writes it: epoch milliseconds, server column names.
create function pg_temp.insert_op(event_id text, author int default 2, payload jsonb default '{"ml": 90, "milk": "formula"}',
    household text default 'aaaaaaaa-0000-0000-0000-000000000001',
    baby text default 'bbbbbbbb-0000-0000-0000-000000000001') returns jsonb
language sql as $$
  select jsonb_build_object('op', 'insert', 'body', jsonb_build_object(
    'id', event_id, 'household_id', household, 'baby_id', baby, 'type', 'feed_bottle',
    'occurred_at', 1793620800000::bigint, 'ended_at', null, 'payload', payload, 'group_id', null,
    'created_by', ('00000000-0000-0000-0000-00000000000' || author),
    'updated_by', ('00000000-0000-0000-0000-00000000000' || author),
    'client_created_at', 1793620800000::bigint))
$$;
create function pg_temp.push(op jsonb) returns table (id uuid, op text, status text, reason text)
language sql as $$ select id, op, status::text, reason from public.push_events(jsonb_build_array(op)) $$;
create function pg_temp.seq_of(event text) returns bigint language sql as $$
  select seq from public.events where id = event::uuid
$$;
create function pg_temp.payload_of(event text) returns jsonb language sql as $$
  select payload from public.events where id = event::uuid
$$;

select ok(not has_function_privilege('anon', 'public.push_events(jsonb)', 'execute'),
  'anon can''t push');
select ok(has_function_privilege('authenticated', 'public.push_events(jsonb)', 'execute'),
  'signed-in users can');
select is((select prosecdef from pg_proc where proname = 'push_events'), false,
  'it runs as the caller, so RLS and the column locks still apply');

set local role authenticated;
select pg_temp.login(2);

-- Idempotent insert ---------------------------------------------------------
select results_eq(
  format($$select id, op, status, reason from pg_temp.push(%L::jsonb)$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000001')),
  $$values ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'insert', 'applied', null::text)$$,
  'an insert is applied');
select results_eq(
  $$select type, payload, occurred_at, created_by, updated_by from public.events
    where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('feed_bottle', '{"ml": 90, "milk": "formula"}'::jsonb,
    to_timestamp(1793620800)::timestamptz, '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid)$$,
  'the event is stored, with epoch milliseconds read as a time');
create temp table first_seq as select pg_temp.seq_of('eeeeeeee-0000-0000-0000-000000000001') as seq;
select isnt((select seq from first_seq), null, 'and the server gave it a seq (P2-01''s trigger)');

select results_eq(
  format($$select status, reason from pg_temp.push(%L::jsonb)$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000001')),
  $$values ('ignored', 'duplicate')$$, 'the same insert again is ignored');
select is((select count(*)::int from public.events), 1, 'and makes no second event');
select is(pg_temp.seq_of('eeeeeeee-0000-0000-0000-000000000001'), (select seq from first_seq),
  'and doesn''t move it in the pull order');

-- Per-field patch -----------------------------------------------------------
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "payload":{"ml":120}}}'::jsonb)$$,
  $$values ('applied', null::text)$$, 'a patch is applied');
select is(pg_temp.payload_of('eeeeeeee-0000-0000-0000-000000000001'), '{"ml": 120, "milk": "formula"}'::jsonb,
  'it merges the fields sent and leaves the rest alone');
select cmp_ok(pg_temp.seq_of('eeeeeeee-0000-0000-0000-000000000001'), '>', (select seq from first_seq),
  'and the patch takes a new seq, so a pull sees it');
select is((select occurred_at from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  to_timestamp(1793620800)::timestamptz, 'a patch that sends no time leaves the time alone');

select results_eq(
  $$select status from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "occurred_at":"2026-10-28T09:00:00Z","ended_at":1793624400000}}'::jsonb)$$,
  $$values ('applied')$$, 'a patch can move the time, as an ISO string or epoch milliseconds');
select results_eq(
  $$select occurred_at, ended_at from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('2026-10-28T09:00:00Z'::timestamptz, to_timestamp(1793624400)::timestamptz)$$,
  'both times are stored');

-- unset: a cleared field is removed, not set to null (P1-F13)
select pg_temp.push(pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000002', 2,
  '{"note": "warm", "temp_c": 37.8}'::jsonb));
select results_eq(
  $$select status from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000002",
    "payload":{"note":"better"},"unset":["temp_c"]}}'::jsonb)$$,
  $$values ('applied')$$, 'a patch can unset a field');
select is(pg_temp.payload_of('eeeeeeee-0000-0000-0000-000000000002'), '{"note": "better"}'::jsonb,
  'the unset key is gone, and the merged key is there');
select ok(not (pg_temp.payload_of('eeeeeeee-0000-0000-0000-000000000002') ? 'temp_c'),
  'the key is removed, not left as null');

-- Columns that can never change are refused, not partly applied.
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "household_id":"aaaaaaaa-0000-0000-0000-000000000002"}}'::jsonb)$$,
  $$values ('rejected', 'invalid')$$, 'a patch that tries to move the event is refused');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "type":"sleep"}}'::jsonb)$$,
  $$values ('rejected', 'invalid')$$, 'so is one that tries to change its type');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "seq":1}}'::jsonb)$$,
  $$values ('rejected', 'invalid')$$, 'and one that tries to pick its own seq');
select is((select household_id from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'the event is untouched by refused patches');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-00000000ffff",
    "payload":{"ml":10}}}'::jsonb)$$,
  $$values ('rejected', 'not_found')$$, 'a patch for an event that isn''t here is refused');

-- The author of a change is the caller, whatever the op says.
select results_eq(
  $$select status from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "updated_by":"00000000-0000-0000-0000-000000000001","payload":{"milk":"breast"}}}'::jsonb)$$,
  $$values ('applied')$$, 'a patch carrying someone else''s updated_by is still applied');
select is((select updated_by from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'and the caller is recorded as the editor, not whoever the op named');

-- Delete wins ---------------------------------------------------------------
select results_eq(
  $$select status from pg_temp.push('{"op":"delete","body":{"id":"eeeeeeee-0000-0000-0000-000000000002"}}'::jsonb)$$,
  $$values ('applied')$$, 'a delete is applied');
select isnt((select deleted_at from public.events where id = 'eeeeeeee-0000-0000-0000-000000000002'), null,
  'the event is soft deleted, never removed (rule 7)');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000002",
    "payload":{"note":"back"}}}'::jsonb)$$,
  $$values ('ignored', 'deleted')$$, 'a later patch does nothing: delete wins');
select is(pg_temp.payload_of('eeeeeeee-0000-0000-0000-000000000002'), '{"note": "better"}'::jsonb,
  'and the payload is untouched');
select results_eq(
  format($$select status, reason from pg_temp.push(%L::jsonb)$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000002')),
  $$values ('ignored', 'deleted')$$, 'and an insert of the same id never brings it back');
select isnt((select deleted_at from public.events where id = 'eeeeeeee-0000-0000-0000-000000000002'), null,
  'it stays deleted');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"delete","body":{"id":"eeeeeeee-0000-0000-0000-000000000002"}}'::jsonb)$$,
  $$values ('ignored', 'deleted')$$, 'deleting twice is harmless');

-- not_before: the undo window (P1-12, P1-F13) --------------------------------
select pg_temp.push(pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000003'));
select results_eq(
  $$select status, reason from pg_temp.push(jsonb_build_object('op', 'delete', 'not_before',
    (extract(epoch from now() + interval '6 seconds') * 1000)::bigint,
    'body', '{"id":"eeeeeeee-0000-0000-0000-000000000003"}'::jsonb))$$,
  $$values ('deferred', 'not_before')$$, 'an op sent before its not_before is deferred');
select is((select deleted_at from public.events where id = 'eeeeeeee-0000-0000-0000-000000000003'), null,
  'and nothing happens to the event');
select results_eq(
  $$select status from pg_temp.push(jsonb_build_object('op', 'delete', 'not_before',
    (extract(epoch from now() - interval '1 second') * 1000)::bigint,
    'body', '{"id":"eeeeeeee-0000-0000-0000-000000000003"}'::jsonb))$$,
  $$values ('applied')$$, 'once its time has passed, the same op applies');
select results_eq(
  $$select status, reason from pg_temp.push(jsonb_build_object('op', 'patch', 'not_before',
    to_jsonb((now() + interval '1 minute')::text),
    'body', '{"id":"eeeeeeee-0000-0000-0000-000000000001","payload":{"ml":999}}'::jsonb))$$,
  $$values ('deferred', 'not_before')$$, 'any kind of op can be held back');
select is(pg_temp.payload_of('eeeeeeee-0000-0000-0000-000000000001') ->> 'ml', '120',
  'and a deferred patch changes nothing');

-- Who may push what ---------------------------------------------------------
select results_eq(
  format($$select status, reason from pg_temp.push(%L::jsonb)$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000004', 1)),
  $$values ('rejected', 'forbidden')$$, 'pushing an entry authored by someone else is refused');
select pg_temp.login(3);
select results_eq(
  format($$select status, reason from pg_temp.push(%L::jsonb)$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000005', 3)),
  $$values ('rejected', 'forbidden')$$, 'a viewer can''t push an insert');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "payload":{"ml":5}}}'::jsonb)$$,
  $$values ('rejected', 'forbidden')$$, 'or a patch');
select pg_temp.login(4);
select results_eq(
  format($$select status, reason from pg_temp.push(%L::jsonb)$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000006', 4,
      '{"ml": 10, "milk": "formula"}'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001')),
  $$values ('rejected', 'forbidden')$$, 'a stranger can''t push into another household');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001",
    "payload":{"ml":5}}}'::jsonb)$$,
  $$values ('rejected', 'not_found')$$, 'and another household''s events look absent to them');

-- Batches -------------------------------------------------------------------
select pg_temp.login(2);
select is(pg_temp.payload_of('eeeeeeee-0000-0000-0000-000000000001') ->> 'ml', '120',
  'none of that changed anything');
select results_eq(
  format($$select op, status::text from public.push_events(jsonb_build_array(%L::jsonb, %L::jsonb,
    '{"op":"delete","body":{"id":"eeeeeeee-0000-0000-0000-000000000007"}}'::jsonb))$$,
    pg_temp.insert_op('eeeeeeee-0000-0000-0000-000000000007'),
    '{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000007","payload":{"ml":150}}}'),
  $$values ('insert', 'applied'), ('patch', 'applied'), ('delete', 'applied')$$,
  'a batch is applied in order, one answer per op');
select results_eq(
  $$select status, reason from pg_temp.push('{"op":"burn","body":{"id":"eeeeeeee-0000-0000-0000-000000000001"}}'::jsonb)$$,
  $$values ('rejected', 'invalid')$$, 'an op this server doesn''t know is refused');
select throws_ok(
  $$select public.push_events((select jsonb_agg(jsonb_build_object('op', 'delete', 'body',
      jsonb_build_object('id', gen_random_uuid()))) from generate_series(1, 101)))$$,
  '22023', null, 'more than 100 ops in one call is refused');
select throws_ok($$select public.push_events('{}'::jsonb)$$, '22023', null,
  'ops must be an array');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.push_events('[]'::jsonb)$$, '42501', null, 'without a user, pushing is refused');
reset role;

select * from finish();
rollback;
