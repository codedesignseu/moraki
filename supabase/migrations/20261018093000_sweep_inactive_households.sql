-- docs/compliance/retention.md promises that a household nobody has used
-- for 24 months is deleted. 20260928090000_retention_sweeps.sql left it out
-- because delete_household did not exist yet. It does now (P4-06), and this
-- sweep deletes exactly what delete_household deletes: the household row,
-- with its babies, entries, memberships and invites going by cascade.
--
-- Not built: the warning email 30 days before. There is still no path that
-- sends email other than Supabase Auth's sign-in code, so the household is
-- deleted without notice. docs/compliance/retention.md says so.
--
-- "Used" means any of these, by anyone in the household, within the limit:
--   * an entry written or changed (events.server_updated_at, which the
--     events_stamp_seq trigger sets on every insert and update)
--   * a baby's details changed (babies.updated_at)
--   * the household created, or someone joining it
--   * any member signing in (auth.users.last_sign_in_at) or their session
--     being refreshed (auth.sessions.updated_at). A phone that stays signed
--     in refreshes its token instead of signing in again, so the session is
--     the signal that someone still opens the app even if they only read.

/** How long a household may go unused before the sweep deletes it. */
create function public.household_inactivity_limit() returns interval
language sql immutable set search_path = '' as $$ select interval '24 months' $$;

/**
 * Deletes every household with no activity since the limit, and returns how
 * many went. Activity exactly at the cutoff counts as activity. Safe to run
 * any number of times: a second run finds nothing left to delete.
 */
create function public.sweep_inactive_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_inactivity_limit();
  swept integer;
begin
  with gone as (
    delete from public.households h
    where h.created_at < cutoff
      and not exists (select 1 from public.events e
                      where e.household_id = h.id and e.server_updated_at >= cutoff)
      and not exists (select 1 from public.babies b
                      where b.household_id = h.id and b.updated_at >= cutoff)
      and not exists (select 1 from public.memberships m
                      where m.household_id = h.id and m.joined_at >= cutoff)
      and not exists (select 1 from public.memberships m
                      join auth.users u on u.id = m.user_id
                      where m.household_id = h.id and u.last_sign_in_at >= cutoff)
      and not exists (select 1 from public.memberships m
                      join auth.sessions s on s.user_id = m.user_id
                      where m.household_id = h.id
                        and greatest(s.created_at, s.updated_at) >= cutoff)
    returning 1
  )
  select count(*)::integer into swept from gone;
  return swept;
end
$$;

revoke execute on function public.sweep_inactive_households from public, anon, authenticated;

-- Daily, off-peak UTC, after the other two sweeps. cron.schedule is
-- idempotent by job name, so a `supabase db reset` does not add a second job.
select cron.schedule('sweep-inactive-households', '31 3 * * *',
  'select public.sweep_inactive_households()');
