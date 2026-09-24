-- P4-07: a household must always have an owner, whatever a client sends.
--
-- The screen hides the controls on the owner's own row, but a stale client,
-- a script or devtools talks to PostgREST directly, so the rule lives here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'carer@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'second@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'one', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Carer');
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1', now());
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
-- Two entries the caregiver logged, to prove removal leaves them alone.
insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
    client_created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(),
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now()),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'feed_bottle', now(),
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now());

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;

select has_function('public', 'memberships_keep_an_owner', 'the rule is a function on the server');
select has_trigger('public', 'memberships', 'memberships_keep_an_owner', 'and runs on every change');

set local role authenticated;

-- The sole owner cannot empty the chair, by either route -------------------
select pg_temp.login(1);
select throws_ok(
  $$update public.memberships set role = 'viewer'
    where user_id = '00000000-0000-0000-0000-000000000001'$$,
  '42501', 'a household must keep an owner',
  'the only owner cannot demote themselves');
select throws_ok(
  $$delete from public.memberships
    where user_id = '00000000-0000-0000-0000-000000000001'$$,
  '42501', 'a household must keep an owner',
  'the only owner cannot remove themselves');

-- What the screen actually does still works --------------------------------
select lives_ok(
  $$update public.memberships set role = 'viewer'
    where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'the owner may change a caregiver to a viewer');
select lives_ok(
  $$delete from public.memberships
    where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'the owner may remove a caregiver');

-- Removing someone leaves their entries alone ------------------------------
select is(
  (select count(*)::int from public.events
   where created_by = '00000000-0000-0000-0000-000000000002' and deleted_at is null),
  2, 'the entries they logged are still there, and still live');

-- A second owner makes stepping down possible ------------------------------
-- Seeded as the server: memberships are made by RPC, never by a client.
reset role;
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'owner', 'Second');
set local role authenticated;
select pg_temp.login(1);
select lives_ok(
  $$update public.memberships set role = 'caregiver'
    where user_id = '00000000-0000-0000-0000-000000000001'$$,
  'an owner may step down once another owner exists');
select is(
  (select count(*)::int from public.memberships
   where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' and role = 'owner'),
  1, 'and the household still has one');

-- The last owner is protected again, whoever they are -----------------------
select pg_temp.login(3);
select throws_ok(
  $$delete from public.memberships
    where user_id = '00000000-0000-0000-0000-000000000003'$$,
  '42501', 'a household must keep an owner',
  'the remaining owner cannot leave either');

select * from finish();
rollback;
