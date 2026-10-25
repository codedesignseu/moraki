-- Owner decision 2026-10-24: warn by email at 23 months, delete at 24 months
-- only once the warning is 30 days old, sent, and nobody has used the
-- household since.
--
-- Warning (warn_inactive_households):
--   1 idle 30 months, never warned            -> warned, one email queued
--   2 idle 23 months and a day, two members   -> warned, two emails queued
--   3 idle 22 months                          -> not warned
--   4 warned 10 days ago, idle since          -> left alone (no second warning)
--   5 warned 40 days ago, signed in 5 days ago-> warning void, cleared, not re-warned
--   6 warned 36 months ago, entry 30 months ago, idle since -> void, warned afresh
-- Deletion (sweep_inactive_households), every household idle 30 months:
--   11 warned 31 days ago, email sent, date come     -> deleted
--   12 warned 10 days ago, email sent                -> kept: warning too recent
--   13 never warned                                  -> kept
--   14 warned 31 days ago, member signed in yesterday-> kept: activity after warning
--   15 warned 31 days ago, email claimed, never sent -> kept: nobody was told
--   16 warned 31 days ago, sent, date tomorrow       -> kept: the date it named
--   17 warned 31 days ago, no member address        -> deleted
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

create function pg_temp.id(prefix text, n int) returns uuid language sql as $$
  select (prefix || '-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- A household, its owner, a baby and one entry, all last touched `idle_for` ago.
create function pg_temp.household(n int, idle_for interval, email text default 'set') returns void
language plpgsql as $$
declare
  at timestamptz := now() - idle_for;
  h uuid := pg_temp.id('aaaaaaaa', n);
  u uuid := pg_temp.id('00000000', n);
  b uuid := pg_temp.id('bbbbbbbb', n);
begin
  insert into auth.users (id, email, last_sign_in_at)
    values (u, case when email = 'set' then 'u' || n || '@example.test' end, at);
  insert into public.households (id, name, created_by, created_at) values (h, 'H' || n, u, at);
  insert into public.memberships (household_id, user_id, role, display_name, joined_at)
    values (h, u, 'owner', 'Owner', at);
  insert into public.babies (id, household_id, name, born_at, updated_at) values (b, h, 'b', at, at);
  insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by,
      client_created_at)
    values (pg_temp.id('eeeeeeee', n), h, b, 'diaper', at, u, u, at);
  perform pg_temp.entry_written(n, at);
end
$$;

-- events_stamp_seq sets server_updated_at on every write; off for a moment.
create function pg_temp.entry_written(n int, at timestamptz) returns void language plpgsql as $$
begin
  alter table public.events disable trigger events_stamp_seq;
  update public.events set server_updated_at = at where id = pg_temp.id('eeeeeeee', n);
  alter table public.events enable trigger events_stamp_seq;
end
$$;

create function pg_temp.warned_at(n int) returns timestamptz language sql as $$
  select inactivity_warned_at from public.households where id = pg_temp.id('aaaaaaaa', n)
$$;

create function pg_temp.queued(n int) returns int language sql as $$
  select count(*)::int from public.inactivity_warning_emails where household_id = pg_temp.id('aaaaaaaa', n)
$$;

create function pg_temp.left(n int) returns int language sql as $$
  select count(*)::int from public.households where id = pg_temp.id('aaaaaaaa', n)
$$;

create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'UTC')::date $$;

-- Who may run what ----------------------------------------------------------
select ok((select count(*)::int from cron.job where jobname = 'warn-inactive-households'
           and command = 'select public.warn_inactive_households()') = 1, 'the warning is scheduled once');
select ok((select count(*)::int from cron.job where jobname = 'send-inactivity-warnings'
           and command = 'select public.request_inactivity_warnings()') = 1, 'the sending is scheduled once');
select ok((select count(distinct schedule)::int from cron.job) = (select count(*)::int from cron.job),
  'no two jobs share a time');
select ok(not has_function_privilege('authenticated', 'public.warn_inactive_households()', 'execute'),
  'a signed-in user cannot warn households');
select ok(not has_function_privilege('authenticated', 'public.claim_inactivity_warnings(integer)', 'execute')
  and not has_function_privilege('anon', 'public.claim_inactivity_warnings(integer)', 'execute'),
  'nor read the queue of addresses');
select ok(not has_function_privilege('authenticated', 'public.finish_inactivity_warning(bigint, boolean)', 'execute'),
  'nor mark an email sent');
select ok(has_function_privilege('service_role', 'public.claim_inactivity_warnings(integer)', 'execute')
  and has_function_privilege('service_role', 'public.finish_inactivity_warning(bigint, boolean)', 'execute'),
  'the Edge Function, with the service role, can');
select ok(not has_table_privilege('authenticated', 'public.inactivity_warning_emails', 'select'),
  'the queue is not readable through the API');

-- Warning ---------------------------------------------------------------------
select pg_temp.household(1, interval '30 months');
select pg_temp.household(2, interval '23 months 1 day');
insert into auth.users (id, email, last_sign_in_at)
  values (pg_temp.id('00000000', 102), 'u102@example.test', now() - interval '23 months 2 days');
insert into public.memberships (household_id, user_id, role, display_name, joined_at)
  values (pg_temp.id('aaaaaaaa', 2), pg_temp.id('00000000', 102), 'caregiver', 'Two',
          now() - interval '23 months 2 days');
select pg_temp.household(3, interval '22 months');
select pg_temp.household(4, interval '30 months');
update public.households set inactivity_warned_at = now() - interval '10 days' where id = pg_temp.id('aaaaaaaa', 4);
select pg_temp.household(5, interval '30 months');
update public.households set inactivity_warned_at = now() - interval '40 days' where id = pg_temp.id('aaaaaaaa', 5);
insert into public.inactivity_warning_emails (household_id, user_id, warned_at, claimed_at, sent_at, delete_on)
  values (pg_temp.id('aaaaaaaa', 5), pg_temp.id('00000000', 5), now() - interval '40 days',
          now() - interval '40 days', now() - interval '40 days', pg_temp.today() - 9);
update auth.users set last_sign_in_at = now() - interval '5 days' where id = pg_temp.id('00000000', 5);
select pg_temp.household(6, interval '36 months');
update public.households set inactivity_warned_at = now() - interval '36 months' where id = pg_temp.id('aaaaaaaa', 6);
select pg_temp.entry_written(6, now() - interval '30 months');

select is(public.warn_inactive_households(), 3, 'three households are newly warned: 1, 2 and 6');
select is(pg_temp.warned_at(1), now(), 'an idle household is marked warned now');
select is(pg_temp.queued(1), 1, 'and an email to its member is queued');
select is(pg_temp.queued(2), 2, 'every member of a household gets one');
select is(pg_temp.warned_at(3), null, 'a household idle for 22 months is not warned yet');
select is(pg_temp.queued(3), 0, 'and nothing is queued for it');
select is(pg_temp.warned_at(4), now() - interval '10 days', 'a warning in force is not renewed');
select is(pg_temp.warned_at(5), null, 'using the household after a warning clears it');
select is(pg_temp.queued(5), 0, 'and drops its emails');
select is(pg_temp.warned_at(6), now(), 'a stale warning overtaken by activity is replaced by a fresh one');

select is(public.warn_inactive_households(), 0, 'running it again warns nobody new');
select is((select count(*)::int from public.inactivity_warning_emails), 4, 'and queues nothing twice');

-- Sending ---------------------------------------------------------------------
create temp table claimed as select * from public.claim_inactivity_warnings(10);
select is((select count(*)::int from claimed), 4, 'the sender is handed every queued email');
select ok((select bool_and(email like 'u%@example.test') from claimed), 'with the member''s address');
select ok((select bool_and(delete_on = pg_temp.today() + 31) from claimed), 'and a deletion date 31 days on');
select is((select count(*)::int from public.claim_inactivity_warnings(10)), 0,
  'a claimed email is never handed out again: no email goes twice');
select public.finish_inactivity_warning(min(warning_id), true) from claimed;
select public.finish_inactivity_warning(max(warning_id), false) from claimed;
select is((select count(*)::int from public.inactivity_warning_emails where sent_at is not null), 1,
  'a sent email is marked sent');
select is((select array_agg(warning_id) from public.claim_inactivity_warnings(10)),
  (select array[max(warning_id)] from claimed), 'a refused one is offered again next time');
select public.finish_inactivity_warning(min(warning_id), false) from claimed;
select is((select count(*)::int from public.inactivity_warning_emails where sent_at is not null), 1,
  'and a sent one stays sent whatever is reported after');
select is(public.request_inactivity_warnings(), null,
  'without the function URL and secret in Vault, nothing is requested');

-- Clients cannot touch the warning ---------------------------------------------
select set_config('request.jwt.claims', json_build_object(
  'sub', pg_temp.id('00000000', 4), 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$update public.households set inactivity_warned_at = now() - interval '1 year'
    where id = 'aaaaaaaa-0000-0000-0000-000000000004'$$,
  '23514', null, 'an owner cannot back-date the warning');
reset role;

-- Deletion ----------------------------------------------------------------------
create function pg_temp.warned(n int, ago interval, sent boolean, delete_on date) returns void
language plpgsql as $$
begin
  update public.households set inactivity_warned_at = now() - ago where id = pg_temp.id('aaaaaaaa', n);
  insert into public.inactivity_warning_emails (household_id, user_id, warned_at, claimed_at, sent_at, delete_on)
    values (pg_temp.id('aaaaaaaa', n), pg_temp.id('00000000', n), now() - ago,
            now() - ago, case when sent then now() - ago end, delete_on);
end
$$;

select pg_temp.household(n, interval '30 months', case n when 17 then null else 'set' end)
from generate_series(11, 17) n;
select pg_temp.warned(11, interval '31 days', true, pg_temp.today());
select pg_temp.warned(12, interval '10 days', true, pg_temp.today() + 21);
select pg_temp.warned(14, interval '31 days', true, pg_temp.today());
update auth.users set last_sign_in_at = now() - interval '1 day' where id = pg_temp.id('00000000', 14);
select pg_temp.warned(15, interval '31 days', false, pg_temp.today());
select pg_temp.warned(16, interval '31 days', true, pg_temp.today() + 1);
update public.households set inactivity_warned_at = now() - interval '31 days' where id = pg_temp.id('aaaaaaaa', 17);

select is(public.sweep_inactive_households(), 2, 'two households are deleted: 11 and 17');
select is(pg_temp.left(11), 0, 'warned 31 days ago, told, and the date has come: deleted');
select is(pg_temp.left(12), 1, 'a warning only 10 days old is not enough');
select is(pg_temp.left(13), 1, 'a household never warned is never deleted');
select is(pg_temp.left(14), 1, 'signing in after the warning keeps the household');
select is(pg_temp.left(15), 1, 'an email that never went out keeps the household');
select is(pg_temp.left(16), 1, 'nothing goes before the date the email named');
select is(pg_temp.left(17), 0, 'a household with no address to write to goes 30 days after its warning');
select is((select count(*)::int from public.inactivity_warning_emails
           where household_id = pg_temp.id('aaaaaaaa', 11)), 0, 'its queue goes with it');
select is(pg_temp.left(1) + pg_temp.left(2) + pg_temp.left(6), 3,
  'households warned today are not deleted today');

select is(public.sweep_inactive_households(), 0, 'running it again deletes nothing more');

-- A purged entry counts as activity when it was deleted, not when the nightly
-- purge rewrote it (20261024140000). Triggers are off for this setup only.
set local session_replication_role = replica;
insert into public.households (id, name, created_by, created_at) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'Purged', '00000000-0000-0000-0000-000000000001',
   now() - interval '30 months');
insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by,
    updated_by, client_created_at, deleted_at, purged_at, server_updated_at, seq) values
  ('eeeeeeee-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f1',
   'bbbbbbbb-0000-0000-0000-0000000000f1', 'diaper',
   now() - interval '26 months', '{}', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', now() - interval '26 months',
   now() - interval '25 months', now(), now(), 999999);
set local session_replication_role = origin;
select ok(public.household_last_active_at('aaaaaaaa-0000-0000-0000-0000000000f1') < now() - interval '24 months',
  'a purge does not count as activity: the deletion time does');

select * from finish();
rollback;
