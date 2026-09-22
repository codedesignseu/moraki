-- P2-05: create_household, the RPC that SDD table 4.3 names for the first
-- membership. One call, one transaction: the household, the caller as its
-- owner, and the baby. Security definer because memberships have no insert
-- policy (RPC only); everything else it does, the caller could do anyway.
--
-- Ids come from the client (UUID v7, like events), so a retry after a lost
-- response finds its own household and succeeds without making a second one.
-- The household's name is the baby's: there is one baby per household for now,
-- and the app shows it as the baby's household.
create function public.create_household(
  household_id uuid,
  baby_id uuid,
  baby_name text,
  born_at timestamptz,
  display_name text,
  relation text default null,
  birth_weight_g int default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  name text := nullif(btrim(baby_name), '');
begin
  if me is null then
    raise exception 'sign in to create a household' using errcode = 'insufficient_privilege';
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
  insert into public.memberships (household_id, user_id, role, display_name, relation)
    values (create_household.household_id, me, 'owner', btrim(create_household.display_name),
            create_household.relation);
  insert into public.babies (id, household_id, name, born_at, birth_weight_g)
    values (create_household.baby_id, create_household.household_id, name,
            create_household.born_at, create_household.birth_weight_g);
end;
$$;

revoke execute on function public.create_household from public, anon;
grant execute on function public.create_household to authenticated;
