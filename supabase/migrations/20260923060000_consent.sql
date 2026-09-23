-- P3-09: explicit consent for health data (SDD 12, Article 9(2)(a)).
--
-- Every caregiver consents for themselves, on its own screen, never bundled
-- with anything else, and the version of the policy they agreed to is stored
-- with the grant. Withdrawing stops that user syncing; it never deletes what
-- is already there, and it never touches anyone else in the household.
--
-- The rule is enforced here, not in the app: a phone with an old build, or
-- anything else holding a token, is refused by the database.

/** The policy version the app asks for today. Bumping it asks everyone again. */
create function public.consent_version() returns text
language sql immutable set search_path = '' as $$ select '2026-09-23' $$;

/**
 * Whether this user may write health data: a consent row they have not
 * withdrawn, for the version in force. Security definer so a policy can read
 * consents without needing a select policy of its own on every path.
 */
create function public.has_consent() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consents
    where user_id = auth.uid()
      and policy_version = public.consent_version()
      and withdrawn_at is null
  )
$$;

/**
 * Records consent for the version in force, as the caller. Granting again is
 * harmless: it re-grants a withdrawn one rather than failing, so a caregiver
 * who changes their mind twice isn't stuck.
 */
create function public.grant_consent() returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare granted timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.consents (user_id, policy_version)
  values (auth.uid(), public.consent_version())
  on conflict (user_id, policy_version)
    do update set withdrawn_at = null, granted_at = now()
  returning consents.granted_at into granted;
  return granted;
end
$$;

/** Withdraws it. The rows already synced stay; this user simply stops writing. */
create function public.withdraw_consent() returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare withdrawn timestamptz;
begin
  update public.consents set withdrawn_at = now()
  where user_id = auth.uid() and policy_version = public.consent_version()
    and withdrawn_at is null
  returning consents.withdrawn_at into withdrawn;
  return withdrawn;
end
$$;

-- SECURITY: writing an event now needs consent as well as membership. Reading
-- does not: a caregiver who withdraws can still see what is already there, and
-- can still export and delete it (SDD 12).
drop policy events_insert on public.events;
drop policy events_update on public.events;

create policy events_insert on public.events for insert to authenticated
  with check (
    public.can_write(household_id) and created_by = auth.uid() and updated_by = auth.uid()
    and public.has_consent()
  );

create policy events_update on public.events for update to authenticated
  using (public.can_write(household_id) and public.has_consent())
  with check (public.can_write(household_id) and updated_by = auth.uid() and public.has_consent());

grant execute on function public.grant_consent() to authenticated;
grant execute on function public.withdraw_consent() to authenticated;
grant execute on function public.consent_version() to authenticated;
