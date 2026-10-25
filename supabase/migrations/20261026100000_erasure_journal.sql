-- Owner decision 2026-10-26, answering the lawyer: the record of erasures
-- must survive a database restore. 20261025200000_erasure_log.sql keeps it in
-- the database, so a restore rolls it back with everything else. Two changes:
--
-- 1. Deleted entries are logged too (kind 'entry'), not only accounts and
--    households. An entry deleted after a backup comes back on restore like
--    an account does, content and all.
-- 2. Every night the previous UTC day's log rows are emailed to the owner's
--    mailbox, outside the database, as a CSV of kind, id, erased_at and
--    reason (the send-erasure-journal Edge Function, through Brevo). After a
--    restore the journal emails dated on or after the backup day say what to
--    delete again (docs/compliance/data-requests.md, section 7).
--
-- logged_at: when the row reached the log, by the server clock. An entry's
-- erased_at is its deleted_at, which the phone sets and may be days old when
-- an offline phone syncs; the journal days, the purge and the restore all go
-- by logged_at, so a late delete is neither missed nor purged early. For an
-- account or a household the two are the same.
--
-- What is stored for the journal: one row, the time up to which every log row
-- has been emailed (sent_until, always a UTC midnight), and a 15-minute lease
-- so two runs never send the same day. A day with nothing logged is skipped,
-- not emailed. Never the recipient (an Edge Function secret) or the email.
--
-- Daily (UTC): 04:05 send-erasure-journal, after every sweep and purge
-- (02:47 to 03:53), so the night's sweeps are in the next night's email.

-- Entries in the log ----------------------------------------------------------

alter table public.erasure_log drop constraint erasure_log_kind_check;
alter table public.erasure_log add constraint erasure_log_kind_check
  check (kind in ('account', 'household', 'entry'));

alter table public.erasure_log add column logged_at timestamptz not null default now();
update public.erasure_log set logged_at = erased_at;
create index erasure_log_by_logged_at on public.erasure_log (logged_at);

comment on table public.erasure_log is
  'Ids of erased accounts, households and entries, to apply erasures again after a backup restore. No content. Kept erasure_log_retention() after logged_at, and emailed nightly (send-erasure-journal).';

/**
 * An entry becoming deleted: deleted_at going from null to a time, or an
 * entry pushed already deleted (made and deleted offline). Its uuid, its
 * deleted_at, and why: the person's request unless the deleting code said
 * otherwise (moraki.erasure_reason). A purge or any later update of a
 * deleted row writes nothing. A household's entries going with the household
 * are a delete, not this; the household row covers them.
 */
create function public.log_entry_erasure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and (tg_op = 'INSERT' or old.deleted_at is null) then
    insert into public.erasure_log (kind, subject_id, erased_at, reason)
    values ('entry', new.id, new.deleted_at, public.erasure_reason('user_request'));
  end if;
  return null;
end
$$;

create trigger log_entry_erasure after insert or update of deleted_at on public.events
  for each row execute function public.log_entry_erasure();

-- As in 20261025200000_erasure_log.sql, now by logged_at.
create or replace function public.purge_erasure_log() returns integer
language plpgsql security definer set search_path = '' as $$
declare purged integer;
begin
  with gone as (
    delete from public.erasure_log
    where logged_at < now() - public.erasure_log_retention()
    returning 1
  )
  select count(*)::integer into purged from gone;
  return purged;
end
$$;

-- The journal -----------------------------------------------------------------

create table public.erasure_journal (
  singleton boolean primary key default true check (singleton),
  -- Every log row with logged_at before this has been emailed, or its day had
  -- none. A UTC midnight.
  sent_until timestamptz not null,
  -- Set while a run holds the journal; a run older than 15 minutes has died.
  claimed_at timestamptz
);

comment on table public.erasure_journal is
  'How far the nightly erasure journal email has got. One row. No ids, no addresses.';

-- SECURITY: no policy and no grant, so no client role reads or writes it.
alter table public.erasure_journal enable row level security;
revoke all on public.erasure_journal from public, anon, authenticated;

-- Starts at the first day still in the log, so the rows logged before this
-- migration go out too, one email per day, on the first run.
insert into public.erasure_journal (sent_until)
select (coalesce(min((l.logged_at at time zone 'UTC')::date), (now() at time zone 'UTC')::date)
        ::timestamp at time zone 'UTC')
from public.erasure_log l;

/**
 * Takes the journal for one run, if no other run holds it, and returns the
 * whole UTC days not yet sent, oldest first, at most max_days (40), each with
 * how many rows were logged that day. Today is never returned: it is not
 * over. Returns nothing if another run holds the journal.
 */
create function public.claim_erasure_journal(max_days integer default 40)
returns table (journal_day date, entries integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  since timestamptz;
  today date := (now() at time zone 'UTC')::date;
begin
  update public.erasure_journal j set claimed_at = now()
  where j.claimed_at is null or j.claimed_at < now() - interval '15 minutes'
  returning j.sent_until into since;
  if since is null then
    return;
  end if;
  return query
  select g.d, (select count(*)::integer from public.erasure_log l
               where l.logged_at >= (g.d::timestamp at time zone 'UTC')
                 and l.logged_at < ((g.d + 1)::timestamp at time zone 'UTC'))
  from (select (since at time zone 'UTC')::date + i as d
        from generate_series(0, greatest(least(max_days, 40), 0) - 1) i) g
  where g.d < today
  order by g.d;
end
$$;

/** The log rows of one whole UTC day, for its CSV. Nothing for today or later. */
create function public.erasure_journal_rows(journal_day date)
returns table (kind text, subject_id uuid, erased_at timestamptz, reason text)
language sql stable security definer set search_path = '' as $$
  select l.kind, l.subject_id, l.erased_at, l.reason
  from public.erasure_log l
  where journal_day < (now() at time zone 'UTC')::date
    and l.logged_at >= (journal_day::timestamp at time zone 'UTC')
    and l.logged_at < ((journal_day + 1)::timestamp at time zone 'UTC')
  order by l.logged_at, l.id
$$;

/**
 * Marks one day sent (or skipped, if empty): moves sent_until past it, only
 * if it is the next day due, so days go in order and a day reported twice
 * moves nothing. Returns whether it moved.
 */
create function public.finish_erasure_journal_day(journal_day date) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.erasure_journal
  set sent_until = ((journal_day + 1)::timestamp at time zone 'UTC')
  where sent_until = (journal_day::timestamp at time zone 'UTC')
    and journal_day < (now() at time zone 'UTC')::date;
  return found;
end
$$;

/** Ends a run: lets the next one take the journal. */
create function public.release_erasure_journal() returns void
language sql security definer set search_path = '' as $$
  update public.erasure_journal set claimed_at = null
$$;

/**
 * Asks the send-erasure-journal Edge Function to send the days due, if any is
 * due and the owner has stored its URL and secret in Vault
 * (docs/10-release-runbook.md, "Erasure journal email"). Without them, as on
 * a local or CI database, it does nothing. Returns the pg_net request id, or
 * null.
 */
create function public.request_erasure_journal() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  function_url text;
  cron_secret text;
begin
  if not exists (select 1 from public.erasure_journal
                 where sent_until < ((now() at time zone 'UTC')::date::timestamp at time zone 'UTC')) then
    return null;
  end if;
  select decrypted_secret into function_url from vault.decrypted_secrets
    where name = 'erasure_journal_function_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets
    where name = 'erasure_journal_cron_secret';
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

revoke execute on function public.log_entry_erasure() from public, anon, authenticated;
revoke execute on function public.purge_erasure_log() from public, anon, authenticated;
revoke execute on function public.claim_erasure_journal(integer) from public, anon, authenticated;
revoke execute on function public.erasure_journal_rows(date) from public, anon, authenticated;
revoke execute on function public.finish_erasure_journal_day(date) from public, anon, authenticated;
revoke execute on function public.release_erasure_journal() from public, anon, authenticated;
revoke execute on function public.request_erasure_journal() from public, anon, authenticated;
-- The Edge Function calls these four with the service role key.
grant execute on function public.claim_erasure_journal(integer) to service_role;
grant execute on function public.erasure_journal_rows(date) to service_role;
grant execute on function public.finish_erasure_journal_day(date) to service_role;
grant execute on function public.release_erasure_journal() to service_role;

-- After every sweep and purge of the night. cron.schedule is idempotent by
-- job name.
select cron.schedule('send-erasure-journal', '5 4 * * *',
  'select public.request_erasure_journal()');
