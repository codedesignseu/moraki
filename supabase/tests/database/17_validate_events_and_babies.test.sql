-- P0.8: the server checks entries and baby names with the app's own limits
-- (the Zod schemas in src/domain/activities, BABY_NAME_MAX).
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test');
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ella', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name, is_guardian) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Maria', true);
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now());

/** An insert of one entry, as SQL text for lives_ok / throws_ok. */
create function pg_temp.entry(event_type text, payload text, deleted boolean default false)
returns text language sql as $$
  select format($f$insert into public.events (id, household_id, baby_id, type, occurred_at, payload,
      created_by, updated_by, client_created_at, deleted_at)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001', %L, now(), %L::jsonb,
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now(), %s)$f$,
    event_type, payload, case when deleted then 'now()' else 'null' end)
$$;
create function pg_temp.refused(event_type text, payload text, what text) returns text
language sql as $$ select throws_ok(pg_temp.entry(event_type, payload), '23514', null, what) $$;

-- Valid rows: one of each type, and every limit at its edge ---------------------
select lives_ok(pg_temp.entry('feed_bottle', '{"ml": 90, "milk": "formula"}'), 'a bottle');
select lives_ok(pg_temp.entry('feed_bottle', '{"ml": 1, "milk": "breast", "from_stock": "fridge"}'), 'a bottle of 1 ml, from stock');
select lives_ok(pg_temp.entry('feed_bottle', '{"ml": 400, "milk": "mixed"}'), 'a bottle of 400 ml');
select lives_ok(pg_temp.entry('feed_breast', '{"side": "left", "left_s": 600}'), 'a breast feed');
select lives_ok(pg_temp.entry('diaper', format('{"kind": "wet", "note": "%s"}', repeat('ν', 280))), 'a diaper, with a 280-character Greek note');
select lives_ok(pg_temp.entry('sleep', '{}'), 'a sleep with no place');
select lives_ok(pg_temp.entry('pump', '{"ml": 600, "dest": "freezer"}'), 'a pump of 600 ml');
select lives_ok(pg_temp.entry('stock_adjust', '{"loc": "fridge", "delta_ml": -120, "reason": "discard"}'), 'a stock adjustment');
select lives_ok(pg_temp.entry('health', '{"temp_c": 34}'), 'a temperature of 34.0');
select lives_ok(pg_temp.entry('health', '{"temp_c": 43, "tags": ["rash", "cough"]}'), 'a temperature of 43.0, with tags');
select lives_ok(pg_temp.entry('health', '{"note": "sneezy"}'), 'a health note alone');
select lives_ok(pg_temp.entry('medication', format('{"name": "%s", "dose": "%s"}', repeat('a', 60), repeat('b', 30))), 'a medication at 60 and 30 characters');
select lives_ok(pg_temp.entry('weight', '{"grams": 500, "source": "home"}'), 'a weight of 500 g');
select lives_ok(pg_temp.entry('weight', '{"grams": 15000, "source": "clinic"}'), 'a weight of 15000 g');
select lives_ok(pg_temp.entry('appointment', jsonb_build_object(
    'title', repeat('τ', 100), 'doctor', repeat('δ', 60), 'clinic', repeat('κ', 80),
    'notes', repeat('σ', 500), 'questions', (select jsonb_agg(repeat('ε', 200)) from generate_series(1, 20)))::text),
  'the largest appointment the app allows, in Greek (over 8 KiB)');
select lives_ok(pg_temp.entry('feed_bottle', '{"ml": 90, "milk": "formula", "from_a_newer_app": true}'),
  'a field this version does not know is kept (P1-F1)');

-- Malformed and oversized -------------------------------------------------------
select pg_temp.refused('feed_bottle', '[]', 'a payload that is not an object');
select pg_temp.refused('feed_bottle', '"ml"', 'a payload that is a string');
select pg_temp.refused('feed_bottle', format('{"ml": 90, "milk": "formula", "x": "%s"}', repeat('x', 33000)),
  'a payload over 32 KiB');
select pg_temp.refused('feed_bottle', '{"milk": "formula"}', 'a bottle with no amount');
select pg_temp.refused('feed_bottle', '{"ml": "90", "milk": "formula"}', 'an amount that is a string');
select pg_temp.refused('feed_bottle', '{"ml": 90.5, "milk": "formula"}', 'an amount that is not whole');
select pg_temp.refused('feed_bottle', '{"ml": 90, "milk": 1}', 'a milk that is not a string');
select pg_temp.refused('health', '{"tags": ["rash"]}', 'a health entry with neither note nor temperature');
select pg_temp.refused('health', '{"note": "x", "tags": "rash"}', 'tags that are not a list');

-- Wrong type --------------------------------------------------------------------
select pg_temp.refused('bath', '{}', 'a type the app does not register');
select throws_ok(pg_temp.entry('bath', '{}', true), '23514', null, 'not even as a tombstone');

-- Out of range ------------------------------------------------------------------
select pg_temp.refused('feed_bottle', '{"ml": 0, "milk": "formula"}', 'a bottle of 0 ml');
select pg_temp.refused('feed_bottle', '{"ml": 401, "milk": "formula"}', 'a bottle of 401 ml');
select pg_temp.refused('pump', '{"ml": 601, "dest": "fridge"}', 'a pump of 601 ml');
select pg_temp.refused('feed_breast', '{"side": "left", "left_s": -1}', 'a negative breast time');
select pg_temp.refused('health', '{"temp_c": 33.9}', 'a temperature of 33.9');
select pg_temp.refused('health', '{"temp_c": 43.1}', 'a temperature of 43.1');
select pg_temp.refused('weight', '{"grams": 499, "source": "home"}', 'a weight of 499 g');
select pg_temp.refused('weight', '{"grams": 15001, "source": "home"}', 'a weight of 15001 g');

-- Text lengths ------------------------------------------------------------------
select pg_temp.refused('diaper', format('{"kind": "wet", "note": "%s"}', repeat('n', 281)), 'a diaper note of 281');
select pg_temp.refused('health', format('{"note": "%s"}', repeat('n', 501)), 'a health note of 501');
select pg_temp.refused('health', '{"note": ""}', 'an empty health note');
select pg_temp.refused('medication', '{"name": ""}', 'a medication with no name');
select pg_temp.refused('medication', format('{"name": "%s"}', repeat('a', 61)), 'a medication name of 61');
select pg_temp.refused('medication', format('{"name": "a", "dose": "%s"}', repeat('b', 31)), 'a dose of 31');
select pg_temp.refused('appointment', format('{"title": "%s"}', repeat('t', 101)), 'an appointment title of 101');
select pg_temp.refused('appointment', format('{"title": "t", "notes": "%s"}', repeat('n', 501)), 'appointment notes of 501');
select pg_temp.refused('appointment', jsonb_build_object('title', 't',
    'questions', (select jsonb_agg('q'::text) from generate_series(1, 21)))::text, '21 questions');
select pg_temp.refused('appointment', format('{"title": "t", "questions": ["%s"]}', repeat('q', 201)),
  'a question of 201');

-- Tombstones are not checked ----------------------------------------------------
select lives_ok(pg_temp.entry('feed_bottle', '{}', true), 'a deleted entry needs no content');

-- Through push_events: refused as invalid, never half-applied ---------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by, updated_by,
    client_created_at) values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001', 'feed_bottle', now(), '{"ml": 90, "milk": "formula"}',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now());
select results_eq(
  $$select status::text, reason from public.push_events(jsonb_build_array(jsonb_build_object('op', 'insert',
    'body', jsonb_build_object('id', 'eeeeeeee-0000-0000-0000-000000000002',
      'household_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'baby_id', 'bbbbbbbb-0000-0000-0000-000000000001',
      'type', 'feed_bottle', 'occurred_at', 1793620800000::bigint, 'payload', '{"ml": 999, "milk": "formula"}'::jsonb,
      'client_created_at', 1793620800000::bigint))))$$,
  $$values ('rejected', 'invalid')$$, 'push_events refuses an insert out of range');
select results_eq(
  $$select status::text, reason from public.push_events(
    '[{"op":"patch","body":{"id":"eeeeeeee-0000-0000-0000-000000000001","payload":{"ml":999}}}]'::jsonb)$$,
  $$values ('rejected', 'invalid')$$, 'and a patch that would put one out of range');
select is((select payload from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '{"ml": 90, "milk": "formula"}'::jsonb, 'leaving the entry as it was');
select results_eq(
  $$select status::text from public.push_events(
    '[{"op":"delete","body":{"id":"eeeeeeee-0000-0000-0000-000000000001"}}]'::jsonb)$$,
  $$values ('applied')$$, 'a delete still works');
reset role;

-- Rows from before this migration are not re-read (NOT VALID) ---------------------
select ok((select not convalidated from pg_constraint where conname = 'events_payload_valid'),
  'existing entries are not re-checked when the constraint is added');
alter table public.events drop constraint events_payload_valid;
insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by, updated_by,
    client_created_at) values ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001', 'feed_bottle', now(), '{"ml": 9999}',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now());
alter table public.events add constraint events_payload_valid check (
  type in ('feed_bottle', 'feed_breast', 'diaper', 'sleep', 'pump', 'stock_adjust', 'health',
           'medication', 'weight', 'appointment')
  and (deleted_at is not null or public.event_payload_valid(type, payload))) not valid;
select lives_ok($$update public.events set deleted_at = now() - interval '31 days'
  where id = 'eeeeeeee-0000-0000-0000-000000000003'$$, 'an old row that fails the new rules can still be deleted');
select is(public.purge_deleted_event_content(), 1, 'and purged');

-- Baby names ----------------------------------------------------------------------
select ok((select not convalidated from pg_constraint where conname = 'babies_name_length'),
  'existing babies are not re-checked');
select lives_ok($$update public.babies set name = repeat('Ε', 60)
  where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, 'a 60-character Greek name');
select throws_ok($$update public.babies set name = repeat('E', 61)
  where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, '23514', null, 'a 61-character name');
select throws_ok($$insert into public.babies (id, household_id, name, born_at)
  values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', '', now())$$,
  '23514', null, 'an empty name');

select * from finish();
rollback;
