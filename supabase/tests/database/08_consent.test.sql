-- P3-09: explicit consent gates writing health data (SDD 12).
--
-- User 1 owns the household and has consented. User 2 is a caregiver who has
-- not. User 3 consented and then withdrew. User 4 consented to an older
-- version of the policy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'nope@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'withdrawn@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'oldversion@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'one', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'Owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'No'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'caregiver', 'Gone'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'caregiver', 'Old');
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1', now());
insert into public.consents (user_id, policy_version) values
  ('00000000-0000-0000-0000-000000000001', public.consent_version()),
  ('00000000-0000-0000-0000-000000000003', public.consent_version()),
  ('00000000-0000-0000-0000-000000000004', 'an-older-version');
update public.consents set withdrawn_at = now()
  where user_id = '00000000-0000-0000-0000-000000000003';
-- One event already synced, so "reading still works" has something to read.
insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
    client_created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(),
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now());

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.an_event(n int) returns text language sql as $$
  select format($f$insert into public.events
    (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at)
    values ('eeeeeeee-0000-0000-0000-00000000000%s', 'aaaaaaaa-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '%s', '%s', now())$f$,
    n + 4, ('00000000-0000-0000-0000-00000000000' || n)::uuid,
    ('00000000-0000-0000-0000-00000000000' || n)::uuid)
$$;

set local role authenticated;

-- The helper itself --------------------------------------------------------
select pg_temp.login(1);
select ok(public.has_consent(), 'has_consent: true for a current grant');
select pg_temp.login(2);
select ok(not public.has_consent(), 'has_consent: false with no row at all');
select pg_temp.login(3);
select ok(not public.has_consent(), 'has_consent: false once withdrawn');
select pg_temp.login(4);
select ok(not public.has_consent(), 'has_consent: false for an older policy version');

-- Writing ------------------------------------------------------------------
select pg_temp.login(1);
select lives_ok(pg_temp.an_event(1), 'insert: allowed with consent');
select pg_temp.login(2);
select throws_ok(pg_temp.an_event(2), '42501', null, 'insert: refused without consent');
select pg_temp.login(3);
select throws_ok(pg_temp.an_event(3), '42501', null, 'insert: refused after withdrawing');
select pg_temp.login(4);
select throws_ok(pg_temp.an_event(4), '42501', null, 'insert: refused on an older version');

-- Updating and soft deleting someone else's row, which is an update too.
select pg_temp.login(2);
select results_eq(
  $$with u as (update public.events set payload = '{"kind":"wet"}'
      where id = 'eeeeeeee-0000-0000-0000-000000000001' returning 1)
    select count(*)::int from u$$,
  array[0], 'update: no effect without consent');
select results_eq(
  $$with d as (update public.events set deleted_at = now()
      where id = 'eeeeeeee-0000-0000-0000-000000000001' returning 1)
    select count(*)::int from d$$,
  array[0], 'soft delete: no effect without consent');

-- Reading ------------------------------------------------------------------
select isnt_empty($$select 1 from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'select: a caregiver without consent still reads the household');
select pg_temp.login(3);
select isnt_empty($$select 1 from public.events where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'select: withdrawing keeps what is already there readable, for export and deletion');

-- grant_consent ------------------------------------------------------------
select pg_temp.login(2);
select isnt(public.grant_consent(), null, 'grant_consent: returns when it was granted');
select ok(public.has_consent(), 'grant_consent: the caregiver may now write');
select lives_ok(pg_temp.an_event(2), 'insert: allowed once consent is given');
select results_eq(
  $$select policy_version from public.consents where user_id = '00000000-0000-0000-0000-000000000002'$$,
  $$select public.consent_version()$$, 'grant_consent: records the version in force');
select is(
  (select count(*)::int from public.consents where user_id = '00000000-0000-0000-0000-000000000002'),
  1, 'grant_consent: one row per version');
select lives_ok($$select public.grant_consent()$$, 'grant_consent: granting twice is harmless');

-- withdraw_consent ---------------------------------------------------------
select isnt(public.withdraw_consent(), null, 'withdraw_consent: returns when it was withdrawn');
select ok(not public.has_consent(), 'withdraw_consent: writing stops');
select throws_ok(pg_temp.an_event(2), '42501', null, 'insert: refused again after withdrawing');
select is(public.withdraw_consent(), null, 'withdraw_consent: withdrawing twice does nothing');
select isnt(public.grant_consent(), null, 'grant_consent: a withdrawn consent can be given again');
select ok(public.has_consent(), 'grant_consent: and writing works again');

-- One caregiver's choice is their own --------------------------------------
select pg_temp.login(1);
select ok(public.has_consent(), 'the owner is unaffected by another caregiver withdrawing');
select is(
  (select count(*)::int from public.consents where user_id = '00000000-0000-0000-0000-000000000001'),
  1, 'nobody else wrote a row for them');

select * from finish();
rollback;
