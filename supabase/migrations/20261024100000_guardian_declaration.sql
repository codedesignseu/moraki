-- P0.1 (legal review; owner decision 2026-10-24): only someone who has
-- declared they are the child's parent or legal guardian, or otherwise has
-- lawful authority over the child's information, can own a household, and
-- ownership passes only to someone who has made that declaration.
--
-- * memberships.is_guardian marks a member who has declared. Only the
--   functions below set it; a client can't, through any policy.
-- * create_household requires the declaration and records it as a
--   consent_events row (purpose guardian_declaration, P0.4).
-- * declare_guardian lets an existing member make it later.
-- * A member becomes owner only if they have declared: handing over on
--   leaving or deleting an account picks only among them. With nobody to
--   hand to, the last owner must delete the household, or first have
--   another member declare.
--
-- Existing owners created their household, so they are marked as guardians
-- here. Their declaration was never recorded, though: the app asks them once
-- (an owner with no guardian_declaration event is asked before syncing).

alter table public.memberships add column is_guardian boolean not null default false;

update public.memberships set is_guardian = true where role = 'owner';

-- A client may change a member's role, and the owner their own name, but
-- never whether someone has declared. Functions run as their owner.
create function public.memberships_guardian_locked() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.is_guardian is distinct from old.is_guardian then
    raise exception 'a guardian declaration is made by declare_guardian'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger memberships_guardian_locked before update on public.memberships
  for each row execute function public.memberships_guardian_locked();

-- Whoever becomes owner, by any route, has declared. Memberships are made
-- only by create_household (an owner who declared) and accept_invite (never
-- an owner), so becoming owner is always an update.
create function public.memberships_owner_is_guardian() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.role = 'owner' and old.role <> 'owner' and not new.is_guardian then
    raise exception 'only a member who has declared they are a parent or guardian can be an owner'
      using errcode = 'MK001';
  end if;
  return new;
end;
$$;

-- Named to sort after memberships_self_update, so a caregiver trying to make
-- themselves owner is told they can't change roles at all.
create trigger memberships_upgrade_to_owner before update on public.memberships
  for each row execute function public.memberships_owner_is_guardian();

-- create_household now needs the declaration. Its old signature goes, so an
-- app from before this change is refused rather than skipping it.
drop function public.create_household(uuid, uuid, text, timestamptz, text, text, int);

create function public.create_household(
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

revoke execute on function public.create_household from public, anon;
grant execute on function public.create_household to authenticated;

-- A member of the household declares, now or again. Recorded every time,
-- so an owner marked as a guardian above can make the declaration on record.
create function public.declare_guardian(
  household_id uuid,
  version text,
  locale text default null
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_member(declare_guardian.household_id) then
    raise exception 'not a member of this household' using errcode = 'insufficient_privilege';
  end if;
  if declare_guardian.version is null or declare_guardian.version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'version must be a date' using errcode = 'invalid_parameter_value';
  end if;
  if declare_guardian.locale is not null and declare_guardian.locale not in ('en', 'el') then
    raise exception 'unknown locale' using errcode = 'invalid_parameter_value';
  end if;

  update public.memberships m set is_guardian = true
  where m.household_id = declare_guardian.household_id and m.user_id = me;

  return public.append_consent_event(
    me, 'guardian_declaration', declare_guardian.version, 'grant', 'guardianDeclaration',
    declare_guardian.locale, declare_guardian.household_id,
    (select b.id from public.babies b
     where b.household_id = declare_guardian.household_id and b.deleted_at is null
     order by b.updated_at limit 1));
end;
$$;

revoke execute on function public.declare_guardian from public, anon;
grant execute on function public.declare_guardian to authenticated;

-- Handing over: the successor named, or the longest-standing caregiver, then
-- viewer, must have declared. With nobody who has, the last owner can't
-- leave; they delete the household or ask someone to declare first.
create or replace function public.hand_over_and_leave(h uuid, who uuid, successor uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare next_owner uuid := successor;
begin
  if exists (select 1 from public.memberships
             where household_id = h and user_id = who and role = 'owner')
     and not exists (select 1 from public.memberships
                     where household_id = h and role = 'owner' and user_id <> who) then
    if next_owner is not null then
      if next_owner = who or not exists (select 1 from public.memberships
                                         where household_id = h and user_id = next_owner) then
        raise exception 'the new owner must be another member of this household'
          using errcode = 'invalid_parameter_value';
      end if;
      if not exists (select 1 from public.memberships
                     where household_id = h and user_id = next_owner and is_guardian) then
        raise exception 'the new owner must have declared they are a parent or guardian'
          using errcode = 'invalid_parameter_value';
      end if;
    else
      select user_id into next_owner
      from public.memberships
      where household_id = h and user_id <> who and is_guardian
      order by (role = 'caregiver') desc, joined_at, user_id
      limit 1;
      if next_owner is null then
        raise exception 'nobody else here has declared they are a parent or guardian'
          using errcode = 'MK002';
      end if;
    end if;

    update public.memberships set role = 'owner'
    where household_id = h and user_id = next_owner;
  end if;

  delete from public.memberships where household_id = h and user_id = who;
end;
$$;
