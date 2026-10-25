-- P0.2 (legal review; owner decision 2026-10-24): who may see and send a
-- baby's entries, and on what basis.
--
-- The parent or guardian gives health-data consent for the baby. Everyone
-- else in the household does not consent for the baby: they accept a
-- caregiver agreement for that household (what they will see, including the
-- full history, and that they keep it to the household). From here:
--
-- * Reading a household's entries, its baby and its members needs one of
--   the two: a guardian member with health-data consent to the version in
--   force, or a member whose latest answer to the caregiver agreement for
--   that household is a grant of the version in force. A member always sees
--   their own membership row, so a phone can tell "not yet agreed" from
--   "not a member".
-- * Writing them needs the same, as well as the role (can_write).
-- * create_household needs the Terms and health-data consent on record
--   before any baby data is stored. accept_invite needs the Terms, and
--   records the caregiver agreement as part of joining.
-- * my_membership_status() tells the app which of these is missing.
--
-- Existing members: a guardian (every owner, P0.1) keeps access while their
-- consent to the version in force stands. Every other member is asked once
-- for the caregiver agreement; until they accept, their phone stops reading
-- and sending, and keeps what it has.
--
-- The consent text now speaks to the guardian, so its version moves on and
-- every guardian is asked again.

create or replace function public.consent_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-24' $$;

/** The Terms of Use in force (P0.9). The app carries the same date (TERMS_VERSION). */
create function public.terms_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-24' $$;

/** The caregiver agreement in force. The app carries the same date. */
create function public.caregiver_agreement_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-24' $$;

grant execute on function public.terms_version, public.caregiver_agreement_version to authenticated;

-- Whether someone's latest answer for a purpose (in a household, where it is
-- about one) is a grant of `version`. A later withdrawal, or a grant of an
-- older text, is no agreement. Not callable by a client: it reads anyone's.
create function public.has_agreed(who uuid, purpose text, version text, household uuid default null)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.action = 'grant' and e.version = has_agreed.version
    from public.consent_events e
    where e.user_id = has_agreed.who
      and e.purpose = has_agreed.purpose
      and (has_agreed.household is null or e.household_id = has_agreed.household)
    order by e.created_at desc, e.id desc
    limit 1
  ), false)
$$;

revoke execute on function public.has_agreed from public, anon, authenticated;

/** The caller agreed to the Terms of Use in force. */
create function public.has_terms() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_agreed(auth.uid(), 'terms', public.terms_version())
$$;

/** The caller accepted the caregiver agreement in force for household `h`. */
create function public.has_caregiver_agreement(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_agreed(auth.uid(), 'caregiver_agreement', public.caregiver_agreement_version(), h)
$$;

/**
 * The caller may see household `h`'s baby data: a member who is a guardian
 * with consent in force, or who accepted the caregiver agreement for it.
 */
create function public.has_access(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = h and m.user_id = auth.uid()
      and ((m.is_guardian and public.has_consent()) or public.has_caregiver_agreement(h))
  )
$$;

revoke execute on function public.has_terms, public.has_caregiver_agreement, public.has_access
  from public, anon;
grant execute on function public.has_terms, public.has_caregiver_agreement, public.has_access
  to authenticated;

-- SECURITY: the read and write policies on baby data ----------------------
drop policy events_select on public.events;
drop policy events_insert on public.events;
drop policy events_update on public.events;
drop policy babies_select on public.babies;
drop policy babies_insert on public.babies;
drop policy babies_update on public.babies;
drop policy memberships_select on public.memberships;

create policy events_select on public.events for select to authenticated
  using (public.has_access(household_id));
-- has_access replaces has_consent: a guardian still needs consent, and a
-- caregiver needs the agreement instead.
create policy events_insert on public.events for insert to authenticated
  with check (
    public.can_write(household_id) and public.has_access(household_id)
    and created_by = auth.uid() and updated_by = auth.uid()
  );
create policy events_update on public.events for update to authenticated
  using (public.can_write(household_id) and public.has_access(household_id))
  with check (
    public.can_write(household_id) and public.has_access(household_id)
    and updated_by = auth.uid()
  );

create policy babies_select on public.babies for select to authenticated
  using (public.has_access(household_id));
create policy babies_insert on public.babies for insert to authenticated
  with check (public.can_write(household_id) and public.has_access(household_id));
create policy babies_update on public.babies for update to authenticated
  using (public.can_write(household_id) and public.has_access(household_id))
  with check (public.can_write(household_id) and public.has_access(household_id));

-- Your own membership always: it is how a phone finds its household.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_access(household_id));

-- record_consent: a caregiver agreement is always about one household.
create or replace function public.record_consent(
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
  if record_consent.purpose = 'caregiver_agreement' and record_consent.household_id is null then
    raise exception 'a caregiver agreement is for one household' using errcode = 'invalid_parameter_value';
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

-- create_household: the Terms and consent come before the baby's details
-- are stored. Same signature as P0.1's, so nothing else changes for the app.
--   MK003 health-data consent missing   MK004 Terms missing
create or replace function public.create_household(
  household_id uuid,
  baby_id uuid,
  baby_name text,
  born_at timestamptz,
  display_name text,
  relation text default null,
  birth_weight_g int default null,
  guardian_declared boolean default false,
  guardian_version text default null,
  locale text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  name text := nullif(btrim(baby_name), '');
begin
  if me is null then
    raise exception 'sign in to create a household' using errcode = 'insufficient_privilege';
  end if;
  if create_household.guardian_declared is not true then
    raise exception 'only a parent or legal guardian can create a household'
      using errcode = 'MK001';
  end if;
  if create_household.guardian_version is null
     or create_household.guardian_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'guardian_version must be a date' using errcode = 'invalid_parameter_value';
  end if;
  if create_household.locale is not null and create_household.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;

  if exists (select 1 from public.households h where h.id = create_household.household_id) then
    -- A retry of the caller's own request: already done.
    if public.is_owner(create_household.household_id) then
      return;
    end if;
    raise exception 'household id already in use' using errcode = 'unique_violation';
  end if;

  if not public.has_terms() then
    raise exception 'agree to the Terms of Use first' using errcode = 'MK004';
  end if;
  if not public.has_consent() then
    raise exception 'agree to health data being processed first' using errcode = 'MK003';
  end if;

  insert into public.households (id, name, created_by)
    values (create_household.household_id, name, me);
  insert into public.memberships
      (household_id, user_id, role, display_name, relation, is_guardian)
    values (create_household.household_id, me, 'owner', btrim(create_household.display_name),
            create_household.relation, true);
  insert into public.babies (id, household_id, name, born_at, birth_weight_g)
    values (create_household.baby_id, create_household.household_id, name,
            create_household.born_at, create_household.birth_weight_g);
  perform public.append_consent_event(
    me, 'guardian_declaration', create_household.guardian_version, 'grant',
    'guardianDeclaration', create_household.locale,
    create_household.household_id, create_household.baby_id);
end;
$$;

-- What a code would make the caller, before they decide to join: the role,
-- and nothing about the household or baby. Counted like a join attempt.
create function public.invite_preview(code text)
returns table (role public.member_role, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wanted text := upper(regexp_replace(invite_preview.code, '[^A-Za-z0-9]', '', 'g'));
  invite public.invites%rowtype;
begin
  if me is null then
    raise exception 'sign in to join a household' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.invite_attempts a
    where a.user_id = me and a.attempted_at > now() - public.invite_attempt_freshness()
  ) then
    raise exception 'too many attempts' using errcode = 'MKI05';
  end if;

  select * into invite from public.invites i where i.code = wanted;
  if not found then
    raise exception 'no such invite' using errcode = 'MKI01';
  end if;
  if invite.used_at is not null then
    raise exception 'invite already used' using errcode = 'MKI02';
  end if;
  if invite.expires_at <= now() then
    raise exception 'invite expired' using errcode = 'MKI03';
  end if;
  if exists (select 1 from public.memberships m where m.user_id = me) then
    raise exception 'already in a household' using errcode = 'MKI04';
  end if;

  return query select invite.role, invite.expires_at;
end;
$$;

revoke execute on function public.invite_preview from public, anon;
grant execute on function public.invite_preview to authenticated;

-- accept_invite: the Terms first, and the caregiver agreement recorded with
-- the membership, in one transaction. The old signature goes, so an app from
-- before this change is refused rather than joining without agreeing.
--   MKI06 Terms missing   MKI07 caregiver agreement missing or out of date
drop function public.accept_invite(text, text, text);

create function public.accept_invite(
  code text,
  display_name text,
  relation text default null,
  agreement_version text default null,
  locale text default null
)
returns table (household_id uuid, role public.member_role, baby_id uuid, baby_name text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wanted text := upper(regexp_replace(accept_invite.code, '[^A-Za-z0-9]', '', 'g'));
  invite public.invites%rowtype;
  joined record;
begin
  if me is null then
    raise exception 'sign in to accept an invite' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.invite_attempts a
    where a.user_id = me and a.attempted_at > now() - public.invite_attempt_freshness()
  ) then
    raise exception 'too many attempts' using errcode = 'MKI05';
  end if;

  if accept_invite.locale is not null and accept_invite.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;
  if not public.has_terms() then
    raise exception 'agree to the Terms of Use first' using errcode = 'MKI06';
  end if;
  if accept_invite.agreement_version is distinct from public.caregiver_agreement_version() then
    raise exception 'accept the caregiver agreement first' using errcode = 'MKI07';
  end if;

  select * into invite from public.invites i where i.code = wanted for update;
  if not found then
    raise exception 'no such invite' using errcode = 'MKI01';
  end if;

  if invite.used_at is not null then
    -- A retry of the caller's own accept: already done.
    if invite.used_by = me and public.is_member(invite.household_id) then
      return query select * from public.joined_household(invite.household_id, me);
      return;
    end if;
    raise exception 'invite already used' using errcode = 'MKI02';
  end if;
  if invite.expires_at <= now() then
    raise exception 'invite expired' using errcode = 'MKI03';
  end if;
  if exists (select 1 from public.memberships m where m.user_id = me) then
    raise exception 'already in a household' using errcode = 'MKI04';
  end if;

  insert into public.memberships (household_id, user_id, role, display_name, relation)
    values (invite.household_id, me, invite.role, btrim(accept_invite.display_name),
            accept_invite.relation);
  update public.invites i set used_by = me, used_at = now() where i.code = wanted;

  select * into joined from public.joined_household(invite.household_id, me);
  perform public.append_consent_event(
    me, 'caregiver_agreement', accept_invite.agreement_version, 'grant', 'caregiverAgreement',
    accept_invite.locale, invite.household_id, joined.baby_id);

  return query select * from public.joined_household(invite.household_id, me);
end;
$$;

revoke execute on function public.accept_invite from public, anon;
grant execute on function public.accept_invite to authenticated;

-- Where the caller stands with household `h`, so the app knows what to ask
-- and when to stop:
--   status  member | not_member | household_gone
--   access  granted | needs_consent (a guardian without consent in force)
--           | needs_agreement (anyone else without the caregiver agreement)
-- For a member, the baby's id and first name: the household's own name for
-- itself, which they were given when they joined. Nothing else.
create function public.my_membership_status(household_id uuid)
returns table (
  status text,
  role public.member_role,
  is_guardian boolean,
  access text,
  baby_id uuid,
  baby_name text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  mine public.memberships%rowtype;
  h uuid := my_membership_status.household_id;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.households x where x.id = h) then
    return query select 'household_gone'::text, null::public.member_role, null::boolean,
      null::text, null::uuid, null::text;
    return;
  end if;
  select * into mine from public.memberships m where m.household_id = h and m.user_id = me;
  if not found then
    return query select 'not_member'::text, null::public.member_role, null::boolean,
      null::text, null::uuid, null::text;
    return;
  end if;

  return query
    select 'member'::text, mine.role, mine.is_guardian,
      case
        when public.has_access(h) then 'granted'
        when mine.is_guardian then 'needs_consent'
        else 'needs_agreement'
      end,
      b.id, b.name
    from (select 1) one
    left join lateral (
      select x.id, x.name from public.babies x
      where x.household_id = h and x.deleted_at is null
      order by x.updated_at limit 1
    ) b on true;
end;
$$;

revoke execute on function public.my_membership_status from public, anon;
grant execute on function public.my_membership_status to authenticated;
