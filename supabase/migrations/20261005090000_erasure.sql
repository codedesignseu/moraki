-- P4-06: leave a household, delete a household, delete an account.
--
-- Apple requires an app that creates accounts to delete them from inside the
-- app (App Store guideline 5.1.1(v)), and the DPIA names erasure as one of the
-- three things a public release waits on.
--
-- What an account's deletion removes, and what it leaves:
--
-- * The person: their auth row (email, identities, sessions), every
--   membership (and so their display name), consents, push tokens, feedback
--   and invite attempts. All of these already cascade from auth.users.
-- * A household where they are the only member: the whole household, its
--   baby and every entry. Nobody else can reach it.
-- * A household others share: it stays, because the entries are the other
--   caregivers' record of their baby too. If the person was its only owner,
--   ownership passes to the longest-standing caregiver, or the
--   longest-standing viewer if there is no caregiver.
--
-- Entries they logged in a shared household keep their author's id. With the
-- auth row and the membership gone, that id names no one: the app already
-- shows such an entry as logged by someone who has left (P4-07). To let the
-- auth row go, the authorship columns stop being foreign keys to auth.users.
-- New rows lose nothing by it: the insert policies still pin created_by and
-- updated_by to auth.uid(), so a client can only ever write its own id.

alter table public.events drop constraint events_created_by_fkey;
alter table public.events drop constraint events_updated_by_fkey;
alter table public.households drop constraint households_created_by_fkey;
alter table public.invites drop constraint invites_created_by_fkey;
alter table public.invites drop constraint invites_used_by_fkey;

-- A household being deleted takes its memberships with it, owner included.
-- The cascade runs after the household row is gone, so its absence is how the
-- rule tells a deletion from an owner walking away (P4-07).
create or replace function public.memberships_keep_an_owner() returns trigger
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
  -- The household itself is going: there is no chair left to keep.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.households where id = old.household_id) then
    return old;
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

-- Removes `who` from household `h`, first handing ownership on if they hold
-- the last of it. Not callable by a client: leave_household and
-- delete_account check who is asking, then call this.
create function public.hand_over_and_leave(h uuid, who uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare successor uuid;
begin
  if exists (select 1 from public.memberships
             where household_id = h and user_id = who and role = 'owner')
     and not exists (select 1 from public.memberships
                     where household_id = h and role = 'owner' and user_id <> who) then
    select user_id into successor
    from public.memberships
    where household_id = h and user_id <> who
    order by (role = 'caregiver') desc, joined_at, user_id
    limit 1;

    update public.memberships set role = 'owner'
    where household_id = h and user_id = successor;
  end if;

  delete from public.memberships where household_id = h and user_id = who;
end;
$$;

revoke execute on function public.hand_over_and_leave from public, anon, authenticated;

-- The caller leaves a household that others will carry on with. The only
-- member can't leave; their way out is delete_household.
create function public.leave_household(household_id uuid) returns void
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

  perform public.hand_over_and_leave(leave_household.household_id, me);
end;
$$;

revoke execute on function public.leave_household from public, anon;
grant execute on function public.leave_household to authenticated;

-- An owner deletes the household for everyone: the baby, every entry, every
-- membership and invite. Irreversible, and the app says so before calling.
create function public.delete_household(household_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(delete_household.household_id) then
    raise exception 'only an owner can delete a household' using errcode = 'insufficient_privilege';
  end if;

  delete from public.households h where h.id = delete_household.household_id;
end;
$$;

revoke execute on function public.delete_household from public, anon;
grant execute on function public.delete_household to authenticated;

-- The caller's account goes, as described at the top of this file. One
-- transaction: if any step fails, nothing is deleted.
create function public.delete_account() returns void
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
      perform public.hand_over_and_leave(h, me);
    else
      delete from public.households where id = h;
    end if;
  end loop;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;
