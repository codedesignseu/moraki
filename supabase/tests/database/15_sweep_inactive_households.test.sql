-- docs/compliance/retention.md: a household unused for 24 months is deleted.
--
-- Every household starts fully idle: created, joined, its baby changed, its
-- one entry written and its member last signed in, all 30 months ago. Each
-- then gets at most one recent sign of life, so each assertion tests one
-- signal on its own.
--   1 idle                         -> deleted, with everything under it
--   2 an entry written yesterday   -> kept
--   3 a member signed in last month-> kept
--   4 an entry exactly at the limit-> kept (the boundary counts as activity)
--   5 an entry a minute past it    -> deleted
--   6 a session refreshed lately   -> kept (stays signed in, never signs in again)
--   7 created last week            -> kept
--   8 the baby's details changed   -> kept
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.id(prefix text, n int) returns uuid language sql as $$
  select (prefix || '-0000-0000-0000-00000000000' || n)::uuid
$$;

create function pg_temp.idle_household(n int) returns void language plpgsql as $$
declare
  long_ago timestamptz := now() - interval '30 months';
  h uuid := pg_temp.id('aaaaaaaa', n);
  u uuid := pg_temp.id('00000000', n);
  b uuid := pg_temp.id('bbbbbbbb', n);
begin
  insert into auth.users (id, email, last_sign_in_at) values (u, 'u' || n || '@example.test', long_ago);
  insert into public.households (id, name, created_by, created_at) values (h, 'H' || n, u, long_ago);
  insert into public.memberships (household_id, user_id, role, display_name, joined_at)
    values (h, u, 'owner', 'Owner', long_ago);
  insert into public.babies (id, household_id, name, born_at, updated_at)
    values (b, h, 'b', long_ago, long_ago);
  insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
      client_created_at)
    values (pg_temp.id('eeeeeeee', n), h, b, 'diaper', long_ago, u, u, long_ago);
  perform pg_temp.entry_written(n, long_ago);
end
$$;

-- events_stamp_seq sets server_updated_at on every write, so a past one
-- can only be set with that trigger off. Rolled back with the test.
create function pg_temp.entry_written(n int, at timestamptz) returns void language plpgsql as $$
begin
  alter table public.events disable trigger events_stamp_seq;
  update public.events set server_updated_at = at where id = pg_temp.id('eeeeeeee', n);
  alter table public.events enable trigger events_stamp_seq;
end
$$;

create function pg_temp.households_left(n int) returns int language sql as $$
  select count(*)::int from public.households where id = pg_temp.id('aaaaaaaa', n)
$$;

select has_function('public', 'sweep_inactive_households', 'the inactivity sweep exists');
select ok(
  (select count(*)::int from cron.job
   where jobname = 'sweep-inactive-households' and command = 'select public.sweep_inactive_households()') = 1,
  'the sweep is scheduled once, not just callable by hand');
select ok(not has_function_privilege('authenticated', 'public.sweep_inactive_households()', 'execute'),
  'nothing but the schedule may run it');

select pg_temp.idle_household(n) from generate_series(1, 8) n;
insert into public.invites (code, household_id, created_by, expires_at) values
  ('ABCDEFGH', pg_temp.id('aaaaaaaa', 1), pg_temp.id('00000000', 1), now() - interval '29 months');

select pg_temp.entry_written(2, now() - interval '1 day');
update auth.users set last_sign_in_at = now() - interval '1 month' where id = pg_temp.id('00000000', 3);
select pg_temp.entry_written(4, now() - interval '24 months');
select pg_temp.entry_written(5, now() - interval '24 months' - interval '1 minute');
insert into auth.sessions (id, user_id, created_at, updated_at) values
  (gen_random_uuid(), pg_temp.id('00000000', 6), now() - interval '25 months', now() - interval '2 days');
update public.households set created_at = now() - interval '7 days' where id = pg_temp.id('aaaaaaaa', 7);
update public.babies set updated_at = now() - interval '3 months' where id = pg_temp.id('bbbbbbbb', 8);

select is(public.sweep_inactive_households(), 2, 'two households are swept: 1 and 5');

select is(pg_temp.households_left(1), 0, 'an idle household is deleted');
select is((select count(*)::int from public.babies where household_id = pg_temp.id('aaaaaaaa', 1)), 0,
  'its baby goes with it');
select is((select count(*)::int from public.events where household_id = pg_temp.id('aaaaaaaa', 1)), 0,
  'its entries go with it');
select is((select count(*)::int from public.memberships where household_id = pg_temp.id('aaaaaaaa', 1)), 0,
  'its memberships go with it');
select is((select count(*)::int from public.invites where household_id = pg_temp.id('aaaaaaaa', 1)), 0,
  'its invites go with it');
select is((select count(*)::int from auth.users where id = pg_temp.id('00000000', 1)), 1,
  'the account itself stays: deleting an account is the person''s own choice');

select is(pg_temp.households_left(2), 1, 'an entry written yesterday keeps a household');
select is(pg_temp.households_left(3), 1, 'a member signing in last month keeps a household');
select is(pg_temp.households_left(4), 1, 'an entry exactly at the limit still counts as activity');
select is(pg_temp.households_left(5), 0, 'an entry a minute past the limit does not');
select is(pg_temp.households_left(6), 1, 'a session refreshed lately keeps a household');
select is(pg_temp.households_left(7), 1, 'a household created last week is kept');
select is(pg_temp.households_left(8), 1, 'a baby''s details changed lately keep a household');
select is((select count(*)::int from public.events where household_id = pg_temp.id('aaaaaaaa', 2)), 1,
  'a kept household keeps its entries');

select is(public.sweep_inactive_households(), 0, 'running it again deletes nothing more');

select * from finish();
rollback;
