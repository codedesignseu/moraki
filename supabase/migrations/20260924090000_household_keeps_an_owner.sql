-- P4-07: a household must always have an owner.
--
-- Found by testing the API rather than the screen: `memberships_update` and
-- `memberships_delete` both allow `user_id = auth.uid()`, so an owner could
-- demote themselves to viewer, or delete their own membership, and leave a
-- household nobody can administer. Nothing in the app offers it, but a stale
-- client, a script or devtools could, and the result is not recoverable from
-- inside the app: no owner means no invites, no roles, no settings.
--
-- This refuses the last owner leaving by either route. It does not stop an
-- owner stepping down once a second owner exists, which is what a future
-- handover (P4-06) needs.

create function public.memberships_keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owners_left int;
begin
  -- Only the owner's own row can empty the chair.
  if old.role <> 'owner' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  -- An update that leaves them owner changes nothing here.
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  select count(*) into owners_left
  from public.memberships
  where household_id = old.household_id and role = 'owner' and user_id <> old.user_id;

  if owners_left = 0 then
    raise exception 'a household must keep an owner'
      using errcode = 'insufficient_privilege';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger memberships_keep_an_owner before update or delete on public.memberships
  for each row execute function public.memberships_keep_an_owner();
