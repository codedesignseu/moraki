-- Consent grace period (owner decision, 2026-10-26; lawyer to confirm).
--
-- Until now a new health-data consent version stopped every earlier
-- agreement counting the moment it was published: sharing paused for every
-- guardian, every household without a guardian on the new text froze, and
-- the frozen-household lifecycle (20261025210000) put each of them on its
-- 90-day clock towards deletion. A routine text update must not do that.
-- From here:
--
-- * consent_versions lists each version with when it came into force.
--   Agreeing to the version immediately before the one in force keeps
--   counting, unless withdrawn, for 90 days from the new version's
--   effective_at (consent_in_force). has_consent(), and through it
--   has_access() and my_membership_status(), and household_frozen() all
--   read that one rule. After the 90 days that person's sharing pauses, as
--   before, until they agree to the new text.
-- * The deletion clock (frozen_since, the warning and the sweep) runs only
--   for a household frozen by an explicit withdrawal: household_withdrawn().
--   A household where a guardian's agreement merely ran out stays paused,
--   with no clock, no warning and no deletion (the 24-month inactivity rule
--   still applies). Households on the clock only through a lapse have it
--   cleared below.
-- * withdraw_consent() withdraws whatever agreement the person still has,
--   the one in grace included, so withdrawing works the same in the grace.
--
-- The first version published this way is 2026-10-26: the withdrawal
-- paragraph said that in a paused household "nobody else sees it", which
-- overstated it (authors still read and delete their own entries,
-- 20261024210000, 20261025180000). The new text says so. Agreements to
-- 2026-10-25 keep counting for 90 days from this migration.
--
-- A new version needs a row here as well as consent_version(): without one
-- nobody is in grace (fail closed), and 24_consent_grace.test.sql checks the
-- two agree.

create table public.consent_versions (
  version text primary key check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  effective_at timestamptz not null
);

comment on table public.consent_versions is
  'Each health-data consent text version and when it came into force. Written only by migrations.';

alter table public.consent_versions enable row level security;
revoke all on public.consent_versions from public, anon, authenticated;
grant select on public.consent_versions to authenticated;
create policy consent_versions_select on public.consent_versions for select to authenticated
  using (true);

-- The versions so far, each in force from its date (the migrations that
-- published them ran that day), and the new one from now. The app carries the same list
-- (src/domain/consent/consent.ts, CONSENT_VERSIONS).
insert into public.consent_versions (version, effective_at) values
  ('2026-09-23', '2026-09-23T00:00:00Z'),
  ('2026-10-18', '2026-10-18T00:00:00Z'),
  ('2026-10-24', '2026-10-24T00:00:00Z'),
  ('2026-10-25', '2026-10-25T00:00:00Z'),
  ('2026-10-26', now());

create or replace function public.consent_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-26' $$;

/** How long an agreement to the previous version keeps counting. */
create function public.consent_grace() returns interval
language sql immutable set search_path = '' as $$ select interval '90 days' $$;

/**
 * Whether `who` has health-data consent in force: to the version in force,
 * or to the one immediately before it while the grace runs. Withdrawn
 * agreements never count.
 */
create function public.consent_in_force(who uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = who
      and c.withdrawn_at is null
      and (
        c.policy_version = public.consent_version()
        or (
          c.policy_version = (select max(v.version) from public.consent_versions v
                              where v.version < public.consent_version())
          and now() < (select v.effective_at + public.consent_grace()
                       from public.consent_versions v
                       where v.version = public.consent_version())
        )
      )
  )
$$;

revoke execute on function public.consent_in_force(uuid) from public, anon, authenticated;

-- SECURITY: has_consent gates writing events and, for a guardian, access.
create or replace function public.has_consent() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.consent_in_force(auth.uid())
$$;

-- SECURITY: no guardian in household `h` has consent in force (grace included).
create or replace function public.household_frozen(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.memberships m
    where m.household_id = h and m.is_guardian and public.consent_in_force(m.user_id)
  )
$$;

/**
 * Frozen by an explicit withdrawal: frozen, at least one guardian's latest
 * health-data answer is a withdrawal, and no guardian's is a grant (a grant
 * that no longer counts is a lapse, which never starts the deletion clock).
 * Only this starts the frozen-household lifecycle.
 */
create function public.household_withdrawn(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with latest as (
    select (select e.action from public.consent_events e
            where e.user_id = m.user_id and e.purpose = 'health_data'
            order by e.created_at desc, e.id desc limit 1) as action
    from public.memberships m
    where m.household_id = h and m.is_guardian
  )
  select public.household_frozen(h)
    and exists (select 1 from latest where action = 'withdraw')
    and not exists (select 1 from latest where action = 'grant')
$$;

revoke execute on function public.household_withdrawn(uuid) from public, anon, authenticated;

-- Withdrawing: every agreement the person still has, the one in grace
-- included, each recorded with its version. Nothing to withdraw records
-- nothing, as before.
create or replace function public.withdraw_consent(locale text default null) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  withdrawn timestamptz;
  r record;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if withdraw_consent.locale is not null and withdraw_consent.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;
  for r in
    update public.consents set withdrawn_at = now()
    where user_id = me and withdrawn_at is null
    returning policy_version, withdrawn_at
  loop
    withdrawn := r.withdrawn_at;
    perform public.append_consent_event(
      me, 'health_data', r.policy_version, 'withdraw', 'consent', withdraw_consent.locale);
  end loop;
  return withdrawn;
end
$$;

-- The frozen-household lifecycle, now on household_withdrawn() -------------

create or replace function public.clear_frozen_clock(h uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.household_withdrawn(h) then
    return;
  end if;
  update public.households set frozen_since = null, frozen_warned_at = null
  where id = h and (frozen_since is not null or frozen_warned_at is not null);
  delete from public.inactivity_warning_emails where household_id = h and kind = 'frozen';
end
$$;

create or replace function public.warn_frozen_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_frozen_warning_after();
  warned integer;
begin
  with thawed as (
    update public.households h set frozen_since = null, frozen_warned_at = null
    where (h.frozen_since is not null or h.frozen_warned_at is not null)
      and not public.household_withdrawn(h.id)
    returning h.id
  )
  delete from public.inactivity_warning_emails q using thawed
  where q.household_id = thawed.id and q.kind = 'frozen';

  update public.households h set frozen_since = now()
  where h.frozen_since is null and public.household_withdrawn(h.id);

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

create or replace function public.household_warning_in_force(
  kind text, warned_at timestamptz, h public.households
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case kind
    when 'inactivity' then h.inactivity_warned_at = warned_at
                           and public.household_last_active_at(h.id) < warned_at
    when 'frozen' then h.frozen_warned_at = warned_at and public.household_withdrawn(h.id)
    else false
  end
$$;

create or replace function public.sweep_frozen_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare swept integer;
begin
  perform set_config('moraki.erasure_reason', 'frozen', true);
  with gone as (
    delete from public.households h
    where h.frozen_warned_at is not null
      and h.frozen_warned_at <= now() - public.household_frozen_notice()
      and h.frozen_since <= now() - public.household_frozen_warning_after()
      and public.household_withdrawn(h.id)
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

comment on column public.households.frozen_since is
  'When the household was first seen frozen by an explicit withdrawal (household_withdrawn). Null otherwise. Server only.';

-- Households on the clock only because a version lapsed come off it now,
-- with any warning and its queued emails.
with thawed as (
  update public.households h set frozen_since = null, frozen_warned_at = null
  where (h.frozen_since is not null or h.frozen_warned_at is not null)
    and not public.household_withdrawn(h.id)
  returning h.id
)
delete from public.inactivity_warning_emails q using thawed
where q.household_id = thawed.id and q.kind = 'frozen';
