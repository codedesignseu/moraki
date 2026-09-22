-- P2-06: an owner makes an invite; someone signed in redeems it once and
-- joins with the invite's role. Household one is user 1's (owner), user 2 is
-- a caregiver in it; users 3 and 4 are outsiders.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'carer@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'joiner@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'other@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ella', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Maria'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Nik');
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now());

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;

-- Who may call what.
select ok(not has_function_privilege('anon', 'public.create_invite(uuid, public.member_role)', 'execute'),
  'anon can''t create an invite');
select ok(not has_function_privilege('anon', 'public.accept_invite(text, text, text)', 'execute'),
  'anon can''t accept an invite');
select ok(not has_function_privilege('authenticated', 'public.joined_household(uuid, uuid)', 'execute'),
  'joined_household is internal to accept_invite');

-- The code itself.
select col_has_check('public', 'invites', 'code', 'the code is checked');
select throws_ok(
  $$insert into public.invites (code, household_id, created_by, expires_at)
    values ('ABCDEFGI', 'aaaaaaaa-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001', now() + interval '1 day')$$,
  '23514', null, 'a code with a look-alike character (I) is refused');
select throws_ok(
  $$insert into public.invites (code, household_id, role, created_by, expires_at)
    values ('ABCDEFGH', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner',
      '00000000-0000-0000-0000-000000000001', now() + interval '1 day')$$,
  '23514', null, 'an invite can''t make another owner');

set local role authenticated;

-- Only the owner can create one (the invites insert policy decides).
select pg_temp.login(2);
select throws_ok($$select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, 'a caregiver can''t create an invite');
select pg_temp.login(4);
select throws_ok($$select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, 'a stranger can''t create an invite for someone else''s household');

select pg_temp.login(1);
create temp table made as select * from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001');
select matches((select code from made), '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
  'the owner gets an 8 character code with no look-alikes');
select ok((select expires_at from made) between now() + interval '6 days' and now() + interval '8 days',
  'it works for about a week');
select results_eq(
  $$select role::text, created_by from public.invites$$,
  $$values ('caregiver', '00000000-0000-0000-0000-000000000001'::uuid)$$,
  'it invites a caregiver by default, from the owner');
select is((select count(distinct code)::int from (
    select code from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001') union all
    select code from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001') union all
    select code from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')) codes),
  3, 'every invite gets its own code');

-- Accepting.
select pg_temp.login(3);
select results_eq(
  format($$select household_id, role::text, baby_id, baby_name from public.accept_invite(%L, ' Yiayia ', 'grandparent')$$,
    (select code from made)),
  $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'caregiver',
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'Ella')$$,
  'the joiner gets the household, their role and the baby back');
select results_eq(
  $$select role::text, display_name, relation from public.memberships
    where user_id = '00000000-0000-0000-0000-000000000003'$$,
  $$values ('caregiver', 'Yiayia', 'grandparent')$$,
  'they are a member with the invite''s role, their name trimmed');
select ok(public.is_member('aaaaaaaa-0000-0000-0000-000000000001')
  and public.can_write('aaaaaaaa-0000-0000-0000-000000000001')
  and not public.is_owner('aaaaaaaa-0000-0000-0000-000000000001'),
  'a caregiver invite makes a writer, not an owner');
select isnt_empty($$select id from public.babies where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'and they can now see the baby');
reset role; -- invites are the owner's to read; check the row itself
select results_eq(format($$select used_by from public.invites where code = %L$$, (select code from made)),
  $$values ('00000000-0000-0000-0000-000000000003'::uuid)$$, 'the invite records who used it');
set local role authenticated;
select pg_temp.login(3);

-- Retrying the same accept is harmless; anyone else is refused.
select lives_ok(format($$select public.accept_invite(%L, 'Yiayia')$$, (select code from made)),
  'the same person retrying gets the same answer');
reset role;
select is((select count(*)::int from public.memberships), 3, 'and joins only once');
set local role authenticated;
select pg_temp.login(4);
select throws_ok(format($$select public.accept_invite(%L, 'Nobody')$$, (select code from made)),
  'MKI02', null, 'a used code is refused');
reset role;
select is((select count(*)::int from public.memberships), 3, 'and nobody else is added');
set local role authenticated;

-- Codes that don't work.
select throws_ok($$select public.accept_invite('ZZZZZZZZ', 'Nobody')$$, 'MKI01', null,
  'an unknown code is refused');
reset role; -- an expired invite, made before it ran out
insert into public.invites (code, household_id, created_by, expires_at) values
  ('EXPRDAB2', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   now() - interval '1 minute');
set local role authenticated;
select pg_temp.login(4);
select throws_ok($$select public.accept_invite('EXPRDAB2', 'Nobody')$$, 'MKI03', null,
  'an expired code is refused');

-- One household per account for now.
select pg_temp.login(1);
create temp table fresh as select * from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001', 'viewer');
select pg_temp.login(2);
select throws_ok(format($$select public.accept_invite(%L, 'Nik')$$, (select code from fresh)),
  'MKI04', null, 'someone already in a household is refused');

-- A viewer invite makes a viewer.
select pg_temp.login(4);
select results_eq(
  format($$select role::text from public.accept_invite(%L, 'Watcher')$$, (select code from fresh)),
  $$values ('viewer')$$, 'a viewer invite makes a viewer');
select ok(public.is_member('aaaaaaaa-0000-0000-0000-000000000001')
  and not public.can_write('aaaaaaaa-0000-0000-0000-000000000001'),
  'who can read but not write');
select throws_ok(
  $$insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
      client_created_at)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(),
      '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', now())$$,
  '42501', null, 'and still can''t log anything');

-- Typing the code loosely still works.
select pg_temp.login(1);
create temp table loose as select * from public.create_invite('aaaaaaaa-0000-0000-0000-000000000001');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000005', 'five@example.test');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select lives_ok(
  format($$select public.accept_invite(%L, 'Five')$$,
    lower(substr((select code from loose), 1, 4)) || '-' || lower(substr((select code from loose), 5, 4))),
  'lower case with a dash is the same code');

-- Signed out, nothing happens.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.accept_invite('ZZZZZZZZ', 'Nobody')$$, '42501', null,
  'without a user, accepting is refused');
select throws_ok($$select public.create_invite('aaaaaaaa-0000-0000-0000-000000000001')$$, '42501', null,
  'without a user, creating an invite is refused');
reset role;

select is((select count(*)::int from public.memberships
    where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 5,
  'the household ends with its owner, two caregivers, a viewer and the last joiner');

select * from finish();
rollback;
