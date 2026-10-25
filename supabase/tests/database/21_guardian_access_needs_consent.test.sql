-- A guardian's access rests on their health-data consent alone: the
-- caregiver agreement they accepted when they joined by invite gives them
-- nothing once they withdraw. Members who aren't guardians are unchanged.
--
-- Household A: 1 owns it (guardian, consent); 2 joined by invite, accepted
-- the caregiver agreement, is a guardian with consent; 3 a caregiver with the
-- agreement; 4 a caregiver with the agreement who will declare.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, n || '@example.test'
  from generate_series(1, 4) n;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name, is_guardian) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'One', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Two', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'caregiver', 'Three', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'caregiver', 'Four', false);
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now());
insert into public.consents (user_id, policy_version) values
  ('00000000-0000-0000-0000-000000000001', public.consent_version()),
  ('00000000-0000-0000-0000-000000000002', public.consent_version());
insert into public.consent_events (user_id, purpose, version, action, text_key, household_id, created_at)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'caregiver_agreement',
         public.caregiver_agreement_version(), 'grant', 'test',
         'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day'
  from unnest(array[2, 3, 4]) n;
insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by, updated_by,
    client_created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '{"kind":"wet"}',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now()),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '{"kind":"wet"}',
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now()),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '{"kind":"wet"}',
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now());

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.an_event(n int) returns text language sql as $$
  select format($f$insert into public.events
    (id, household_id, baby_id, type, occurred_at, payload, created_by, updated_by, client_created_at)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '{"kind": "wet"}', '%s', '%s', now())$f$,
    ('00000000-0000-0000-0000-00000000000' || n)::uuid, ('00000000-0000-0000-0000-00000000000' || n)::uuid)
$$;
create function pg_temp.access() returns text language sql as $$
  select access from public.my_membership_status('aaaaaaaa-0000-0000-0000-000000000001')
$$;
create function pg_temp.seen() returns text language sql as $$
  select coalesce(string_agg(right(id::text, 1), ',' order by id), '') from public.events
    where id::text like 'eeeeeeee-%'
$$;
create function pg_temp.push(op text, body jsonb) returns text language sql as $$
  select status || coalesce('/' || reason, '')
  from public.push_events(jsonb_build_array(jsonb_build_object('op', op, 'body', body)))
$$;

set local role authenticated;

-- An invited guardian with consent and the agreement ------------------------------
select pg_temp.login(2);
select is(pg_temp.access(), 'granted', 'the invited guardian has access while they consent');
select is(pg_temp.seen(), '1,2,3', 'and reads the household');

-- They withdraw; the owner still consents, so the household carries on -------------
select isnt(public.withdraw_consent(), null, 'the invited guardian withdraws');
select ok(not public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'),
  'the owner still consents: not frozen');
select ok(public.has_caregiver_agreement('aaaaaaaa-0000-0000-0000-000000000001'),
  'their caregiver agreement still stands');
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000001'),
  'but it gives a guardian no access');
select is(pg_temp.access(), 'needs_consent', 'my_membership_status asks for consent, not the agreement');
select is(pg_temp.seen(), '2,3', 'they read their own entries only');
select is_empty('select 1 from public.babies', 'not the baby');
select results_eq('select count(*)::int from public.memberships', array[1], 'nor the other members');
select throws_ok(pg_temp.an_event(2), '42501', null, 'they log nothing');
select is(pg_temp.push('insert', jsonb_build_object(
    'id', 'eeeeeeee-0000-0000-0000-000000000009', 'household_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'baby_id', 'bbbbbbbb-0000-0000-0000-000000000001', 'type', 'diaper',
    'occurred_at', 1793620800000::bigint, 'ended_at', null, 'payload', '{"kind":"wet"}', 'group_id', null,
    'created_by', '00000000-0000-0000-0000-000000000002', 'updated_by', '00000000-0000-0000-0000-000000000002',
    'client_created_at', 1793620800000::bigint)), 'rejected/forbidden',
  'nor through push_events');
select throws_ok($$update public.events set payload = '{"kind":"dirty"}', updated_by = auth.uid()
  where id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  '42501', null, 'nor correct their own entry');
select results_eq(
  $$with d as (update public.events set deleted_at = now(), updated_by = auth.uid()
      where id = 'eeeeeeee-0000-0000-0000-000000000001' returning 1) select count(*)::int from d$$,
  array[0], 'nor delete someone else''s');
select results_eq(
  $$with d as (update public.events set deleted_at = now(), updated_by = auth.uid()
      where id = 'eeeeeeee-0000-0000-0000-000000000002' returning 1) select count(*)::int from d$$,
  array[1], 'but they can still delete their own');
select is(pg_temp.push('delete', '{"id":"eeeeeeee-0000-0000-0000-000000000003"}'), 'applied',
  'through push_events too');

-- Members who aren't guardians are unaffected -----------------------------------------
select pg_temp.login(3);
select ok(public.has_access('aaaaaaaa-0000-0000-0000-000000000001'),
  'a caregiver with the agreement keeps access');
select is(pg_temp.access(), 'granted', 'and my_membership_status says so');
select lives_ok(pg_temp.an_event(3), 'and logs');

-- Consenting again brings the guardian back -------------------------------------------
select pg_temp.login(2);
select isnt(public.grant_consent('en'), null, 'the invited guardian consents again');
select is(pg_temp.access(), 'granted', 'and has access again');
select is(pg_temp.seen(), '1,2,3', 'reads the household again');
select lives_ok(pg_temp.an_event(2), 'and logs again');

-- A caregiver who declares rests on consent from then on --------------------------------
select pg_temp.login(4);
select is(pg_temp.access(), 'granted', 'a caregiver with the agreement has access');
select isnt(public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24', 'en'), null,
  'and declares they are a guardian');
select is(pg_temp.access(), 'needs_consent', 'now their access needs their consent');
select isnt(public.grant_consent('en'), null, 'they consent');
select is(pg_temp.access(), 'granted', 'and have access');

select * from finish();
rollback;
