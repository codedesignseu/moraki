-- P2-05: create_household makes the household, the caller as owner and the
-- baby in one transaction, only for a signed-in caller, and a retry is safe.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'parent@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'other@example.test');
-- P3-09: writing an event needs consent for the version in force.
insert into public.consents (user_id, policy_version)
  select id, public.consent_version() from auth.users;
-- P0.2: and the Terms, before any baby data is stored.
insert into public.consent_events (user_id, purpose, version, action, text_key)
  select id, 'terms', public.terms_version(), 'grant', 'test' from auth.users;

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.create(household text, baby text, baby_name text, display_name text,
    weight int default null) returns text language sql as $$
  select format($f$select public.create_household(%L, %L, %L, '2026-10-20T08:00:00Z', %L, 'mother', %s,
    guardian_declared => true, guardian_version => '2026-10-24', locale => 'en')$f$,
    household, baby, baby_name, display_name, coalesce(weight::text, 'null'))
$$;

select ok(not has_function_privilege('anon', 'public.create_household(uuid, uuid, text, timestamptz, text, text, int, boolean, text, text)', 'execute'),
  'anon can''t call create_household');
select ok(has_function_privilege('authenticated', 'public.create_household(uuid, uuid, text, timestamptz, text, text, int, boolean, text, text)', 'execute'),
  'signed-in users can');

set local role authenticated;
select pg_temp.login(1);
select lives_ok(pg_temp.create('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', ' Ella ', ' Maria ', 3400),
  'a signed-in user creates a household with a baby');
select results_eq('select name, created_by from public.households',
  $$values ('Ella', '00000000-0000-0000-0000-000000000001'::uuid)$$,
  'the household is theirs, named after the baby');
select results_eq('select role::text, display_name, relation from public.memberships',
  $$values ('owner', 'Maria', 'mother')$$, 'they are its owner, with their name trimmed');
select ok(public.is_owner('aaaaaaaa-0000-0000-0000-000000000001'), 'is_owner agrees');
select results_eq('select id, name, born_at, birth_weight_g from public.babies',
  $$values ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'Ella', '2026-10-20T08:00:00Z'::timestamptz, 3400)$$,
  'the baby exists, with the details given');
select is_empty('select * from public.events', 'an empty baby: no events');
-- P0.1: the creator declared they are the parent or guardian, on record.
select ok((select is_guardian from public.memberships), 'the creator is marked as a guardian');
select results_eq(
  $$select purpose, version, action, locale, household_id, baby_id from public.consent_events
    where purpose = 'guardian_declaration'$$,
  $$values ('guardian_declaration', '2026-10-24', 'grant', 'en',
            'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid)$$,
  'and the declaration is recorded, for this household and baby');

-- Retrying after a lost response is harmless.
select lives_ok(pg_temp.create('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ella', 'Maria'),
  'a retry with the same ids succeeds');
select is((select count(*)::int from public.babies), 1, 'and makes nothing twice');

-- Someone else can't claim that id, or see it.
select pg_temp.login(2);
select throws_ok(pg_temp.create('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid()::text, 'Leo', 'Nik'),
  '23505', null, 'another user can''t reuse the household id');
select is_empty('select * from public.households', 'and still sees nothing of it');

-- All or nothing.
select throws_ok(pg_temp.create('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '  ', 'Nik'),
  '23502', null, 'a blank baby name is refused');
select throws_ok(pg_temp.create('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Leo', repeat('n', 41)),
  '23514', null, 'a display name over 40 characters is refused');
select throws_ok(pg_temp.create('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Leo', 'Nik', 400),
  '23514', null, 'a birth weight under 500 g is refused');
reset role;
select is((select count(*)::int from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'a refused call leaves no household or membership behind');

-- P0.1: no declaration, no household.
set local role authenticated;
select pg_temp.login(2);
select throws_ok(
  $$select public.create_household(gen_random_uuid(), gen_random_uuid(), 'Leo', now(), 'Nik')$$,
  'MK001', null, 'without the guardian declaration, create_household is refused');
select throws_ok(
  $$select public.create_household(gen_random_uuid(), gen_random_uuid(), 'Leo', now(), 'Nik',
    guardian_declared => false, guardian_version => '2026-10-24')$$,
  'MK001', null, 'and with it explicitly false');
select throws_ok(
  $$select public.create_household(gen_random_uuid(), gen_random_uuid(), 'Leo', now(), 'Nik',
    guardian_declared => true)$$,
  '22023', null, 'the declaration needs the version of its text');
reset role;
select is((select count(*)::int from public.households where created_by = '00000000-0000-0000-0000-000000000002'), 0,
  'a refused declaration leaves nothing behind');

-- Signed out, nothing happens.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(pg_temp.create(gen_random_uuid()::text, gen_random_uuid()::text, 'Leo', 'Nik'),
  '42501', null, 'without a user, create_household is refused');
reset role;

select * from finish();
rollback;
