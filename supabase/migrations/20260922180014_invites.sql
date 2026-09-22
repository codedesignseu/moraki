-- P2-06: invites by link or code (research doc, SDD 7 `join/[code]`).
--
-- A code is 8 characters from an alphabet with no look-alikes (no I, L, O,
-- 0 or 1), so it can be read out or typed. The owner makes one with
-- create_invite; anyone signed in who isn't in a household yet redeems it
-- once with accept_invite, which adds them with the invite's role.

-- P2-01 checked the length; the alphabet is P2-06's.
alter table public.invites add constraint invites_code_alphabet
  check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$');
-- An invite can make a caregiver or a viewer, never another owner.
alter table public.invites add constraint invites_role_not_owner check (role <> 'owner');

-- How long an unused code works.
create function public.invite_lifetime() returns interval
language sql immutable as $$ select interval '7 days' $$;

-- Runs as the caller, so the invites insert policy (owner only) decides who
-- may make one. The code and expiry are made here, not by the client.
create function public.create_invite(household_id uuid, role public.member_role default 'caregiver')
returns table (code text, expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  b int;
begin
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

revoke execute on function public.create_invite from public, anon;
grant execute on function public.create_invite to authenticated;

-- Security definer: the person accepting isn't a member yet, so no policy
-- lets them read the invite or add their membership (SDD 4.3, RPC only).
-- Errors carry their own codes so the app can say what went wrong:
--   MKI01 no such code   MKI02 already used   MKI03 expired
--   MKI04 already in a household (one per account for now)
create function public.accept_invite(code text, display_name text, relation text default null)
returns table (household_id uuid, role public.member_role, baby_id uuid, baby_name text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wanted text := upper(regexp_replace(accept_invite.code, '[^A-Za-z0-9]', '', 'g'));
  invite public.invites%rowtype;
begin
  if me is null then
    raise exception 'sign in to accept an invite' using errcode = 'insufficient_privilege';
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

  return query select * from public.joined_household(invite.household_id, me);
end;
$$;

-- What the joining phone records: the household, the role it got, the baby.
create function public.joined_household(h uuid, member uuid)
returns table (household_id uuid, role public.member_role, baby_id uuid, baby_name text)
language sql stable security definer set search_path = '' as $$
  select m.household_id, m.role, b.id, b.name
  from public.memberships m
  join public.babies b on b.household_id = m.household_id and b.deleted_at is null
  where m.household_id = h and m.user_id = member
  order by b.updated_at
  limit 1
$$;

revoke execute on function public.accept_invite from public, anon;
grant execute on function public.accept_invite to authenticated;
-- Only accept_invite uses it; not callable from the API.
revoke execute on function public.joined_household from public, anon, authenticated;
