-- P0.3 (legal review; owner decision 2026-10-24): what withdrawing does.
--
-- The lawful basis for a household's baby data is the consent of a parent
-- or guardian in it (P0.2). So:
--
-- * A guardian withdrawing while another guardian in the household still
--   has consent in force: only the withdrawing guardian's own processing
--   stops (has_access already says so).
-- * The last such consent going: the household is FROZEN. Derived, not
--   stored (rule 4): household_frozen(h) is true while no guardian member
--   has consent in force. While frozen, nobody writes baby data, no invite
--   is made and nobody joins, and members who aren't guardians read nothing.
--   A guardian giving consent again, or another member declaring and
--   consenting, unfreezes it; the owner can also delete it.
-- * Withdrawing never stops erasure: anyone may still soft delete the
--   entries they wrote, and read them, whatever their access. Only the
--   deletion is exempt, never an edit.
-- * A caregiver withdrawing the caregiver agreement leaves the household:
--   leave_household records that withdrawal as it removes them.
--
-- The withdrawal paragraph of the consent text now says this, so the version
-- in force moves on.

create or replace function public.consent_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-25' $$;

/** No guardian in household `h` has health-data consent in force. */
create function public.household_frozen(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1
    from public.memberships m
    join public.consents c on c.user_id = m.user_id
    where m.household_id = h
      and m.is_guardian
      and c.policy_version = public.consent_version()
      and c.withdrawn_at is null
  )
$$;

revoke execute on function public.household_frozen from public, anon;
grant execute on function public.household_frozen to authenticated;

-- A caregiver's agreement counts only while the household isn't frozen. A
-- guardian with consent never sees it frozen: their consent is what keeps it
-- open.
create or replace function public.has_access(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = h and m.user_id = auth.uid()
      and (
        (m.is_guardian and public.has_consent())
        or (public.has_caregiver_agreement(h) and not public.household_frozen(h))
      )
  )
$$;

-- SECURITY: authors keep reading, and may soft delete, their own entries ---
drop policy events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (
    public.has_access(household_id)
    or (created_by = auth.uid() and public.is_member(household_id))
  );

-- An extra way to update, alongside events_update: the author marking their
-- own entry deleted. The trigger below makes sure that is all it does.
create policy events_erase_own on public.events for update to authenticated
  using (created_by = auth.uid() and public.is_member(household_id))
  with check (
    created_by = auth.uid() and updated_by = auth.uid() and deleted_at is not null
  );

-- Someone without write access (withdrawn, not yet agreed, or frozen) only
-- ever gets here through events_erase_own: then the update must be the
-- deletion and nothing else. Named to sort before events_keep_columns and
-- events_stamp_seq, so a refused update takes no seq.
create function public.events_erasure_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and not (public.can_write(old.household_id) and public.has_access(old.household_id)) then
    if old.deleted_at is not null
       or new.deleted_at is null
       or new.payload is distinct from old.payload
       or new.occurred_at is distinct from old.occurred_at
       or new.ended_at is distinct from old.ended_at
       or new.group_id is distinct from old.group_id then
      raise exception 'without access, an entry can only be deleted by its author'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger events_erasure_only before update on public.events
  for each row execute function public.events_erasure_only();

-- No invites into a frozen household -----------------------------------------
--   MK005 the household is paused
drop policy invites_insert on public.invites;
create policy invites_insert on public.invites for insert to authenticated
  with check (
    public.is_owner(household_id) and created_by = auth.uid()
    and not public.household_frozen(household_id)
  );

create or replace function public.create_invite(household_id uuid, role public.member_role default 'caregiver')
returns table (code text, expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  b int;
begin
  if public.is_owner(create_invite.household_id)
     and public.household_frozen(create_invite.household_id) then
    raise exception 'this household is paused' using errcode = 'MK005';
  end if;
  loop
    candidate := '';
    -- Random bytes from gen_random_uuid (a strong source); bytes of 240 and
    -- over are skipped so each of the 30 characters is equally likely.
    while length(candidate) < 8 loop
      foreach b in array (
        select array_agg(get_byte(uuid_send(gen_random_uuid()), i)) from generate_series(0, 15) i
      ) loop
        if b < 240 and length(candidate) < 8 then
          candidate := candidate || substr(alphabet, b % 30 + 1, 1);
        end if;
      end loop;
    end loop;
    begin
      insert into public.invites (code, household_id, role, created_by, expires_at)
        values (candidate, create_invite.household_id, create_invite.role, auth.uid(),
                now() + public.invite_lifetime());
      return query select candidate, now() + public.invite_lifetime();
      return;
    exception when unique_violation then
      -- A clash with an existing code: draw again.
    end;
  end loop;
end;
$$;

-- No joins either: a code made before the freeze stops working while it
-- lasts. MKI08 the household is paused.
create or replace function public.invite_preview(code text)
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
  if public.household_frozen(invite.household_id) then
    raise exception 'this household is paused' using errcode = 'MKI08';
  end if;

  return query select invite.role, invite.expires_at;
end;
$$;

create or replace function public.accept_invite(
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
  if public.household_frozen(invite.household_id) then
    raise exception 'this household is paused' using errcode = 'MKI08';
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

-- Leaving ends the caregiver agreement, and the record says so. `locale` is
-- the language of the screen that confirmed it; an app from before this
-- change calls without it.
drop function public.leave_household(uuid, uuid);

create function public.leave_household(
  household_id uuid,
  successor uuid default null,
  locale text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_member(leave_household.household_id) then
    raise exception 'not a member of this household' using errcode = 'insufficient_privilege';
  end if;
  if leave_household.locale is not null and leave_household.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.memberships m
                 where m.household_id = leave_household.household_id and m.user_id <> me) then
    raise exception 'the only member can''t leave; delete the household instead'
      using errcode = 'restrict_violation';
  end if;

  if public.has_agreed(me, 'caregiver_agreement', public.caregiver_agreement_version(),
                       leave_household.household_id) then
    perform public.append_consent_event(
      me, 'caregiver_agreement', public.caregiver_agreement_version(), 'withdraw',
      'leaveHousehold', leave_household.locale, leave_household.household_id);
  end if;

  perform public.hand_over_and_leave(leave_household.household_id, me, leave_household.successor);
end;
$$;

revoke execute on function public.leave_household from public, anon;
grant execute on function public.leave_household to authenticated;

-- my_membership_status: `frozen` while no guardian has consent in force.
create or replace function public.my_membership_status(household_id uuid)
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
        when public.household_frozen(h) then 'frozen'
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
