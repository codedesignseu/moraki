-- P2-03: the role-by-role checks 03_rls_policies.test.sql didn't make.
-- Auditing table 4.3 against 03, every cell had an assertion, but not for
-- every kind of user; each test below fills one of those missing pairs.
-- Same fixture as 03: household one has user 1 owner, 2 caregiver, 3 viewer;
-- user 4 owns household two and is a stranger to household one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'caregiver@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'viewer@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'stranger@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'one', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'two', '00000000-0000-0000-0000-000000000004');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Carer'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'viewer', 'Viewer'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'owner', 'Stranger');
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'b2', now());
insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
    client_created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(),
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now()),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000002', 'diaper', now(),
   '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', now());
insert into public.invites (code, household_id, created_by, expires_at) values
  ('ABCDEFGH', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() + interval '1 day');
insert into public.consents (user_id, policy_version) values
  ('00000000-0000-0000-0000-000000000002', 'v1'),
  ('00000000-0000-0000-0000-000000000004', 'v1');
insert into public.push_tokens (user_id, device_id, token, platform) values
  ('00000000-0000-0000-0000-000000000002', 'phone', 't2', 'android'),
  ('00000000-0000-0000-0000-000000000004', 'phone', 't4', 'ios');

-- Signs in as user n for the rest of the transaction, or until the next call.
create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
set local role authenticated;

create function pg_temp.visible(tbl text) returns int language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from public.%I where %I = %L', tbl,
    case tbl when 'households' then 'id' else 'household_id' end,
    'aaaaaaaa-0000-0000-0000-000000000001') into n;
  return n;
end;
$$;

-- select: owner and caregiver (viewer and stranger were in 03) --------------------
select pg_temp.login(1);
select is(pg_temp.visible('households'), 1, 'households select: owner sees theirs');
select is(pg_temp.visible('memberships'), 3, 'memberships select: owner sees all three members');
select is(pg_temp.visible('babies'), 1, 'babies select: owner sees theirs');
select is(pg_temp.visible('events'), 1, 'events select: owner sees theirs');
select pg_temp.login(2);
select is(pg_temp.visible('households'), 1, 'households select: caregiver sees theirs');
select is(pg_temp.visible('memberships'), 3, 'memberships select: caregiver sees all three members');
select is(pg_temp.visible('babies'), 1, 'babies select: caregiver sees theirs');
select is(pg_temp.visible('events'), 1, 'events select: caregiver sees theirs');
select pg_temp.login(4);
select is(pg_temp.visible('invites'), 0, 'invites select: a stranger sees none of household one''s');

-- insert --------------------------------------------------------------------------
select pg_temp.login(1);
select lives_ok($$insert into public.households (id, name, created_by)
  values (gen_random_uuid(), 'n', '00000000-0000-0000-0000-000000000001')$$, 'households insert: owner, as themselves');
select pg_temp.login(2);
select lives_ok($$insert into public.households (id, name, created_by)
  values (gen_random_uuid(), 'n', '00000000-0000-0000-0000-000000000002')$$, 'households insert: caregiver, as themselves');
select pg_temp.login(4);
select lives_ok($$insert into public.households (id, name, created_by)
  values (gen_random_uuid(), 'n', '00000000-0000-0000-0000-000000000004')$$, 'households insert: stranger, as themselves');
select pg_temp.login(2);
select throws_ok($$insert into public.memberships (household_id, user_id, role, display_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'caregiver', 'x')$$,
  '42501', null, 'memberships insert: refused for a caregiver');
select pg_temp.login(3);
select throws_ok($$insert into public.memberships (household_id, user_id, role, display_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'caregiver', 'x')$$,
  '42501', null, 'memberships insert: refused for a viewer');
select pg_temp.login(1);
select lives_ok($$insert into public.babies (id, household_id, name, born_at)
  values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'twin', now())$$, 'babies insert: owner');
select pg_temp.login(3);
select throws_ok($$insert into public.invites (code, household_id, created_by, expires_at)
  values ('STUVWXYZ', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', now() + interval '1 day')$$,
  '42501', null, 'invites insert: refused for a viewer');

-- update --------------------------------------------------------------------------
select pg_temp.login(3);
select isnt_empty($$update public.memberships set display_name = 'Grandad'
  where user_id = '00000000-0000-0000-0000-000000000003' returning user_id$$, 'memberships update: a viewer can change their own display_name');
select is_empty($$update public.memberships set display_name = 'x'
  where user_id = '00000000-0000-0000-0000-000000000002' returning user_id$$, 'memberships update: no effect for a viewer on another member');
select pg_temp.login(1);
select isnt_empty($$update public.events set payload = '{"kind":"wet"}', updated_by = '00000000-0000-0000-0000-000000000001'
  where id = 'eeeeeeee-0000-0000-0000-000000000001' returning id$$, 'events update: owner can edit a caregiver''s entry');
select pg_temp.login(2);
select is_empty($$update public.invites set role = 'owner' returning code$$, 'invites update: no effect for a caregiver');
select pg_temp.login(3);
select is_empty($$update public.invites set role = 'owner' returning code$$, 'invites update: no effect for a viewer');
select pg_temp.login(4);
select is_empty($$update public.invites set role = 'owner' returning code$$, 'invites update: no effect for a stranger');
select pg_temp.login(2);
select throws_ok($$update public.push_tokens set user_id = '00000000-0000-0000-0000-000000000004' where device_id = 'phone'$$,
  '42501', null, 'push_tokens update: refused handing yours to someone else');

-- delete: nobody deletes households, babies or events directly (owner was in 03) ---
select pg_temp.login(2);
select is_empty($$delete from public.households returning id$$, 'households delete: no effect for a caregiver');
select is_empty($$delete from public.babies returning id$$, 'babies delete: no effect for a caregiver');
select is_empty($$delete from public.events returning id$$, 'events delete: no effect for a caregiver');
select pg_temp.login(3);
select is_empty($$delete from public.households returning id$$, 'households delete: no effect for a viewer');
select is_empty($$delete from public.babies returning id$$, 'babies delete: no effect for a viewer');
select is_empty($$delete from public.events returning id$$, 'events delete: no effect for a viewer');
select is_empty($$delete from public.invites returning code$$, 'invites delete: no effect for a viewer');
select pg_temp.login(4);
select is_empty($$delete from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'households delete: no effect for a stranger');
select is_empty($$delete from public.babies where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'babies delete: no effect for a stranger');
select is_empty($$delete from public.events where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'events delete: no effect for a stranger');
select is_empty($$delete from public.invites returning code$$, 'invites delete: no effect for a stranger');

-- Everything above left household one as it was.
reset role;
select is((select count(*)::int from public.invites), 1, 'the invite is still there');

select * from finish();
rollback;
