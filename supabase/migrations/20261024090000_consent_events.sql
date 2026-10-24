-- P0.4 (legal review, 2026-10-24): consent evidence that can't be rewritten.
--
-- `consents` holds one row per (user, policy version) and re-granting
-- overwrote granted_at and cleared withdrawn_at, so every earlier grant and
-- withdrawal was lost. Worse, `consents_self` was `for all`: a user could
-- insert, rewrite or delete their own rows straight through the API.
--
-- From here:
--
-- * `consent_events` is the record. One row per grant or withdrawal, for any
--   purpose, with the version and the text that was on screen. Append only:
--   a user may read their own rows and nothing else; no client may insert,
--   update or delete one. Rows are written only by the security definer
--   functions below. They go with the account (on delete cascade), like
--   every other row about a person.
-- * `consents` stays as the current state of health-data consent, which
--   has_consent() and the events policies read. Clients may read their own
--   rows; only grant_consent() and withdraw_consent() write them, and each
--   call also appends an event.

create table public.consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  purpose text not null
    check (purpose in ('health_data', 'terms', 'guardian_declaration', 'caregiver_agreement')),
  -- The version of the text agreed to: a date, like consent_version().
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  action text not null check (action in ('grant', 'withdraw')),
  -- Which text was shown: the app's string namespace for that screen (with
  -- `version` and `locale`, that names one text in git), or `backfill` for a
  -- row copied from `consents` below, where nobody knows the language.
  text_key text not null check (char_length(text_key) between 1 and 60),
  locale text check (locale in ('en', 'el')),
  -- What the agreement was about, where it is about one household or baby.
  -- Not foreign keys: deleting the household must not rewrite the evidence.
  household_id uuid,
  baby_id uuid,
  created_at timestamptz not null default now()
);

create index consent_events_by_user on public.consent_events (user_id, purpose, created_at);

alter table public.consent_events enable row level security;

-- Belt and braces: no policy would let a client write, and no privilege does.
revoke all on public.consent_events from public, anon, authenticated;
grant select on public.consent_events to authenticated;

create policy consent_events_select_own on public.consent_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Not even a definer function rewrites a row: an update is refused outright.
-- Deletion stays possible only by cascade, when the account itself goes.
create function public.consent_events_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'consent events are append only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger consent_events_append_only before update on public.consent_events
  for each row execute function public.consent_events_append_only();

-- Backfill: what `consents` still remembers. One grant per row at its latest
-- granted_at, and a withdrawal where it is withdrawn now. Earlier cycles were
-- overwritten before this table existed and can't be recovered.
insert into public.consent_events (user_id, purpose, version, action, text_key, created_at)
select user_id, 'health_data', policy_version, 'grant', 'backfill', granted_at
from public.consents
where policy_version ~ '^\d{4}-\d{2}-\d{2}$'
union all
select user_id, 'health_data', policy_version, 'withdraw', 'backfill', withdrawn_at
from public.consents
where withdrawn_at is not null and policy_version ~ '^\d{4}-\d{2}-\d{2}$'
order by 6;

-- The one writer. Not callable by a client: each public function below
-- checks who is asking and what they may record, then calls this.
create function public.append_consent_event(
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

-- consents: read your own, write only through the two functions below.
drop policy consents_self on public.consents;
revoke insert, update, delete, truncate on public.consents from public, anon, authenticated;
create policy consents_select_own on public.consents for select to authenticated
  using (user_id = (select auth.uid()));

-- grant_consent and withdraw_consent keep their behaviour and gain an
-- optional `locale`, so the record says which language the text was in.
-- An app from before this change calls them with no arguments and still
-- works. Security definer now, as the caller no longer has write access.
drop function public.grant_consent();
drop function public.withdraw_consent();

create function public.grant_consent(locale text default null) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  granted timestamptz;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if grant_consent.locale is not null and grant_consent.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.consents (user_id, policy_version)
  values (me, public.consent_version())
  on conflict (user_id, policy_version)
    do update set withdrawn_at = null, granted_at = now()
  returning consents.granted_at into granted;
  perform public.append_consent_event(
    me, 'health_data', public.consent_version(), 'grant', 'consent', grant_consent.locale);
  return granted;
end
$$;

-- Withdrawing what isn't granted changes nothing and records nothing.
create function public.withdraw_consent(locale text default null) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  withdrawn timestamptz;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if withdraw_consent.locale is not null and withdraw_consent.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;
  update public.consents set withdrawn_at = now()
  where user_id = me and policy_version = public.consent_version()
    and withdrawn_at is null
  returning consents.withdrawn_at into withdrawn;
  if withdrawn is not null then
    perform public.append_consent_event(
      me, 'health_data', public.consent_version(), 'withdraw', 'consent', withdraw_consent.locale);
  end if;
  return withdrawn;
end
$$;

revoke execute on function public.grant_consent, public.withdraw_consent from public, anon;
grant execute on function public.grant_consent, public.withdraw_consent to authenticated;

-- Agreements that have no state of their own beyond the record: the Terms of
-- Use (P0.9) and a caregiver's agreement. Health data has grant_consent; the
-- guardian declaration is made by create_household and declare_guardian,
-- which also mark the membership, so neither is accepted here.
create function public.record_consent(
  purpose text,
  version text,
  action text,
  household_id uuid default null,
  locale text default null,
  text_key text default null
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if record_consent.purpose is null
     or record_consent.purpose not in ('terms', 'caregiver_agreement') then
    raise exception 'this purpose is recorded by its own call' using errcode = 'invalid_parameter_value';
  end if;
  if record_consent.version is null or record_consent.version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'version must be a date' using errcode = 'invalid_parameter_value';
  end if;
  if record_consent.action is null or record_consent.action not in ('grant', 'withdraw') then
    raise exception 'action must be grant or withdraw' using errcode = 'invalid_parameter_value';
  end if;
  if record_consent.locale is not null and record_consent.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;
  if record_consent.household_id is not null
     and not public.is_member(record_consent.household_id) then
    raise exception 'not a member of this household' using errcode = 'insufficient_privilege';
  end if;

  return public.append_consent_event(
    me, record_consent.purpose, record_consent.version, record_consent.action,
    coalesce(nullif(btrim(record_consent.text_key), ''), record_consent.purpose),
    record_consent.locale, record_consent.household_id);
end;
$$;

revoke execute on function public.record_consent from public, anon;
grant execute on function public.record_consent to authenticated;
