-- P2-02: every cell of SDD table 4.3, for each kind of user.
--
-- Household one: user 1 owner, user 2 caregiver, user 3 viewer.
-- Household two: user 4 owner (a stranger to household one).
-- "Refused" means an error; "no effect" means RLS filtered the row away, so
-- the statement ran and changed nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(89);

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
-- P3-09: writing an event needs consent for the version in force.
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
insert into public.push_tokens (user_id, device_id, token, platform) values
  ('00000000-0000-0000-0000-000000000002', 'phone', 't2', 'android'),
  ('00000000-0000-0000-0000-000000000004', 'phone', 't4', 'ios');

-- Signs in as user n for the rest of the transaction, or until the next call.
create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
set local role authenticated;

-- Helpers ------------------------------------------------------------------
select pg_temp.login(1);
select ok(public.is_member('aaaaaaaa-0000-0000-0000-000000000001')
  and public.can_write('aaaaaaaa-0000-0000-0000-000000000001')
  and public.is_owner('aaaaaaaa-0000-0000-0000-000000000001'), 'helpers: the owner is member, writer, owner');
select ok(not public.is_member('aaaaaaaa-0000-0000-0000-000000000002'), 'helpers: the owner of one is not a member of two');
select pg_temp.login(2);
select ok(public.can_write('aaaaaaaa-0000-0000-0000-000000000001')
  and not public.is_owner('aaaaaaaa-0000-0000-0000-000000000001'), 'helpers: a caregiver writes but does not own');
select pg_temp.login(3);
select ok(public.is_member('aaaaaaaa-0000-0000-0000-000000000001')
  and not public.can_write('aaaaaaaa-0000-0000-0000-000000000001'), 'helpers: a viewer is a member who cannot write');

-- households: select member ---------------------------------------------------
select pg_temp.login(3);
select results_eq('select name from public.households', $$values ('one')$$, 'households select: a viewer sees their household only');
select pg_temp.login(4);
select results_eq('select name from public.households', $$values ('two')$$, 'households select: a stranger sees only their own');

-- households: insert any signed-in user, as themselves -------------------------
select pg_temp.login(3);
select lives_ok($$insert into public.households (id, name, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000009', 'new', '00000000-0000-0000-0000-000000000003')$$,
  'households insert: any signed-in user can create one as themselves');
select throws_ok($$insert into public.households (id, name, created_by)
  values (gen_random_uuid(), 'new', '00000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'households insert: refused in someone else''s name');
select is_empty($$select id from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000009'$$,
  'households insert: the creator sees it only once create_household makes them a member (P2-05)');

-- households: update owner -------------------------------------------------------
select pg_temp.login(1);
select isnt_empty($$update public.households set name = 'ours' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'households update: the owner can rename');
select pg_temp.login(2);
select is_empty($$update public.households set name = 'x' returning id$$, 'households update: no effect for a caregiver');
select pg_temp.login(3);
select is_empty($$update public.households set name = 'x' returning id$$, 'households update: no effect for a viewer');
select pg_temp.login(4);
select is_empty($$update public.households set name = 'x' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'households update: no effect for a stranger');
select pg_temp.login(1);
select throws_ok($$update public.households set created_by = '00000000-0000-0000-0000-000000000002'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, '23514', null, 'households update: created_by can''t change');

-- households: delete owner, through RPC only -------------------------------------
select pg_temp.login(1);
select is_empty($$delete from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'households delete: no effect even for the owner (RPC only, P4-06)');

-- memberships: select member -------------------------------------------------------
select pg_temp.login(3);
select results_eq('select display_name from public.memberships order by display_name',
  $$values ('Carer'), ('Owner'), ('Viewer')$$, 'memberships select: a member sees everyone in their household');
select pg_temp.login(4);
select results_eq('select display_name from public.memberships', $$values ('Stranger')$$,
  'memberships select: a stranger sees none of household one');

-- memberships: insert RPC only ------------------------------------------------------
select pg_temp.login(1);
select throws_ok($$insert into public.memberships (household_id, user_id, role, display_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'caregiver', 'x')$$,
  '42501', null, 'memberships insert: refused even for the owner (accept_invite, create_household)');
select pg_temp.login(4);
select throws_ok($$insert into public.memberships (household_id, user_id, role, display_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'owner', 'x')$$,
  '42501', null, 'memberships insert: a stranger can''t join by themselves');

-- memberships: update owner, or self for display_name -------------------------------
select pg_temp.login(1);
select isnt_empty($$update public.memberships set role = 'caregiver'
  where user_id = '00000000-0000-0000-0000-000000000003' returning user_id$$, 'memberships update: the owner can change a role');
update public.memberships set role = 'viewer' where user_id = '00000000-0000-0000-0000-000000000003';
select pg_temp.login(2);
select isnt_empty($$update public.memberships set display_name = 'Nana'
  where user_id = '00000000-0000-0000-0000-000000000002' returning user_id$$, 'memberships update: self can change display_name');
select throws_ok($$update public.memberships set role = 'owner' where user_id = '00000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'memberships update: self can''t change their own role');
select throws_ok($$update public.memberships set relation = 'mother' where user_id = '00000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'memberships update: self can''t change their relation (owner only)');
select is_empty($$update public.memberships set display_name = 'x'
  where user_id = '00000000-0000-0000-0000-000000000003' returning user_id$$, 'memberships update: no effect on another member''s row');
select pg_temp.login(4);
select is_empty($$update public.memberships set display_name = 'x'
  where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning user_id$$, 'memberships update: no effect for a stranger');
select pg_temp.login(1);
select throws_ok($$update public.memberships set household_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where user_id = '00000000-0000-0000-0000-000000000003'$$, '23514', null, 'memberships update: household_id can''t change');
select throws_ok($$update public.memberships set user_id = '00000000-0000-0000-0000-000000000004'
  where user_id = '00000000-0000-0000-0000-000000000003'$$, '23514', null, 'memberships update: user_id can''t change');

-- babies: select member -------------------------------------------------------------
select pg_temp.login(3);
select results_eq('select name from public.babies', $$values ('b1')$$, 'babies select: a viewer sees their household''s baby');
select pg_temp.login(4);
select results_eq('select name from public.babies', $$values ('b2')$$, 'babies select: a stranger sees only their own');

-- babies: insert writer --------------------------------------------------------------
select pg_temp.login(2);
select lives_ok($$insert into public.babies (id, household_id, name, born_at)
  values ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'twin', now())$$,
  'babies insert: a caregiver can add a baby');
select pg_temp.login(3);
select throws_ok($$insert into public.babies (id, household_id, name, born_at)
  values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'x', now())$$,
  '42501', null, 'babies insert: refused for a viewer');
select pg_temp.login(4);
select throws_ok($$insert into public.babies (id, household_id, name, born_at)
  values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'x', now())$$,
  '42501', null, 'babies insert: refused for a stranger');

-- babies: update writer ---------------------------------------------------------------
select pg_temp.login(2);
select isnt_empty($$update public.babies set name = 'Ella' where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$,
  'babies update: a caregiver can edit');
select pg_temp.login(1);
select isnt_empty($$update public.babies set deleted_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000000009' returning id$$,
  'babies update: the owner can soft delete');
select pg_temp.login(3);
select is_empty($$update public.babies set name = 'x' returning id$$, 'babies update: no effect for a viewer');
select pg_temp.login(4);
select is_empty($$update public.babies set name = 'x' where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning id$$,
  'babies update: no effect for a stranger');
select pg_temp.login(4);
select throws_ok($$update public.babies set household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, '23514', null,
  'babies update: household_id can''t change');

-- babies: delete never -----------------------------------------------------------------
select pg_temp.login(1);
select is_empty($$delete from public.babies returning id$$, 'babies delete: no effect even for the owner (soft delete only)');

-- events: select member ------------------------------------------------------------------
select pg_temp.login(3);
select results_eq('select id from public.events', $$values ('eeeeeeee-0000-0000-0000-000000000001'::uuid)$$,
  'events select: a viewer sees their household''s events');
select pg_temp.login(4);
select results_eq('select id from public.events', $$values ('eeeeeeee-0000-0000-0000-000000000002'::uuid)$$,
  'events select: a stranger sees only their own household''s');

-- events: insert writer, created_by = auth.uid() -----------------------------------------
create function pg_temp.event_sql(id text, household text, baby text, created_by text, updated_by text)
returns text language sql as $$
  select format($f$insert into public.events (id, household_id, baby_id, type, occurred_at,
    created_by, updated_by, client_created_at) values (%L, %L, %L, 'diaper', now(), %L, %L, now())$f$,
    id, household, baby, created_by, updated_by)
$$;
select pg_temp.login(2);
select lives_ok(pg_temp.event_sql('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  'events insert: a caregiver can log as themselves');
select pg_temp.login(1);
select lives_ok(pg_temp.event_sql('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  'events insert: the owner can log as themselves');
select pg_temp.login(2);
select throws_ok(pg_temp.event_sql(gen_random_uuid()::text, 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  '42501', null, 'events insert: refused with created_by someone else');
select throws_ok(pg_temp.event_sql(gen_random_uuid()::text, 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  '42501', null, 'events insert: refused with updated_by someone else');
select pg_temp.login(3);
select throws_ok(pg_temp.event_sql(gen_random_uuid()::text, 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'),
  '42501', null, 'events insert: refused for a viewer');
select pg_temp.login(4);
select throws_ok(pg_temp.event_sql(gen_random_uuid()::text, 'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004'),
  '42501', null, 'events insert: refused for a stranger');
select throws_ok(pg_temp.event_sql(gen_random_uuid()::text, 'aaaaaaaa-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004'),
  '23503', null, 'events insert: refused for a baby from another household');

-- events: update writer ---------------------------------------------------------------------
select pg_temp.login(2);
select isnt_empty($$update public.events set payload = '{"kind":"wet"}', updated_by = '00000000-0000-0000-0000-000000000002'
  where id = 'eeeeeeee-0000-0000-0000-000000000004' returning id$$, 'events update: a caregiver can edit the owner''s entry');
select throws_ok($$update public.events set payload = '{}', updated_by = '00000000-0000-0000-0000-000000000001'
  where id = 'eeeeeeee-0000-0000-0000-000000000001'$$, '42501', null, 'events update: refused with updated_by someone else');
select isnt_empty($$update public.events set deleted_at = now(), updated_by = '00000000-0000-0000-0000-000000000002'
  where id = 'eeeeeeee-0000-0000-0000-000000000003' returning id$$, 'events update: a caregiver can soft delete');
select pg_temp.login(3);
select is_empty($$update public.events set payload = '{}', updated_by = '00000000-0000-0000-0000-000000000003' returning id$$,
  'events update: no effect for a viewer');
select pg_temp.login(4);
select is_empty($$update public.events set payload = '{}', updated_by = '00000000-0000-0000-0000-000000000004'
  where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$, 'events update: no effect for a stranger');

-- events: columns that never change (P2-F2), for writers ...
select pg_temp.login(2);
select throws_ok($$update public.events set household_id = 'aaaaaaaa-0000-0000-0000-000000000002',
  updated_by = '00000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'events update: household_id can''t change');
select throws_ok($$update public.events set baby_id = 'bbbbbbbb-0000-0000-0000-000000000009',
  updated_by = '00000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'events update: baby_id can''t change, even to a baby in the same household');
select throws_ok($$update public.events set created_by = '00000000-0000-0000-0000-000000000001',
  updated_by = '00000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'events update: created_by can''t change');
select throws_ok($$update public.events set type = 'sleep',
  updated_by = '00000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'events update: type can''t change');
select throws_ok($$update public.events set client_created_at = now() - interval '1 day',
  updated_by = '00000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'events update: client_created_at can''t change');
select throws_ok($$update public.events set id = gen_random_uuid(),
  updated_by = '00000000-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '23514', null, 'events update: id can''t change');

-- events: delete never ------------------------------------------------------------------------
select pg_temp.login(1);
select is_empty($$delete from public.events returning id$$, 'events delete: no effect even for the owner (soft delete only)');

-- invites: select owner ----------------------------------------------------------------------
select pg_temp.login(1);
select results_eq('select code from public.invites', $$values ('ABCDEFGH')$$, 'invites select: the owner sees them');
select pg_temp.login(2);
select is_empty('select code from public.invites', 'invites select: hidden from a caregiver');
select pg_temp.login(3);
select is_empty('select code from public.invites', 'invites select: hidden from a viewer');

-- invites: insert owner ------------------------------------------------------------------------
select pg_temp.login(1);
select lives_ok($$insert into public.invites (code, household_id, created_by, expires_at)
  values ('JKMNPQRS', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() + interval '1 day')$$,
  'invites insert: the owner can create one');
select pg_temp.login(2);
select throws_ok($$insert into public.invites (code, household_id, created_by, expires_at)
  values ('STUVWXYZ', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', now() + interval '1 day')$$,
  '42501', null, 'invites insert: refused for a caregiver');
select pg_temp.login(4);
select throws_ok($$insert into public.invites (code, household_id, created_by, expires_at)
  values ('STUVWXYZ', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', now() + interval '1 day')$$,
  '42501', null, 'invites insert: refused for a stranger');

-- invites: update none ---------------------------------------------------------------------------
select pg_temp.login(1);
select is_empty($$update public.invites set role = 'owner' returning code$$, 'invites update: no effect even for the owner');

-- invites: delete owner ----------------------------------------------------------------------------
select pg_temp.login(2);
select is_empty($$delete from public.invites returning code$$, 'invites delete: no effect for a caregiver');
select pg_temp.login(1);
select isnt_empty($$delete from public.invites where code = 'JKMNPQRS' returning code$$, 'invites delete: the owner can revoke one');

-- consents: self ---------------------------------------------------------------------------------------
select pg_temp.login(2);
select results_eq(
  'select distinct user_id from public.consents',
  $$values ('00000000-0000-0000-0000-000000000002'::uuid)$$,
  'consents select: only your own, whichever versions you granted');
select lives_ok($$insert into public.consents (user_id, policy_version) values ('00000000-0000-0000-0000-000000000002', 'v2')$$,
  'consents insert: for yourself');
select throws_ok($$insert into public.consents (user_id, policy_version) values ('00000000-0000-0000-0000-000000000004', 'v2')$$,
  '42501', null, 'consents insert: refused for someone else');
select isnt_empty($$update public.consents set withdrawn_at = now() where policy_version = 'v1' returning user_id$$,
  'consents update: your own');
select is_empty($$update public.consents set withdrawn_at = now() where user_id = '00000000-0000-0000-0000-000000000004' returning user_id$$,
  'consents update: no effect on someone else''s');
select throws_ok($$update public.consents set user_id = '00000000-0000-0000-0000-000000000004' where policy_version = 'v2'$$,
  '42501', null, 'consents update: refused handing yours to someone else');
select is_empty($$delete from public.consents where user_id = '00000000-0000-0000-0000-000000000004' returning user_id$$,
  'consents delete: no effect on someone else''s');
select isnt_empty($$delete from public.consents where policy_version = 'v2' returning user_id$$, 'consents delete: your own');

-- push_tokens: self ---------------------------------------------------------------------------------------
select pg_temp.login(2);
select results_eq('select token from public.push_tokens', $$values ('t2')$$, 'push_tokens select: only your own');
select lives_ok($$insert into public.push_tokens (user_id, device_id, token, platform)
  values ('00000000-0000-0000-0000-000000000002', 'tablet', 't2b', 'android')$$, 'push_tokens insert: for yourself');
select throws_ok($$insert into public.push_tokens (user_id, device_id, token, platform)
  values ('00000000-0000-0000-0000-000000000004', 'tablet', 'x', 'ios')$$, '42501', null, 'push_tokens insert: refused for someone else');
select isnt_empty($$update public.push_tokens set caregiver_alerts = true where device_id = 'phone' returning token$$,
  'push_tokens update: your own');
select is_empty($$update public.push_tokens set token = 'x' where user_id = '00000000-0000-0000-0000-000000000004' returning token$$,
  'push_tokens update: no effect on someone else''s');
select is_empty($$delete from public.push_tokens where user_id = '00000000-0000-0000-0000-000000000004' returning token$$,
  'push_tokens delete: no effect on someone else''s');
select isnt_empty($$delete from public.push_tokens where device_id = 'tablet' returning token$$, 'push_tokens delete: your own');

-- memberships: delete owner, or self (leave). Last, as it removes access. ---------------------------------------
select pg_temp.login(2);
select is_empty($$delete from public.memberships where user_id = '00000000-0000-0000-0000-000000000003' returning user_id$$,
  'memberships delete: no effect on another member for a caregiver');
select pg_temp.login(4);
select is_empty($$delete from public.memberships where household_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning user_id$$,
  'memberships delete: no effect for a stranger');
select pg_temp.login(3);
select isnt_empty($$delete from public.memberships where user_id = '00000000-0000-0000-0000-000000000003' returning user_id$$,
  'memberships delete: a viewer can leave');
select is_empty('select * from public.events', 'memberships delete: after leaving, the household''s events are hidden');
select pg_temp.login(1);
select isnt_empty($$delete from public.memberships where user_id = '00000000-0000-0000-0000-000000000002' returning user_id$$,
  'memberships delete: the owner can remove a caregiver');

-- The column locks hold for every role, not just clients.
reset role;
select throws_ok($$update public.events set household_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where id = 'eeeeeeee-0000-0000-0000-000000000001'$$, '23514', null,
  'column locks apply to the database owner too');

select * from finish();
rollback;
