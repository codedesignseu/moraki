-- Legal update Q1, decided 2026-10-25 (owner and lawyer): consent evidence
-- outlives the account by 3 years, so we can still show what was agreed to
-- and when (Art. 7(1)), then it is erased automatically.
--
-- Until now consent_events went with the account (on delete cascade to
-- auth.users). From here:
--
-- * consent_events.user_id keeps the account's uuid but no longer references
--   auth.users, so deleting the account leaves the rows. The uuid stays (not
--   set null): it is what ties one account's grants and withdrawals together.
--   Nothing else is kept with them: the email and sign-in details live only
--   in auth.users and go with it, so what is left is pseudonymous.
-- * account_deleted_at is stamped on that person's rows the moment the
--   account goes, by a trigger on auth.users, so every way of deleting one
--   (delete_account from the app, erase_user.sql, the dashboard, the admin
--   API) is covered by the one mechanism.
-- * A daily job erases rows whose account was deleted more than
--   consent_record_retention() ago. That function is the one place the
--   period is written; the lawyer may change it.
-- * The rows stay unreadable through the API: the select policy is still own
--   rows only, and now also only while the account exists, so even an access
--   token that outlives its account reads nothing.
--
-- `consents` (current state of health-data consent) keeps cascading: it is
-- what has_consent() reads, not evidence. The history is in consent_events.

alter table public.consent_events
  drop constraint consent_events_user_id_fkey;

alter table public.consent_events
  add column account_deleted_at timestamptz;

comment on column public.consent_events.user_id is
  'The account''s uuid. Not a foreign key: the record outlives the account (legal update Q1).';
comment on column public.consent_events.account_deleted_at is
  'When the account was deleted. Set once, by trigger; the row is erased consent_record_retention() later.';

create index consent_events_by_account_deleted on public.consent_events (account_deleted_at)
  where account_deleted_at is not null;

-- How long consent records outlive the account. The one constant.
create function public.consent_record_retention() returns interval
language sql immutable set search_path = '' as $$
  select interval '3 years'
$$;

-- Still append only, with one exception: stamping account_deleted_at once,
-- from empty, with every other column unchanged.
create or replace function public.consent_events_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.account_deleted_at is null and new.account_deleted_at is not null
     and (to_jsonb(new) - 'account_deleted_at') = (to_jsonb(old) - 'account_deleted_at') then
    return new;
  end if;
  raise exception 'consent events are append only' using errcode = 'insufficient_privilege';
end;
$$;

-- Without the foreign key, nothing else would stop an event being written
-- for an account that no longer exists (a still-valid token after deletion).
-- Such a row would never be stamped, so never erased. Refuse it.
create or replace function public.append_consent_event(
  who uuid,
  purpose text,
  version text,
  action text,
  text_key text,
  locale text default null,
  household_id uuid default null,
  baby_id uuid default null
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare at timestamptz;
begin
  if not exists (select 1 from auth.users u where u.id = who) then
    raise exception 'no such account' using errcode = 'insufficient_privilege';
  end if;
  insert into public.consent_events
    (user_id, purpose, version, action, text_key, locale, household_id, baby_id)
  values (who, append_consent_event.purpose, append_consent_event.version,
          append_consent_event.action, append_consent_event.text_key,
          append_consent_event.locale, append_consent_event.household_id,
          append_consent_event.baby_id)
  returning created_at into at;
  return at;
end;
$$;

revoke execute on function public.append_consent_event from public, anon, authenticated;

-- Stamp the person's consent records as the account is deleted, whoever
-- deletes it.
create function public.mark_consent_records_account_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.consent_events set account_deleted_at = now()
  where user_id = old.id and account_deleted_at is null;
  return old;
end;
$$;

revoke execute on function public.mark_consent_records_account_deleted from public, anon, authenticated;

create trigger mark_consent_records_account_deleted before delete on auth.users
  for each row execute function public.mark_consent_records_account_deleted();

-- Own rows only, and only while the account exists.
drop policy consent_events_select_own on public.consent_events;
create policy consent_events_select_own on public.consent_events for select to authenticated
  using (user_id = (select auth.uid()) and account_deleted_at is null);

-- The erasure. Returns how many rows went.
create function public.purge_old_consent_records() returns integer
language plpgsql security definer set search_path = '' as $$
declare purged integer;
begin
  with gone as (
    delete from public.consent_events
    where account_deleted_at < now() - public.consent_record_retention()
    returning 1
  )
  select count(*)::integer into purged from gone;
  return purged;
end;
$$;

revoke execute on function public.purge_old_consent_records from public, anon, authenticated;

-- Daily, off-peak UTC, clear of the other jobs (02:47, 02:53, 03:17, 03:23,
-- 03:31, 03:41). cron.schedule is idempotent by job name.
select cron.schedule('purge-old-consent-records', '47 3 * * *',
  'select public.purge_old_consent_records()');
