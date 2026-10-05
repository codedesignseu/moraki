-- P4-06: leaving a household, deleting one, and deleting an account.
--
-- Household A: 1 owns it, 3 joined as a viewer, then 2 as a caregiver.
-- Household B: 4 alone. 5 belongs to neither.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'carer@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'viewer@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'alone@example.test'),
  ('00000000-0000-0000-0000-000000000005', 'stranger@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'B', '00000000-0000-0000-0000-000000000004');
insert into public.memberships (household_id, user_id, role, display_name, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Owner', now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'viewer', 'Viewer', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Carer', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'owner', 'Alone', now());
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'b', now());
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
    client_created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(),
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now()),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(),
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now()),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000002', 'diaper', now(),
   '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', now());
insert into public.invites (code, household_id, created_by, expires_at) values
  ('ABCDEFGH', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   now() + interval '7 days');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;

select has_function('public', 'leave_household', array['uuid', 'uuid'], 'leave_household exists');
select has_function('public', 'delete_household', array['uuid'], 'delete_household exists');
select has_function('public', 'delete_account', array['uuid'], 'delete_account exists');
select ok(not has_function_privilege('authenticated', 'public.hand_over_and_leave(uuid, uuid, uuid)', 'execute'),
  'a client cannot call the handover directly');
select ok(not has_function_privilege('anon', 'public.delete_account(uuid)', 'execute'),
  'nobody signed out can delete an account');

set local role authenticated;

-- Refusals ----------------------------------------------------------------
select pg_temp.login(2);
select throws_ok(
  $$select public.delete_household('aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', 'only an owner can delete a household',
  'a caregiver cannot delete the household');
select pg_temp.login(5);
select throws_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', 'not a member of this household',
  'a stranger cannot leave a household they are not in');
select throws_ok(
  $$select public.delete_household('aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', 'only an owner can delete a household',
  'a stranger cannot delete someone else''s household');
select pg_temp.login(4);
select throws_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000002')$$,
  '23001', 'the only member can''t leave; delete the household instead',
  'the only member cannot leave');

-- The owner deletes their account from a shared household ----------------
select pg_temp.login(1);
select lives_ok($$select public.delete_account()$$, 'the owner deletes their account');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000001'),
  0, 'their auth row is gone');
select is((select count(*)::int from public.consents where user_id = '00000000-0000-0000-0000-000000000001'),
  0, 'and their consents');
select is((select count(*)::int from public.memberships where user_id = '00000000-0000-0000-0000-000000000001'),
  0, 'and their membership, and with it their name');
select is((select role::text from public.memberships
           where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
             and user_id = '00000000-0000-0000-0000-000000000002'),
  'owner', 'the caregiver becomes owner, ahead of a viewer who joined earlier');
select is((select role::text from public.memberships
           where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
             and user_id = '00000000-0000-0000-0000-000000000003'),
  'viewer', 'the viewer stays a viewer');
select is((select count(*)::int from public.events
           where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' and deleted_at is null),
  2, 'the shared household keeps every entry, theirs included');

-- A viewer leaves ---------------------------------------------------------
set local role authenticated;
select pg_temp.login(3);
select lives_ok($$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'a viewer leaves');
select is((select count(*)::int from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0, 'and can no longer see the household');

-- The sole member deletes their account -----------------------------------
select pg_temp.login(4);
select lives_ok($$select public.delete_account()$$, 'the only member deletes their account');

reset role;
select is((select count(*)::int from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0, 'their household goes with it');
select is((select count(*)::int from public.babies where household_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0, 'the baby too');
select is((select count(*)::int from public.events where household_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0, 'and every entry');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000004'),
  0, 'and the account');

-- The new owner deletes the household -------------------------------------
set local role authenticated;
select pg_temp.login(2);
select lives_ok($$select public.delete_household('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'the new owner deletes the household');

reset role;
select is((select count(*)::int from public.events where household_id = 'aaaaaaaa-0000-0000-0000-000000000001')
        + (select count(*)::int from public.invites where household_id = 'aaaaaaaa-0000-0000-0000-000000000001')
        + (select count(*)::int from public.memberships where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0, 'entries, invites and memberships all go');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000002'),
  1, 'deleting a household leaves the owner''s account');

select * from finish();
rollback;
