-- Owner decision 2026-10-24: a household is warned by email before the
-- 24-month inactivity deletion (20261018093000_sweep_inactive_households.sql),
-- and is deleted only once that warning has gone out and 30 days have passed
-- with nobody using it.
--
-- Three daily jobs, in this order (UTC):
--   02:47 warn-inactive-households       warn_inactive_households()
--   02:53 send-inactivity-warnings       request_inactivity_warnings(), which
--                                         asks the send-inactivity-warnings
--                                         Edge Function to email the queue
--   03:31 sweep-inactive-households      sweep_inactive_households(), now
--                                         gated on the warning
--
-- "Activity" keeps the definition the sweep already had, now written once in
-- household_last_active_at() and used by all three.
--
-- A warning is void as soon as anyone uses the household after it: the warn
-- job clears it (and its queue), and the sweep and the sender compare against
-- the latest activity anyway, so a sign-in between two runs is enough.
--
-- What is stored per warning email: the household, the member, when it was
-- claimed and sent, and the deletion date it promised. Never the address,
-- which the sender reads from auth.users at send time, and never the body.

create extension if not exists pg_net with schema extensions;

alter table public.households add column inactivity_warned_at timestamptz;

-- SECURITY: the warning is the server's alone. The owner may update the
-- household row (households_update), so without this an owner could back-date
-- a warning. Server-side functions run as their owner and are not affected.
create function public.households_keep_inactivity_warned_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.inactivity_warned_at is distinct from old.inactivity_warned_at then
    raise exception 'households.inactivity_warned_at can''t be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger households_keep_inactivity_warned_at before update on public.households
  for each row execute function public.households_keep_inactivity_warned_at();

/** One warning email to one member, for one warning of one household. */
create table public.inactivity_warning_emails (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- households.inactivity_warned_at this email belongs to.
  warned_at timestamptz not null,
  -- Set when the sender takes the row, cleared if Brevo refused it.
  claimed_at timestamptz,
  -- Set once Brevo accepted it. Never cleared: a row is sent at most once.
  sent_at timestamptz,
  -- The date the email names. The sweep does not delete before it.
  delete_on date,
  unique (household_id, user_id, warned_at)
);

-- SECURITY: no policy, so no client role can read or write the queue. Only
-- the security definer functions below touch it.
alter table public.inactivity_warning_emails enable row level security;
revoke all on public.inactivity_warning_emails from anon, authenticated;

/** How long before the 24-month limit a household is warned. */
create function public.household_inactivity_warning_after() returns interval
language sql immutable set search_path = '' as $$ select interval '23 months' $$;

/** The least time between the warning and the deletion. */
create function public.household_inactivity_notice() returns interval
language sql immutable set search_path = '' as $$ select interval '30 days' $$;

/**
 * The last time anyone used the household: an entry written or changed, a
 * baby's details changed, the household created or joined, a member signing
 * in or refreshing a session. The same signals the sweep has always used.
 */
create function public.household_last_active_at(household uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select greatest(
    (select h.created_at from public.households h where h.id = household),
    (select max(e.server_updated_at) from public.events e where e.household_id = household),
    (select max(b.updated_at) from public.babies b where b.household_id = household),
    (select max(m.joined_at) from public.memberships m where m.household_id = household),
    (select max(u.last_sign_in_at) from public.memberships m
       join auth.users u on u.id = m.user_id where m.household_id = household),
    (select max(greatest(s.created_at, s.updated_at)) from public.memberships m
       join auth.sessions s on s.user_id = m.user_id where m.household_id = household)
  )
$$;

/**
 * Voids warnings that activity has overtaken, then warns every household
 * unused for 23 months that is not already warned: sets inactivity_warned_at
 * and queues one email per member with an address. Returns how many
 * households were newly warned. Safe to run any number of times.
 */
create function public.warn_inactive_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_inactivity_warning_after();
  warned integer;
begin
  -- Someone used it after the warning: the warning, and its queue, are void.
  with void as (
    update public.households h set inactivity_warned_at = null
    where h.inactivity_warned_at is not null
      and public.household_last_active_at(h.id) >= h.inactivity_warned_at
    returning h.id
  )
  delete from public.inactivity_warning_emails q using void where q.household_id = void.id;

  with fresh as (
    update public.households h set inactivity_warned_at = now()
    where h.inactivity_warned_at is null
      and public.household_last_active_at(h.id) < cutoff
    returning h.id, h.inactivity_warned_at
  ), queued as (
    insert into public.inactivity_warning_emails (household_id, user_id, warned_at)
    select f.id, m.user_id, f.inactivity_warned_at
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
 * Hands the sender up to max_rows unsent emails of warnings still in force,
 * with each member's address and the deletion date to name, and marks them
 * claimed so a second call never returns them again. The date is 31 days
 * after the claim: the sweep runs at 03:31 UTC, so whenever the email goes
 * out, at least 30 full days pass before that day's sweep.
 */
create function public.claim_inactivity_warnings(max_rows integer default 50)
returns table (warning_id bigint, email text, delete_on date)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select q.id from public.inactivity_warning_emails q
    join public.households h on h.id = q.household_id
    join auth.users u on u.id = q.user_id
    where q.sent_at is null and q.claimed_at is null
      and h.inactivity_warned_at = q.warned_at
      and public.household_last_active_at(h.id) < q.warned_at
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

/**
 * The sender's answer for one claimed email: sent, or refused (released, so
 * the next day's run tries again, with a new date). A row already sent stays
 * sent whatever is reported after.
 */
create function public.finish_inactivity_warning(warning_id bigint, was_sent boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if was_sent then
    update public.inactivity_warning_emails set sent_at = now()
    where id = warning_id and claimed_at is not null and sent_at is null;
  else
    update public.inactivity_warning_emails set claimed_at = null, delete_on = null
    where id = warning_id and sent_at is null;
  end if;
end
$$;

/**
 * Asks the Edge Function to send the queue, if there is one and the owner has
 * stored its URL and secret in Vault (docs/10-release-runbook.md, "Inactivity
 * warning emails (Brevo)"). Without them, as on a local or CI database, it
 * does nothing. Returns the pg_net request id, or null.
 */
create function public.request_inactivity_warnings() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  function_url text;
  cron_secret text;
begin
  if not exists (select 1 from public.inactivity_warning_emails
                 where sent_at is null and claimed_at is null) then
    return null;
  end if;
  select decrypted_secret into function_url from vault.decrypted_secrets
    where name = 'inactivity_warnings_function_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets
    where name = 'inactivity_warnings_cron_secret';
  if coalesce(function_url, '') = '' or coalesce(cron_secret, '') = '' then
    return null;
  end if;
  return net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-moraki-cron-secret', cron_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end
$$;

/**
 * Deletes every household with no activity for 24 months whose warning is at
 * least 30 days old, has had no activity since, and whose emails have all gone
 * out with a date that has now come. Returns how many went.
 *
 * An email Brevo keeps refusing stays unsent, and its household is kept: data
 * is not deleted on a warning nobody received. A household with no member
 * address to write to goes 30 days after its warning.
 */
create or replace function public.sweep_inactive_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_inactivity_limit();
  swept integer;
begin
  with gone as (
    delete from public.households h
    where h.inactivity_warned_at is not null
      and h.inactivity_warned_at <= now() - public.household_inactivity_notice()
      and public.household_last_active_at(h.id) < least(cutoff, h.inactivity_warned_at)
      and not exists (select 1 from public.inactivity_warning_emails q
                      where q.household_id = h.id and q.warned_at = h.inactivity_warned_at
                        and (q.sent_at is null or q.delete_on > (now() at time zone 'UTC')::date))
    returning 1
  )
  select count(*)::integer into swept from gone;
  return swept;
end
$$;

revoke execute on function public.household_last_active_at(uuid) from public, anon, authenticated;
revoke execute on function public.warn_inactive_households() from public, anon, authenticated;
revoke execute on function public.request_inactivity_warnings() from public, anon, authenticated;
revoke execute on function public.claim_inactivity_warnings(integer) from public, anon, authenticated;
revoke execute on function public.finish_inactivity_warning(bigint, boolean) from public, anon, authenticated;
-- The Edge Function calls these two with the service role key.
grant execute on function public.claim_inactivity_warnings(integer) to service_role;
grant execute on function public.finish_inactivity_warning(bigint, boolean) to service_role;

-- Before the 03:17/03:23/03:31 sweeps, so a warning is queued and sent the
-- same morning. cron.schedule is idempotent by job name.
select cron.schedule('warn-inactive-households', '47 2 * * *',
  'select public.warn_inactive_households()');
select cron.schedule('send-inactivity-warnings', '53 2 * * *',
  'select public.request_inactivity_warnings()');
