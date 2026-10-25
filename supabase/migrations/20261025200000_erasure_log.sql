-- Legal update round 2, decision 2 (owner, 2026-10-25): an erasure log, so
-- deletions can be applied again after a backup is restored.
--
-- A restore puts the database back to the day of the backup, so every account
-- and household deleted since then would come back. The log says which ones
-- went, and when, so the controller can delete them again before the app is
-- reopened (docs/compliance/data-requests.md, section 7).
--
-- What a row holds: the kind (account or household), its uuid, when it went
-- and why. No content, no name, no email. The uuid names nothing once the
-- account or household is gone, so all that is left is that something with
-- that id was erased.
--
-- Every way of deleting is covered, because the rows are written by triggers
-- on the tables themselves, not by the functions that delete:
--
-- * public.households, after delete: delete_household, delete_account (a
--   household only they were in), the inactivity and frozen sweeps, the DSAR
--   scripts and the dashboard.
-- * auth.users, after delete: delete_account, erase_user.sql, the dashboard
--   and the admin API.
--
-- Why it went (`reason`): whoever deletes may say so in the transaction-local
-- setting moraki.erasure_reason; the sweeps and delete_account do. Otherwise
-- a deletion by a signed-in user is theirs (the owner deleting the household,
-- the person deleting their account), and one with nobody signed in is the
-- controller's (admin_request).
--
-- Kept for erasure_log_retention() (35 days): longer than any backup that
-- could still hold the data (7 days on Supabase Pro), with a margin, then
-- purged by a daily job. Readable only by the service role, never through the
-- API.

create table public.erasure_log (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('account', 'household')),
  subject_id uuid not null,
  erased_at timestamptz not null default now(),
  reason text not null check (reason in
    ('user_request', 'household_deleted_by_owner', 'inactivity', 'frozen', 'admin_request'))
);

comment on table public.erasure_log is
  'Ids of erased accounts and households, to apply erasures again after a backup restore. No content. Kept erasure_log_retention().';

create index erasure_log_by_time on public.erasure_log (erased_at);

-- SECURITY: no policy and no grant, so no client role reads or writes it.
-- Only the security definer triggers below write it; the service role reads.
alter table public.erasure_log enable row level security;
revoke all on public.erasure_log from public, anon, authenticated;

/** How long the log keeps a row: past the 7-day backups, with a margin. */
create function public.erasure_log_retention() returns interval
language sql immutable set search_path = '' as $$ select interval '35 days' $$;

/** The reason the deleting code set for this transaction, else `fallback`. */
create function public.erasure_reason(fallback text) returns text
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('moraki.erasure_reason', true), ''), fallback)
$$;

create function public.log_household_erasure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.erasure_log (kind, subject_id, reason)
  values ('household', old.id, public.erasure_reason(
    case when auth.uid() is not null then 'household_deleted_by_owner' else 'admin_request' end));
  return old;
end
$$;

create trigger log_household_erasure after delete on public.households
  for each row execute function public.log_household_erasure();

create function public.log_account_erasure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.erasure_log (kind, subject_id, reason)
  values ('account', old.id, public.erasure_reason(
    case when auth.uid() = old.id then 'user_request' else 'admin_request' end));
  return old;
end
$$;

create trigger log_account_erasure after delete on auth.users
  for each row execute function public.log_account_erasure();

-- delete_account as in 20261005150000_erasure_successor.sql, now saying why,
-- so a household only the person was in is logged as their request too. A
-- caller that already said why (erase_user.sql: admin_request) keeps its
-- reason.
create or replace function public.delete_account(successor uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  h uuid;
begin
  if me is null then
    raise exception 'sign in to delete an account' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('moraki.erasure_reason', public.erasure_reason('user_request'), true);

  for h in select m.household_id from public.memberships m where m.user_id = me loop
    if exists (select 1 from public.memberships m
               where m.household_id = h and m.user_id <> me) then
      perform public.hand_over_and_leave(h, me, delete_account.successor);
    else
      delete from public.households where id = h;
    end if;
  end loop;

  delete from auth.users where id = me;
end;
$$;

-- The inactivity sweep as in 20261024180000_inactivity_warning.sql, now
-- saying why. 20261025210000_frozen_household_lifecycle.sql replaces it
-- again; this keeps the reason right should only this migration be applied.
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
                      where q.household_id = h.id and q.warned_at = h.inactivity_warned_at
                        and (q.sent_at is null or q.delete_on > (now() at time zone 'UTC')::date))
    returning 1
  )
  select count(*)::integer into swept from gone;
  perform set_config('moraki.erasure_reason', '', true);
  return swept;
end
$$;

/** Deletes log rows older than erasure_log_retention(). Returns how many. */
create function public.purge_erasure_log() returns integer
language plpgsql security definer set search_path = '' as $$
declare purged integer;
begin
  with gone as (
    delete from public.erasure_log
    where erased_at < now() - public.erasure_log_retention()
    returning 1
  )
  select count(*)::integer into purged from gone;
  return purged;
end
$$;

revoke execute on function public.erasure_reason(text) from public, anon, authenticated;
revoke execute on function public.log_household_erasure() from public, anon, authenticated;
revoke execute on function public.log_account_erasure() from public, anon, authenticated;
revoke execute on function public.purge_erasure_log() from public, anon, authenticated;
revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;

-- Daily, clear of the other jobs (02:47, 02:53, 03:17, 03:23, 03:31, 03:41,
-- 03:47). cron.schedule is idempotent by job name.
select cron.schedule('purge-erasure-log', '53 3 * * *',
  'select public.purge_erasure_log()');
