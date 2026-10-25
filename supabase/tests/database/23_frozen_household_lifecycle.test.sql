-- Legal update round 2, decision 1: a household frozen for 90 days is warned
-- by email; 30 days after the warning, still frozen, it is deleted. A
-- guardian agreeing again voids the warning.
--
-- Warning (warn_frozen_households):
--   1 frozen 91 days, owner and a caregiver     -> warned, two emails queued
--   2 frozen 80 days                            -> not warned yet
--   3 frozen, first seen today                  -> clock starts now, not warned
--   4 not frozen (guardian consents), stale clock -> clock cleared
--   5 warned and queued, then the owner agrees again -> void at once
--   6 warned and queued, then a consenting caregiver declares as guardian -> void
-- Deletion (sweep_frozen_households):
--   11 warned 31 days ago, sent, date come      -> deleted, logged as frozen
--   12 warned 10 days ago, sent                 -> kept: warning too recent
--   13 warned 31 days ago, claimed, never sent  -> kept: nobody was told
--   14 warned 31 days ago, sent, date tomorrow  -> kept: the date it named
--   15 warned 31 days ago, no member address    -> deleted
--   16 warned 31 days ago, sent, owner agreed again today -> kept, clock cleared
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

create function pg_temp.id(prefix text, n int) returns uuid language sql as $$
  select (prefix || '-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- A household whose only member is its owner, a guardian; frozen, by the
-- owner withdrawing, unless `consenting` (20261026090000: only an explicit
-- withdrawal starts the clock). Everyone signed in just now, so inactivity
-- never applies.
create function pg_temp.household(n int, consenting boolean default false, email text default 'set')
returns void language plpgsql as $$
declare
  h uuid := pg_temp.id('aaaaaaaa', n);
  u uuid := pg_temp.id('00000000', n);
begin
  insert into auth.users (id, email, last_sign_in_at)
    values (u, case when email = 'set' then 'u' || n || '@example.test' end, now());
  insert into public.households (id, name, created_by) values (h, 'H' || n, u);
  insert into public.memberships (household_id, user_id, role, display_name, is_guardian)
    values (h, u, 'owner', 'Owner', true);
  insert into public.babies (id, household_id, name, born_at) values (gen_random_uuid(), h, 'b', now());
  if consenting then
    insert into public.consents (user_id, policy_version) values (u, public.consent_version());
  else
    insert into public.consents (user_id, policy_version, withdrawn_at)
      values (u, public.consent_version(), now());
    insert into public.consent_events (user_id, purpose, version, action, text_key)
      values (u, 'health_data', public.consent_version(), 'withdraw', 'consent');
  end if;
end
$$;

create function pg_temp.clock(n int, since interval, warned interval default null) returns void
language sql as $$
  update public.households
  set frozen_since = now() - since, frozen_warned_at = now() - warned
  where id = pg_temp.id('aaaaaaaa', n)
$$;

create function pg_temp.queue(n int, warned interval, sent boolean, delete_on date) returns void
language sql as $$
  insert into public.inactivity_warning_emails
    (household_id, user_id, kind, warned_at, claimed_at, sent_at, delete_on)
  values (pg_temp.id('aaaaaaaa', n), pg_temp.id('00000000', n), 'frozen', now() - warned,
          now() - warned, case when sent then now() - warned end, delete_on)
$$;

create function pg_temp.since(n int) returns timestamptz language sql as $$
  select frozen_since from public.households where id = pg_temp.id('aaaaaaaa', n)
$$;
create function pg_temp.warned(n int) returns timestamptz language sql as $$
  select frozen_warned_at from public.households where id = pg_temp.id('aaaaaaaa', n)
$$;
create function pg_temp.queued(n int) returns int language sql as $$
  select count(*)::int from public.inactivity_warning_emails
  where household_id = pg_temp.id('aaaaaaaa', n) and kind = 'frozen'
$$;
create function pg_temp.left(n int) returns int language sql as $$
  select count(*)::int from public.households where id = pg_temp.id('aaaaaaaa', n)
$$;
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'UTC')::date $$;
create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', pg_temp.id('00000000', n), 'role', 'authenticated')::text, true)::void
$$;

-- Who may run what ----------------------------------------------------------
select ok((select count(*)::int from cron.job where jobname = 'warn-frozen-households'
           and command = 'select public.warn_frozen_households()') = 1, 'the warning is scheduled once');
select ok((select count(*)::int from cron.job where jobname = 'sweep-frozen-households'
           and command = 'select public.sweep_frozen_households()') = 1, 'the sweep is scheduled once');
select ok((select count(distinct schedule)::int from cron.job) = (select count(*)::int from cron.job),
  'no two jobs share a time');
select ok(not has_function_privilege('authenticated', 'public.warn_frozen_households()', 'execute')
  and not has_function_privilege('authenticated', 'public.sweep_frozen_households()', 'execute'),
  'a signed-in user can''t warn or sweep');
select ok(not has_function_privilege('authenticated', 'public.claim_household_warnings(integer)', 'execute')
  and not has_function_privilege('anon', 'public.claim_household_warnings(integer)', 'execute'),
  'nor read the queue of addresses');
select ok(has_function_privilege('service_role', 'public.claim_household_warnings(integer)', 'execute'),
  'the Edge Function, with the service role, can');
select ok(not has_function_privilege('authenticated', 'public.clear_frozen_clock(uuid)', 'execute'),
  'nobody stops the clock by hand');

-- The owner can't move the clock -------------------------------------------------
select pg_temp.household(4, consenting => true);
set local role authenticated;
select pg_temp.login(4);
select throws_ok(
  $$ update public.households set frozen_since = now() - interval '1 year'
     where id = 'aaaaaaaa-0000-0000-0000-000000000004' $$,
  '23514', null, 'an owner can''t set frozen_since');
reset role;
select set_config('request.jwt.claims', '', true);

-- Warning -------------------------------------------------------------------------
select pg_temp.household(1);
insert into auth.users (id, email) values (pg_temp.id('00000000', 101), 'u101@example.test');
insert into public.memberships (household_id, user_id, role, display_name)
  values (pg_temp.id('aaaaaaaa', 1), pg_temp.id('00000000', 101), 'caregiver', 'Carer');
select pg_temp.clock(1, interval '91 days');
select pg_temp.household(2);
select pg_temp.clock(2, interval '80 days');
select pg_temp.household(3);
select pg_temp.clock(4, interval '100 days');

select is(public.warn_frozen_households(), 1, 'one household is newly warned: 1');
select is(pg_temp.warned(1), now(), 'frozen 91 days: warned now');
select is(pg_temp.queued(1), 2, 'and an email queued for each member');
select is(pg_temp.warned(2), null, 'frozen 80 days: not yet');
select is(pg_temp.since(2), now() - interval '80 days', 'its clock runs on');
select is(pg_temp.since(3), now(), 'newly found frozen: the clock starts now');
select is(pg_temp.warned(3), null, 'and nobody is warned');
select is(pg_temp.since(4), null, 'not frozen: a stale clock is cleared');
select is((select count(*)::int from public.inactivity_warning_emails where kind = 'inactivity'), 0,
  'no inactivity email is queued for a household in use');

select is(public.warn_frozen_households(), 0, 'a second run warns nobody');
select is(pg_temp.queued(1), 2, 'and queues nothing twice');

-- Claiming: the new claim hands out both kinds, the old one only inactivity.
select is((select count(*)::int from public.claim_inactivity_warnings(50)), 0,
  'the old claim never hands out a frozen-household email');
select is((select string_agg(kind || ':' || (delete_on = pg_temp.today() + 31), ',')
           from public.claim_household_warnings(50)), 'frozen:true,frozen:true',
  'the new claim does, marked frozen, dated 31 days on');
select is((select count(*)::int from public.claim_household_warnings(50)), 0, 'and only once');

-- Agreeing again voids the warning ------------------------------------------------
select pg_temp.household(5);
select pg_temp.clock(5, interval '100 days', interval '5 days');
select pg_temp.queue(5, interval '5 days', true, pg_temp.today() + 26);
set local role authenticated;
select pg_temp.login(5);
select isnt(public.grant_consent(), null, 'the owner of 5 agrees again');
reset role;
select set_config('request.jwt.claims', '', true);
select is(pg_temp.since(5), null, 'the household is no longer frozen: clock cleared at once');
select is(pg_temp.warned(5), null, 'and the warning void');
select is(pg_temp.queued(5), 0, 'and its emails gone');

select pg_temp.household(6);
insert into auth.users (id, email) values (pg_temp.id('00000000', 106), 'u106@example.test');
insert into public.memberships (household_id, user_id, role, display_name)
  values (pg_temp.id('aaaaaaaa', 6), pg_temp.id('00000000', 106), 'caregiver', 'Carer');
insert into public.consents (user_id, policy_version) values (pg_temp.id('00000000', 106), public.consent_version());
select pg_temp.clock(6, interval '100 days', interval '5 days');
select pg_temp.queue(6, interval '5 days', true, pg_temp.today() + 26);
update public.memberships set is_guardian = true
  where household_id = pg_temp.id('aaaaaaaa', 6) and user_id = pg_temp.id('00000000', 106);
select is(pg_temp.warned(6), null, 'a consenting member declaring as guardian voids it too');
select is(pg_temp.queued(6), 0, 'with its emails');

-- Deletion --------------------------------------------------------------------------
select pg_temp.household(11);
select pg_temp.clock(11, interval '121 days', interval '31 days');
select pg_temp.queue(11, interval '31 days', true, pg_temp.today());
select pg_temp.household(12);
select pg_temp.clock(12, interval '100 days', interval '10 days');
select pg_temp.queue(12, interval '10 days', true, pg_temp.today() - 21);
select pg_temp.household(13);
select pg_temp.clock(13, interval '121 days', interval '31 days');
select pg_temp.queue(13, interval '31 days', false, null);
select pg_temp.household(14);
select pg_temp.clock(14, interval '121 days', interval '31 days');
select pg_temp.queue(14, interval '31 days', true, pg_temp.today() + 1);
select pg_temp.household(15, email => null);
select pg_temp.clock(15, interval '121 days', interval '31 days');
select pg_temp.household(16);
select pg_temp.clock(16, interval '121 days', interval '31 days');
select pg_temp.queue(16, interval '31 days', true, pg_temp.today());
update public.consents set withdrawn_at = null where user_id = pg_temp.id('00000000', 16);

select is(public.sweep_frozen_households(), 2, 'two households are deleted: 11 and 15');
select is(pg_temp.left(11), 0, 'frozen, warned 31 days ago, told, date come: deleted');
select is((select reason from public.erasure_log where subject_id = pg_temp.id('aaaaaaaa', 11)), 'frozen',
  'and logged as a frozen-household deletion');
select is((select count(*)::int from public.babies where household_id = pg_temp.id('aaaaaaaa', 11)), 0,
  'with everything in it');
select is(pg_temp.left(12), 1, 'warned 10 days ago: kept');
select is(pg_temp.left(13), 1, 'email never sent: kept');
select is(pg_temp.left(14), 1, 'the date named is tomorrow: kept');
select is(pg_temp.left(15), 0, 'nobody to email, warned 31 days ago: deleted');
select is(pg_temp.left(16), 1, 'a guardian agreed again: kept');
select is(pg_temp.warned(16), null, 'with its warning void');
select is(public.sweep_frozen_households(), 0, 'a second sweep deletes nothing more');

select * from finish();
rollback;
