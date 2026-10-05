-- D3: the only owner chooses who takes over when they leave or delete their
-- account. Household A: 1 owns it, 2 is a caregiver, 3 a viewer. 4 is in
-- household B only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'carer@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'viewer@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'elsewhere@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'B', '00000000-0000-0000-0000-000000000004');
insert into public.memberships (household_id, user_id, role, display_name, joined_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Owner', now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Carer', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'viewer', 'Viewer', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'owner', 'Else', now());

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.role_of(n int) returns text language sql as $$
  select role::text from public.memberships
  where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
$$;

set local role authenticated;
select pg_temp.login(1);

-- A successor who isn't in the household is refused, and nothing changes --
select throws_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001',
                                  '00000000-0000-0000-0000-000000000004')$$,
  '22023', 'the new owner must be another member of this household',
  'someone from another household cannot be handed ownership');
select throws_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001',
                                  '00000000-0000-0000-0000-000000000001')$$,
  '22023', 'the new owner must be another member of this household',
  'the owner cannot name themselves');
select throws_ok(
  $$select public.delete_account('00000000-0000-0000-0000-000000000004')$$,
  '22023', 'the new owner must be another member of this household',
  'deleting the account refuses an outsider too');
reset role;
select is(pg_temp.role_of(1), 'owner', 'after a refusal the owner is still the owner');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000001'),
  1, 'and still has an account');

-- The owner picks the viewer, over the caregiver the fallback would pick ----
set local role authenticated;
select pg_temp.login(1);
select lives_ok(
  $$select public.delete_account('00000000-0000-0000-0000-000000000003')$$,
  'the owner deletes their account, naming the viewer');
reset role;
select is(pg_temp.role_of(3), 'owner', 'the one they chose becomes owner');
select is(pg_temp.role_of(2), 'caregiver', 'the caregiver is left as they were');

-- The new owner can hand on in turn ---------------------------------------
set local role authenticated;
select pg_temp.login(3);
select lives_ok(
  $$select public.leave_household('aaaaaaaa-0000-0000-0000-000000000001',
                                  '00000000-0000-0000-0000-000000000002')$$,
  'the new owner leaves too, naming the caregiver');
reset role;
select is(pg_temp.role_of(2), 'owner', 'and the caregiver they named is owner now');

select * from finish();
rollback;
