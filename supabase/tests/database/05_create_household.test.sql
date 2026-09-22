-- P2-05: create_household makes the household, the caller as owner and the
-- baby in one transaction, only for a signed-in caller, and a retry is safe.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'parent@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'other@example.test');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.create(household text, baby text, baby_name text, display_name text,
    weight int default null) returns text language sql as $$
  select format($f$select public.create_household(%L, %L, %L, '2026-10-20T08:00:00Z', %L, 'mother', %s)$f$,
    household, baby, baby_name, display_name, coalesce(weight::text, 'null'))
$$;

select ok(not has_function_privilege('anon', 'public.create_household(uuid, uuid, text, timestamptz, text, text, int)', 'execute'),
  'anon can''t call create_household');
select ok(has_function_privilege('authenticated', 'public.create_household(uuid, uuid, text, timestamptz, text, text, int)', 'execute'),
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

-- Signed out, nothing happens.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(pg_temp.create(gen_random_uuid()::text, gen_random_uuid()::text, 'Leo', 'Nik'),
  '42501', null, 'without a user, create_household is refused');
reset role;

select * from finish();
rollback;
