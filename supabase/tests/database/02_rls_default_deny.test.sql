-- P2-01: RLS is on for every table, with no policies yet, so client roles see
-- and change nothing until P2-02 adds the SDD 4.3 policies.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is(
  (select array_agg(relname::text order by relname) from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity),
  null,
  'every public table has row level security enabled'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public'),
  0,
  'no policies yet (P2-02)'
);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.test');
insert into public.households (id, name, created_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'h', '00000000-0000-0000-0000-00000000000a');
insert into public.memberships (household_id, user_id, role, display_name)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'owner', 'A');
insert into public.babies (id, household_id, name, born_at)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'b', now());

-- Even the household's own owner, signed in, sees nothing yet.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is_empty('select * from public.households', 'signed in: households hidden');
select is_empty('select * from public.memberships', 'signed in: memberships hidden');
select is_empty('select * from public.babies', 'signed in: babies hidden');
select throws_ok(
  $$insert into public.events (id, household_id, baby_id, type, occurred_at, created_by,
      updated_by, client_created_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000b1', 'diaper', now(),
      '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', now())$$,
  '42501', null, 'signed in: inserting an event is refused'
);
select throws_ok(
  $$insert into public.households (id, name, created_by)
    values (gen_random_uuid(), 'x', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'signed in: creating a household directly is refused'
);
select is_empty(
  $$update public.households set name = 'x' returning id$$,
  'signed in: updating a household changes nothing'
);
reset role;

set local role anon;
select is_empty('select * from public.households', 'anonymous: households hidden');
select is_empty('select * from public.events', 'anonymous: events hidden');
select is_empty('select * from public.invites', 'anonymous: invites hidden');
select throws_ok(
  $$insert into public.consents (user_id, policy_version)
    values ('00000000-0000-0000-0000-00000000000a', 'v1')$$,
  '42501', null, 'anonymous: writing a consent is refused'
);
reset role;

select * from finish();
rollback;
