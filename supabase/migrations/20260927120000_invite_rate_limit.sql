-- P2-F7: nothing limited guesses at an invite code. `accept_invite` is
-- security definer and runs in its own transaction per call, so a failure
-- (wrong code, used, expired) can never be durably counted from inside
-- accept_invite itself: any uncaught exception rolls back everything that
-- transaction did, including a log row written moments before the raise.
-- Proven against this database rather than assumed, then designed around.
--
-- The fix rate-limits ATTEMPTS rather than only failures, which is the
-- stronger and more standard posture anyway — you cannot tell in advance
-- which guess will succeed, so counting only failures protects nothing on
-- the attempt that happens to land. record_invite_attempt() is called by
-- the client immediately before accept_invite; it never has a later raise
-- in the same call, so its own count survives every time. accept_invite
-- then requires a very recent attempt row to exist before it will even
-- look up a code, which is what forces a client — malicious or not — to
-- keep calling record_invite_attempt() to keep guessing.

create table public.invite_attempts (
  user_id uuid not null references auth.users on delete cascade,
  attempted_at timestamptz not null default now()
);

create index invite_attempts_by_user on public.invite_attempts (user_id, attempted_at desc);

-- No client ever reads or writes this table directly; both functions below
-- are security definer and bypass RLS. Enabled with no policies anyway, the
-- project's default-deny convention, so a misconfigured search_path or a
-- future PostgREST exposure change still leaves it unreachable from the API.
alter table public.invite_attempts enable row level security;

/** How many attempts in the window before record_invite_attempt refuses. */
create function public.invite_attempt_limit() returns int
language sql immutable as $$ select 20 $$;

create function public.invite_attempt_window() returns interval
language sql immutable as $$ select interval '1 hour' $$;

-- How fresh a recorded attempt must be for accept_invite to honour it. This
-- checks "was there a recent attempt", not "was the most recent one within
-- the cap" — so right at the moment a caller hits invite_attempt_limit(),
-- the batch of attempts that got them there is itself still fresh, giving a
-- few seconds' grace on accept_invite before staleness closes it for good.
-- A handful of extra guesses within a five second window, not a hole in the
-- hourly cap; tightening it further was not worth the added complexity.
/** How fresh a recorded attempt must be for accept_invite to honour it. */
create function public.invite_attempt_freshness() returns interval
language sql immutable as $$ select interval '5 seconds' $$;

/**
 * Records one attempt to join by code, for the signed-in caller. Refuses
 * once the caller has made invite_attempt_limit() attempts within
 * invite_attempt_window() — checked before the insert, so a caller already
 * over the limit adds nothing further to the table.
 */
create function public.record_invite_attempt() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in to join a household' using errcode = 'insufficient_privilege';
  end if;

  if (
    select count(*) from public.invite_attempts
    where user_id = me and attempted_at > now() - public.invite_attempt_window()
  ) >= public.invite_attempt_limit() then
    raise exception 'too many attempts' using errcode = 'MKI05';
  end if;

  insert into public.invite_attempts (user_id) values (me);
end;
$$;

revoke execute on function public.record_invite_attempt from public, anon;
grant execute on function public.record_invite_attempt to authenticated;

-- SECURITY: accept_invite now refuses outright unless the caller made a
-- record_invite_attempt() call within the last few seconds. This is a
-- read-only check, first thing in the function, so a caller who never
-- calls record_invite_attempt() (or whose last call has gone stale) is
-- refused before any invite is looked up, no rollback subtlety involved.
create or replace function public.accept_invite(code text, display_name text, relation text default null)
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

  if not exists (
    select 1 from public.invite_attempts
    where user_id = me and attempted_at > now() - public.invite_attempt_freshness()
  ) then
    raise exception 'too many attempts' using errcode = 'MKI05';
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

revoke execute on function public.accept_invite from public, anon;
grant execute on function public.accept_invite to authenticated;
