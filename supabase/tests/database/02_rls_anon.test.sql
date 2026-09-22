-- RLS is on for every table, every policy is for signed-in users only, and
-- the anon role reads and writes nothing (P2-01, P2-02).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select is(
  (select array_agg(relname::text order by relname) from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity),
  null,
  'every public table has row level security enabled'
);
select is(
  (select array_agg(policyname::text order by policyname) from pg_policies
     where schemaname = 'public' and roles <> '{authenticated}'),
  null,
  'every policy applies to authenticated only'
);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.test');
insert into public.households (id, name, created_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'h', '00000000-0000-0000-0000-00000000000a');
insert into public.memberships (household_id, user_id, role, display_name)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'owner', 'A');
insert into public.babies (id, household_id, name, born_at)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'b', now());
insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
    client_created_at)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000b1', 'diaper', now(), '00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000a', now());

set local role anon;
select is_empty('select * from public.households', 'anon: households hidden');
select is_empty('select * from public.memberships', 'anon: memberships hidden');
select is_empty('select * from public.babies', 'anon: babies hidden');
select is_empty('select * from public.events', 'anon: events hidden');
select is_empty('select * from public.invites', 'anon: invites hidden');
select throws_ok(
  $$insert into public.households (id, name, created_by)
    values (gen_random_uuid(), 'x', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'anon: creating a household is refused'
);
select is_empty(
  $$update public.events set payload = '{}' returning id$$,
  'anon: updating an event changes nothing'
);
select throws_ok(
  $$insert into public.consents (user_id, policy_version)
    values ('00000000-0000-0000-0000-00000000000a', 'v1')$$,
  '42501', null, 'anon: writing a consent is refused'
);
select is(auth.uid(), null, 'anon has no user id, so every helper is false for it');
reset role;

select * from finish();
rollback;
