-- D3, decided 2026-10-05: when the only owner leaves or deletes their account
-- while others remain, they choose who becomes owner. The app sends that
-- person's id; the server checks they belong to the household.
--
-- The automatic choice from 20261005090000 (longest-standing caregiver, then
-- viewer) stays as the fallback for a caller that names nobody, such as an
-- app version from before this change.

drop function public.leave_household(uuid);
drop function public.delete_account();
drop function public.hand_over_and_leave(uuid, uuid);

create function public.hand_over_and_leave(h uuid, who uuid, successor uuid) returns void
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
    else
      select user_id into next_owner
      from public.memberships
      where household_id = h and user_id <> who
      order by (role = 'caregiver') desc, joined_at, user_id
      limit 1;
    end if;

    update public.memberships set role = 'owner'
    where household_id = h and user_id = next_owner;
  end if;

  delete from public.memberships where household_id = h and user_id = who;
end;
$$;

revoke execute on function public.hand_over_and_leave from public, anon, authenticated;

create function public.leave_household(household_id uuid, successor uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_member(leave_household.household_id) then
    raise exception 'not a member of this household' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.memberships m
                 where m.household_id = leave_household.household_id and m.user_id <> me) then
    raise exception 'the only member can''t leave; delete the household instead'
      using errcode = 'restrict_violation';
  end if;

  perform public.hand_over_and_leave(leave_household.household_id, me, leave_household.successor);
end;
$$;

revoke execute on function public.leave_household from public, anon;
grant execute on function public.leave_household to authenticated;

-- One household per account for now, so one successor. With more than one
-- shared household, the successor applies where they are a member and the
-- call is refused where they are not.
create function public.delete_account(successor uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  h uuid;
begin
  if me is null then
    raise exception 'sign in to delete an account' using errcode = 'insufficient_privilege';
  end if;

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

revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;
