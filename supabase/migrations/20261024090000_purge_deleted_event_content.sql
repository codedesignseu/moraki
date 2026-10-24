-- P0.6: a deleted entry's content is purged 30 days after it was deleted.
--
-- Until now a soft-deleted entry (rule 7) kept its whole payload on the
-- server for the life of the household. The row itself has to stay: it is
-- the tombstone that tells every phone the entry is gone (pull reads by seq,
-- SDD 5.3), and it is what makes a late retry of the original insert land on
-- "ignored, deleted" instead of creating the entry again (push_events).
-- What it carries does not have to stay. After 30 days the row keeps only
-- what sync needs:
--
--   kept      id, household_id, baby_id, type, created_by, client_created_at
--             (all locked by events_keep_columns), updated_by, deleted_at, seq
--   cleared   payload -> '{}', ended_at -> null, group_id -> null
--   moved     occurred_at -> deleted_at. The column is NOT NULL; nothing reads
--             a deleted row's time (every index and query on it is for live
--             rows), so the real time of the feed or the medicine goes too.
--   added     purged_at, when this happened
--
-- The update goes through events_stamp_seq like any other, so it takes a new
-- seq and every phone pulls the empty tombstone and drops its own copy.

alter table public.events add column purged_at timestamptz;

-- The shape of a purged row, so nothing can be marked purged and keep content.
alter table public.events add constraint events_purged_is_tombstone check (
  purged_at is null
  or (deleted_at is not null and payload = '{}'::jsonb and ended_at is null and group_id is null)
);

/** How long a deleted entry keeps its content. */
create function public.deleted_content_retention() returns interval
language sql immutable set search_path = '' as $$ select interval '30 days' $$;

/**
 * Empties every entry deleted more than 30 days ago that is not yet empty,
 * and returns how many. Safe to run any number of times: a purged row is
 * never picked again.
 */
create function public.purge_deleted_event_content() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  purged integer;
begin
  update public.events e set
    payload = '{}'::jsonb,
    ended_at = null,
    group_id = null,
    occurred_at = e.deleted_at,
    purged_at = now()
  where e.deleted_at < now() - public.deleted_content_retention()
    and e.purged_at is null;
  get diagnostics purged = row_count;
  return purged;
end
$$;

revoke execute on function public.purge_deleted_event_content from public, anon, authenticated;

-- The tombstone wins (SDD 5.2: delete is final). push_events already ignores
-- every op on a deleted event, but the events_update policy lets a writer
-- update a row directly, so the table itself refuses:
--   * any change at all to a purged row, from anyone;
--   * a client bringing a deleted row back (deleted_at to null);
--   * a client setting or clearing purged_at: only the purge does that.
-- Sorts after events_keep_columns and before events_stamp_seq.
create function public.events_keep_tombstone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.purged_at is not null then
    raise exception 'a purged event can''t be changed' using errcode = 'check_violation';
  end if;
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null then
      raise exception 'a deleted event can''t be restored' using errcode = 'check_violation';
    end if;
    if new.purged_at is distinct from (case when tg_op = 'UPDATE' then old.purged_at end) then
      raise exception 'events.purged_at is set by the server only' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$$;

create trigger events_keep_tombstone before insert or update on public.events
  for each row execute function public.events_keep_tombstone();

-- The purge rewrites a row, and events_stamp_seq stamps server_updated_at on
-- every write, which sweep_inactive_households reads as "someone used this
-- household". A purge is not use: without this, a household whose last act
-- was a delete would live 30 days past its 24 months. A purged row counts as
-- activity at the time it was deleted instead. Otherwise unchanged from
-- 20261018093000_sweep_inactive_households.sql.
create or replace function public.sweep_inactive_households() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - public.household_inactivity_limit();
  swept integer;
begin
  with gone as (
    delete from public.households h
    where h.created_at < cutoff
      and not exists (select 1 from public.events e
                      where e.household_id = h.id
                        and case when e.purged_at is null then e.server_updated_at
                                 else e.deleted_at end >= cutoff)
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

-- Daily, off-peak UTC, clear of the other sweeps (03:17, 03:23, 03:31).
-- cron.schedule is idempotent by job name.
select cron.schedule('purge-deleted-event-content', '41 3 * * *',
  'select public.purge_deleted_event_content()');
