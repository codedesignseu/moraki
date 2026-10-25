-- Legal update round 2, decision 1 (owner, 2026-10-25): what happens to a
-- household that stays frozen (20261024210000_household_freeze.sql: no
-- guardian in it has health-data consent in force).
--
-- * After 90 days frozen, every member with an email address is warned, by
--   the same Brevo path as the inactivity warning (a second kind of email in
--   the same queue): the household will be deleted on a date unless a guardian
--   opens Moraki and agrees again.
-- * 30 days or more after the warning, if it is still frozen and every email
--   went out with a date that has come, it is deleted, like delete_household.
-- * A guardian agreeing again (or a member declaring as guardian who has
--   consent) unfreezes it, and that voids the warning and its queue at once.
--
-- Frozen is derived (household_frozen()), and stays derived: what is stored
-- is only when it was first seen frozen, households.frozen_since, which the
-- clock needs. It is set by the daily job and cleared as soon as the
-- household is not frozen: at once by the triggers below when a consent is
-- granted or a guardian declared, and by the daily job in every other case.
-- A household found frozen gets the date of that run, so the clock is at
-- most a day late, in the household's favour. Households frozen when this
-- migration runs start their 90 days now.
--
-- A new consent text version freezes every household until a guardian in it
-- agrees to the new text, so it starts this clock too.
--
-- Daily jobs (UTC), around the inactivity ones:
--   02:47 warn-inactive-households   (unchanged)
--   02:50 warn-frozen-households     warn_frozen_households()
--   02:53 send-inactivity-warnings   sends both kinds (unchanged job)
--   03:31 sweep-inactive-households  (unchanged job)
--   03:35 sweep-frozen-households    sweep_frozen_households()

alter table public.households
  add column frozen_since timestamptz,
  add column frozen_warned_at timestamptz;

comment on column public.households.frozen_since is
  'When the household was first seen frozen (no guardian with consent in force). Null while not frozen. Server only.';
comment on column public.households.frozen_warned_at is
  'When the frozen-household deletion warning was given. Null if none in force. Server only.';

-- SECURITY: like inactivity_warned_at, the server's alone. The owner may
-- update the household row (households_update), so without this an owner
-- could move the clock. Server-side functions run as their owner.
create function public.households_keep_frozen_clock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.frozen_since is distinct from old.frozen_since
          or new.frozen_warned_at is distinct from old.frozen_warned_at) then
    raise exception 'households.frozen_since and frozen_warned_at can''t be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger households_keep_frozen_clock before update on public.households
  for each row execute function public.households_keep_frozen_clock();

-- The queue holds both kinds of warning email from here. Existing rows are
-- all inactivity warnings.
alter table public.inactivity_warning_emails
  add column kind text not null default 'inactivity' check (kind in ('inactivity', 'frozen'));

alter table public.inactivity_warning_emails
  drop constraint inactivity_warning_emails_household_id_user_id_warned_at_key;
alter table public.inactivity_warning_emails
  add constraint inactivity_warning_emails_one_per_warning unique (household_id, user_id, kind, warned_at);

comment on column public.inactivity_warning_emails.warned_at is
  'households.inactivity_warned_at (kind inactivity) or households.frozen_warned_at (kind frozen) this email belongs to.';

/** How long a household is frozen before it is warned. */
create function public.household_frozen_warning_after() returns interval
language sql immutable set search_path = '' as $$ select interval '90 days' $$;

/** The least time between that warning and the deletion. */
create function public.household_frozen_notice() returns interval
language sql immutable set search_path = '' as $$ select interval '30 days' $$;

/**
 * If household `h` is not frozen, clears its frozen clock and warning and
 * drops its frozen-warning emails. Does nothing to a frozen one.
 */
create function public.clear_frozen_clock(h uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.household_frozen(h) then
    return;
  end if;
  update public.households set frozen_since = null, frozen_warned_at = null
  where id = h and (frozen_since is not null or frozen_warned_at is not null);
  delete from public.inactivity_warning_emails where household_id = h and kind = 'frozen';
end
$$;

-- A consent granted (grant_consent, by insert or by clearing withdrawn_at):
-- every household where that person is a guardian may have thawed.
create function public.consents_clear_frozen_clock() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  for h in select m.household_id from public.memberships m
           where m.user_id = new.user_id and m.is_guardian loop
    perform public.clear_frozen_clock(h);
  end loop;
  return null;
end
$$;

create trigger consents_clear_frozen_clock after insert or update on public.consents
  for each row when (new.withdrawn_at is null)
  execute function public.consents_clear_frozen_clock();

-- A member declaring as guardian (declare_guardian) who already has consent.
create function public.memberships_clear_frozen_clock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.clear_frozen_clock(new.household_id);
  return null;
end
$$;

create trigger memberships_clear_frozen_clock after update of is_guardian on public.memberships
  for each row when (new.is_guardian and not old.is_guardian)
  execute function public.memberships_clear_frozen_clock();

/**
 * The daily frozen-household job, step by step:
 * 1. a household no longer frozen has its clock, warning and queue cleared;
 * 2. a household newly found frozen starts its clock now;
 * 3. a household frozen for 90 days and not yet warned is warned now, with
 *    one email queued per member with an address.
 * Returns how many households were newly warned. Safe to run any number of
 * times.
 */
create function public.warn_frozen_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_frozen_warning_after();
  warned integer;
begin
  with thawed as (
    update public.households h set frozen_since = null, frozen_warned_at = null
    where (h.frozen_since is not null or h.frozen_warned_at is not null)
      and not public.household_frozen(h.id)
    returning h.id
  )
  delete from public.inactivity_warning_emails q using thawed
  where q.household_id = thawed.id and q.kind = 'frozen';

  update public.households h set frozen_since = now()
  where h.frozen_since is null and public.household_frozen(h.id);

  with fresh as (
    update public.households h set frozen_warned_at = now()
    where h.frozen_warned_at is null and h.frozen_since <= cutoff
    returning h.id, h.frozen_warned_at
  ), queued as (
    insert into public.inactivity_warning_emails (household_id, user_id, kind, warned_at)
    select f.id, m.user_id, 'frozen', f.frozen_warned_at
    from fresh f
    join public.memberships m on m.household_id = f.id
    join auth.users u on u.id = m.user_id
    where coalesce(u.email, '') <> ''
    on conflict do nothing
  )
  select count(*)::integer into warned from fresh;
  return warned;
end
$$;

-- warn_inactive_households as in 20261024180000_inactivity_warning.sql, now
-- voiding only inactivity emails: a frozen-household warning stands on its
-- own.
create or replace function public.warn_inactive_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_inactivity_warning_after();
  warned integer;
begin
  with void as (
    update public.households h set inactivity_warned_at = null
    where h.inactivity_warned_at is not null
      and public.household_last_active_at(h.id) >= h.inactivity_warned_at
    returning h.id
  )
  delete from public.inactivity_warning_emails q using void
  where q.household_id = void.id and q.kind = 'inactivity';

  with fresh as (
    update public.households h set inactivity_warned_at = now()
    where h.inactivity_warned_at is null
      and public.household_last_active_at(h.id) < cutoff
    returning h.id, h.inactivity_warned_at
  ), queued as (
    insert into public.inactivity_warning_emails (household_id, user_id, kind, warned_at)
    select f.id, m.user_id, 'inactivity', f.inactivity_warned_at
    from fresh f
    join public.memberships m on m.household_id = f.id
    join auth.users u on u.id = m.user_id
    where coalesce(u.email, '') <> ''
    on conflict do nothing
  )
  select count(*)::integer into warned from fresh;
  return warned;
end
$$;

/**
 * Whether queued email `q` (of household `h`) still belongs to a warning in
 * force: inactivity, with no activity since; frozen, still frozen.
 */
create function public.household_warning_in_force(
  kind text, warned_at timestamptz, h public.households
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case kind
    when 'inactivity' then h.inactivity_warned_at = warned_at
                           and public.household_last_active_at(h.id) < warned_at
    when 'frozen' then h.frozen_warned_at = warned_at and public.household_frozen(h.id)
    else false
  end
$$;

/**
 * Both kinds: hands the sender up to max_rows unsent emails of warnings still
 * in force, with each member's address, the kind (which email to write) and
 * the date to name, and marks them claimed, as claim_inactivity_warnings
 * does. The date is 31 days after the claim, so at least 30 full days pass
 * before the sweep that day.
 */
create function public.claim_household_warnings(max_rows integer default 50)
returns table (warning_id bigint, kind text, email text, delete_on date)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select q.id from public.inactivity_warning_emails q
    join public.households h on h.id = q.household_id
    join auth.users u on u.id = q.user_id
    where q.sent_at is null and q.claimed_at is null
      and public.household_warning_in_force(q.kind, q.warned_at, h)
      and coalesce(u.email, '') <> ''
    order by q.id
    limit greatest(least(max_rows, 500), 0)
    for update of q skip locked
  ), claimed as (
    update public.inactivity_warning_emails q
    set claimed_at = now(),
        delete_on = ((now() at time zone 'UTC')::date + 31)
    from picked where q.id = picked.id
    returning q.id, q.kind, q.user_id, q.delete_on
  )
  select c.id, c.kind, u.email::text, c.delete_on
  from claimed c join auth.users u on u.id = c.user_id
  order by c.id;
end
$$;

-- The old claim, kept for a send-inactivity-warnings deployed before this
-- change: it now hands out inactivity emails only, so such a function never
-- sends a frozen-household email with the inactivity text. Frozen ones wait
-- for the new function (and their households are kept until they go out).
create or replace function public.claim_inactivity_warnings(max_rows integer default 50)
returns table (warning_id bigint, email text, delete_on date)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select q.id from public.inactivity_warning_emails q
    join public.households h on h.id = q.household_id
    join auth.users u on u.id = q.user_id
    where q.sent_at is null and q.claimed_at is null and q.kind = 'inactivity'
      and public.household_warning_in_force(q.kind, q.warned_at, h)
      and coalesce(u.email, '') <> ''
    order by q.id
    limit greatest(least(max_rows, 500), 0)
    for update of q skip locked
  ), claimed as (
    update public.inactivity_warning_emails q
    set claimed_at = now(),
        delete_on = ((now() at time zone 'UTC')::date + 31)
    from picked where q.id = picked.id
    returning q.id, q.user_id, q.delete_on
  )
  select c.id, u.email::text, c.delete_on
  from claimed c join auth.users u on u.id = c.user_id
  order by c.id;
end
$$;

-- The inactivity sweep, as in 20261025200000_erasure_log.sql, looking only at
-- inactivity emails.
create or replace function public.sweep_inactive_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_inactivity_limit();
  swept integer;
begin
  perform set_config('moraki.erasure_reason', 'inactivity', true);
  with gone as (
    delete from public.households h
    where h.inactivity_warned_at is not null
      and h.inactivity_warned_at <= now() - public.household_inactivity_notice()
      and public.household_last_active_at(h.id) < least(cutoff, h.inactivity_warned_at)
      and not exists (select 1 from public.inactivity_warning_emails q
                      where q.household_id = h.id and q.kind = 'inactivity'
                        and q.warned_at = h.inactivity_warned_at
                        and (q.sent_at is null or q.delete_on > (now() at time zone 'UTC')::date))
    returning 1
  )
  select count(*)::integer into swept from gone;
  perform set_config('moraki.erasure_reason', '', true);
  return swept;
end
$$;

/**
 * Deletes every household still frozen whose frozen warning is at least 30
 * days old and whose emails have all gone out with a date that has now come.
 * Returns how many went. As with inactivity, an email Brevo keeps refusing
 * keeps its household; a household with no member address goes 30 days after
 * its warning.
 */
create function public.sweep_frozen_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare swept integer;
begin
  perform set_config('moraki.erasure_reason', 'frozen', true);
  with gone as (
    delete from public.households h
    where h.frozen_warned_at is not null
      and h.frozen_warned_at <= now() - public.household_frozen_notice()
      and h.frozen_since <= now() - public.household_frozen_warning_after()
      and public.household_frozen(h.id)
      and not exists (select 1 from public.inactivity_warning_emails q
                      where q.household_id = h.id and q.kind = 'frozen'
                        and q.warned_at = h.frozen_warned_at
                        and (q.sent_at is null or q.delete_on > (now() at time zone 'UTC')::date))
    returning 1
  )
  select count(*)::integer into swept from gone;
  perform set_config('moraki.erasure_reason', '', true);
  return swept;
end
$$;

-- Households frozen today start their 90 days now.
update public.households h set frozen_since = now()
where h.frozen_since is null and public.household_frozen(h.id);

revoke execute on function public.clear_frozen_clock(uuid) from public, anon, authenticated;
revoke execute on function public.consents_clear_frozen_clock() from public, anon, authenticated;
revoke execute on function public.memberships_clear_frozen_clock() from public, anon, authenticated;
revoke execute on function public.warn_frozen_households() from public, anon, authenticated;
revoke execute on function public.sweep_frozen_households() from public, anon, authenticated;
revoke execute on function public.household_warning_in_force(text, timestamptz, public.households)
  from public, anon, authenticated;
revoke execute on function public.claim_household_warnings(integer) from public, anon, authenticated;
-- The Edge Function calls it with the service role key.
grant execute on function public.claim_household_warnings(integer) to service_role;

-- cron.schedule is idempotent by job name. 02:50 queues before the 02:53
-- send; 03:35 sweeps after the inactivity sweep.
select cron.schedule('warn-frozen-households', '50 2 * * *',
  'select public.warn_frozen_households()');
select cron.schedule('sweep-frozen-households', '35 3 * * *',
  'select public.sweep_frozen_households()');
