-- P0.3: withdrawing. A guardian's withdrawal stops their own processing; the
-- last guardian consent going freezes the household; deleting your own
-- entries is never stopped; a caregiver withdrawing the agreement leaves.
--
-- Household A: 1 owns it (guardian, consent); 2 a caregiver with the
-- agreement; 3 a caregiver who is also a guardian with consent; 4 a viewer
-- with the agreement. 5 belongs to none, and agreed to the Terms.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, n || '@example.test'
  from generate_series(1, 5) n;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name, is_guardian) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'One', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Two', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'caregiver', 'Three', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'viewer', 'Four', false);
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now());
insert into public.consents (user_id, policy_version) values
  ('00000000-0000-0000-0000-000000000001', public.consent_version()),
  ('00000000-0000-0000-0000-000000000003', public.consent_version());
insert into public.consent_events (user_id, purpose, version, action, text_key, household_id, created_at)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'caregiver_agreement',
         public.caregiver_agreement_version(), 'grant', 'test',
         'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day'
  from unnest(array[2, 4]) n;
insert into public.consent_events (user_id, purpose, version, action, text_key) values
  ('00000000-0000-0000-0000-000000000005', 'terms', public.terms_version(), 'grant', 'test');
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
insert into public.invites (code, household_id, role, created_by, expires_at) values
  ('FRZNJWAB', 'aaaaaaaa-0000-0000-0000-000000000001', 'caregiver', '00000000-0000-0000-0000-000000000001', now() + interval '1 day');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.an_event(n int) returns text language sql as $$
  select format($f$insert into public.events
    (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '%s', '%s', now())$f$,
    ('00000000-0000-0000-0000-00000000000' || n)::uuid, ('00000000-0000-0000-0000-00000000000' || n)::uuid)
$$;
create function pg_temp.access() returns text language sql as $$
  select access from public.my_membership_status('aaaaaaaa-0000-0000-0000-000000000001')
$$;
create function pg_temp.seen() returns text language sql as $$
  select coalesce(string_agg(right(id::text, 1), ',' order by id), '') from public.events
$$;
create function pg_temp.push(op text, body jsonb) returns text language sql as $$
  select status || coalesce('/' || reason, '')
  from public.push_events(jsonb_build_array(jsonb_build_object('op', op, 'body', body)))
$$;

select is(public.consent_version(), '2026-10-25', 'the consent text in force says what withdrawing does');
select ok(not has_function_privilege('anon', 'public.household_frozen(uuid)', 'execute'),
  'anon can''t ask whether a household is frozen');

set local role authenticated;

-- One guardian withdraws while another still consents ---------------------------
select pg_temp.login(1);
select ok(not public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'), 'two guardians consent: not frozen');
select isnt(public.withdraw_consent(), null, 'the owner withdraws');
select ok(not public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'),
  'another guardian still consents, so the household carries on');
select is(pg_temp.access(), 'needs_consent', 'only the owner''s own access stops');
select is(pg_temp.seen(), '1', 'they read their own entries only');
select throws_ok(pg_temp.an_event(1), '42501', null, 'and log nothing');
select throws_ok($$update public.events set payload = '{"kind":"dirty"}', updated_by = auth.uid()
  where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'nor correct their own entry: only deleting is exempt');
select results_eq(
  $$with d as (update public.events set deleted_at = now(), updated_by = auth.uid()
      where id = 'eeeeeeee-0000-0000-0000-000000000002' returning 1) select count(*)::int from d$$,
  array[0], 'nor delete someone else''s');
select is(pg_temp.push('delete', '{"id":"eeeeeeee-0000-0000-0000-000000000001"}'), 'applied',
  'but they can still delete their own, through push_events');
select pg_temp.login(2);
select is(pg_temp.access(), 'granted', 'the caregiver is unaffected');
select is(pg_temp.seen(), '1,2,3', 'and reads the household, the deletion included');

-- The last guardian consent goes: frozen ----------------------------------------
select pg_temp.login(3);
select isnt(public.withdraw_consent(), null, 'the other guardian withdraws too');
select ok(public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'), 'no guardian consents: frozen');
select is(pg_temp.access(), 'frozen', 'my_membership_status says frozen to a guardian');
select pg_temp.login(2);
select is(pg_temp.access(), 'frozen', 'and to a caregiver');
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000001'),
  'the caregiver''s agreement no longer gives access');
select is(pg_temp.seen(), '2,3', 'they read only their own entries');
select is_empty('select 1 from public.babies', 'not the baby');
select results_eq('select count(*)::int from public.memberships', array[1], 'nor the other members');
select throws_ok(pg_temp.an_event(2), '42501', null, 'nobody logs');
select is(pg_temp.push('patch', '{"id":"eeeeeeee-0000-0000-0000-000000000002","payload":{"kind":"dirty"}}'),
  'rejected/forbidden', 'nobody corrects an entry');
select is(pg_temp.push('delete', '{"id":"eeeeeeee-0000-0000-0000-000000000002"}'), 'applied',
  'but the author can still delete their own');
select pg_temp.login(4);
select is(pg_temp.seen(), '', 'a viewer reads nothing');

select pg_temp.login(1);
select throws_ok($$select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')$$, 'MK005', null,
  'no invites into a frozen household');
select pg_temp.login(5);
select public.record_invite_attempt();
select throws_ok($$select * from public.invite_preview('FRZNJWAB')$$, 'MKI08', null,
  'an invite made before the freeze can''t be looked at');
select throws_ok($$select * from public.accept_invite('FRZNJWAB', 'Five', null, public.caregiver_agreement_version())$$,
  'MKI08', null, 'nor used');
select is_empty($$select 1 from public.memberships where user_id = '00000000-0000-0000-0000-000000000005'$$,
  'so nobody joins');

-- Consent given again unfreezes it ------------------------------------------------
select pg_temp.login(1);
select isnt(public.grant_consent(), null, 'the owner consents again');
select ok(not public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'), 'not frozen any more');
select is(pg_temp.access(), 'granted', 'the owner has access again');
select pg_temp.login(2);
select is(pg_temp.access(), 'granted', 'and so does the caregiver');
select lives_ok(pg_temp.an_event(2), 'who logs again');

-- Or another member takes it on: declares and consents ------------------------------
select pg_temp.login(1);
select isnt(public.withdraw_consent(), null, 'the owner withdraws once more');
select ok(public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'), 'frozen again');
select pg_temp.login(2);
select isnt(public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24', 'en'), null,
  'the caregiver declares they are a guardian');
select ok(public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'),
  'declaring alone isn''t consent: still frozen');
select isnt(public.grant_consent('en'), null, 'and consents');
select ok(not public.household_frozen('aaaaaaaa-0000-0000-0000-000000000001'), 'which unfreezes it');
select is(pg_temp.access(), 'granted', 'for them');

-- A caregiver withdrawing the agreement leaves ---------------------------------
select pg_temp.login(4);
select lives_ok($$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001', locale => 'el')$$,
  'the viewer leaves');
select results_eq(
  $$select action, locale, text_key from public.consent_events
    where purpose = 'caregiver_agreement' order by created_at desc, id desc limit 1$$,
  $$values ('withdraw', 'el', 'leaveHousehold')$$,
  'and the record says their agreement was withdrawn');
select is((select status from public.my_membership_status('aaaaaaaa-0000-0000-0000-000000000001')),
  'not_member', 'they are no longer a member');

select * from finish();
rollback;
