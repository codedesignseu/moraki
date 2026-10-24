-- P0.1: only a member who has declared they are a parent or guardian owns a
-- household, and ownership passes only to such a member.
--
-- Household A: 1 owns it (declared), 2 is a caregiver, 3 a viewer; neither
-- has declared. Household B: 4 owns it (declared), 5 a caregiver who hasn't.
-- Household C: 7 owns it, 8 a caregiver who joined first and hasn't
-- declared, 9 a viewer who joined later and has. 6 belongs to none.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, n || '@example.test'
  from generate_series(1, 9) n;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'B', '00000000-0000-0000-0000-000000000004'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'C', '00000000-0000-0000-0000-000000000007');
insert into public.memberships (household_id, user_id, role, display_name, joined_at, is_guardian) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'One', now() - interval '3 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Two', now() - interval '2 days', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'viewer', 'Three', now() - interval '1 day', false),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'owner', 'Four', now() - interval '2 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'caregiver', 'Five', now() - interval '1 day', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', 'owner', 'Seven', now() - interval '3 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008', 'caregiver', 'Eight', now() - interval '2 days', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000009', 'viewer', 'Nine', now() - interval '1 day', true);
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a', now());

-- P0.2: seeing and writing baby data needs the caregiver agreement (or a
-- guardian's consent); every member here has accepted it. P0.3: and a
-- household needs a guardian whose consent is in force, or it is frozen:
-- each owner here is one.
update public.memberships set is_guardian = true where role = 'owner';
insert into public.consents (user_id, policy_version)
  select user_id, public.consent_version() from public.memberships where role = 'owner'
  on conflict do nothing;
insert into public.consent_events (user_id, purpose, version, action, text_key, household_id)
  select user_id, 'caregiver_agreement', public.caregiver_agreement_version(), 'grant', 'test',
         household_id
  from public.memberships;

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.role_of(h int, n int) returns text language sql security definer as $$
  select role::text from public.memberships
  where household_id = ('aaaaaaaa-0000-0000-0000-00000000000' || h)::uuid
    and user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
$$;
create function pg_temp.guardian(h int, n int) returns boolean language sql security definer as $$
  select is_guardian from public.memberships
  where household_id = ('aaaaaaaa-0000-0000-0000-00000000000' || h)::uuid
    and user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
$$;

select has_column('public', 'memberships', 'is_guardian', 'memberships has is_guardian');
select col_default_is('public', 'memberships', 'is_guardian', 'false', 'nobody is a guardian until they declare');
select ok(not has_function_privilege('anon', 'public.declare_guardian(uuid, text, text)', 'execute'),
  'anon can''t declare');

set local role authenticated;

-- With nobody who has declared, the owner can't hand over -------------------
select pg_temp.login(1);
select throws_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001',
                                  '00000000-0000-0000-0000-000000000002')$$,
  '22023', 'the new owner must have declared they are a parent or guardian',
  'naming a member who hasn''t declared is refused');
select throws_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'MK002', null, 'leaving with nobody to hand over to is refused');
select throws_ok($$select public.delete_account()$$,
  'MK002', null, 'so is deleting the account: delete the household, or have someone declare first');
select is(pg_temp.role_of(1, 1), 'owner', 'after the refusals the owner is still the owner');
select ok(pg_temp.guardian(1, 2) is false, 'and nobody was made a guardian on the way');

-- Nobody makes someone a guardian, or an owner, by hand ---------------------
select pg_temp.login(2);
select throws_ok(
  $$update public.memberships set is_guardian = true
    where user_id = '00000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a member can''t mark themselves a guardian');
select pg_temp.login(1);
select throws_ok(
  $$update public.memberships set is_guardian = true
    where user_id = '00000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'nor can the owner mark someone else');
select throws_ok(
  $$update public.memberships set role = 'owner'
    where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'MK001', null, 'the owner can''t make a member owner who hasn''t declared');

-- declare_guardian -----------------------------------------------------------
select pg_temp.login(6);
select throws_ok(
  $$select public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24')$$,
  '42501', null, 'someone outside the household can''t declare for it');
select pg_temp.login(2);
select throws_ok(
  $$select public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', 'v1')$$,
  '22023', null, 'the version must be a date');
select throws_ok(
  $$select public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24', 'fr')$$,
  '22023', null, 'and the language one the app has');
select isnt(public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24', 'el'), null,
  'a caregiver declares');
select ok(pg_temp.guardian(1, 2), 'and is marked as a guardian');
select results_eq(
  $$select purpose, version, action, locale, household_id, baby_id from public.consent_events
    where purpose = 'guardian_declaration'$$,
  $$values ('guardian_declaration', '2026-10-24', 'grant', 'el',
            'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid)$$,
  'the declaration is on record, for the household and its baby');

-- Now the owner can hand over, and only to them ----------------------------
select pg_temp.login(1);
select lives_ok($$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'the owner leaves');
select is(pg_temp.role_of(1, 2), 'owner', 'the caregiver who declared becomes owner');
select is(pg_temp.role_of(1, 3), 'viewer', 'the viewer who hasn''t stays a viewer');

-- The fallback skips anyone who hasn't declared ------------------------------
select pg_temp.login(7);
select lives_ok($$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000003')$$,
  'an owner leaves without naming anyone');
select is(pg_temp.role_of(3, 9), 'owner',
  'the viewer who declared takes over, ahead of a caregiver who joined first but hasn''t');
select is(pg_temp.role_of(3, 8), 'caregiver', 'the caregiver is left as they were');

-- An owner can make a member owner once they have declared -------------------
select pg_temp.login(3);
select lives_ok($$select public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24')$$,
  'the viewer declares');
select pg_temp.login(2);
select lives_ok(
  $$update public.memberships set role = 'owner'
    where user_id = '00000000-0000-0000-0000-000000000003'$$,
  'and the owner may then make them a co-owner');

-- An owner marked as a guardian when this shipped can put it on record -------
select pg_temp.login(4);
select throws_ok($$select public.delete_account()$$,
  'MK002', null, 'household B''s owner can''t hand over to a caregiver who hasn''t declared');
select lives_ok($$select public.declare_guardian('aaaaaaaa-0000-0000-0000-000000000002', '2026-10-24')$$,
  'an owner who is already a guardian declares');
select is(
  (select count(*)::int from public.consent_events
   where purpose = 'guardian_declaration' and household_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1, 'and it is recorded, with no baby to name');

select * from finish();
rollback;
