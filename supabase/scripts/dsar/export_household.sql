-- DSAR: everything the server holds about one HOUSEHOLD: the household, its
-- baby, its members and every entry, deleted ones included.
-- Runbook: docs/compliance/data-requests.md. Legal review P0.10 / P1.3.
--
-- RUN AS SERVICE ROLE (the `postgres` role) IN THE SUPABASE SQL EDITOR.
-- NEVER COMMIT, PASTE OR ATTACH THE OUTPUT ANYWHERE BUT THE REPLY TO THE
-- VERIFIED REQUESTER. Log the run in the request register.
--
-- This is the CHILD's health record and the other caregivers' record too.
-- Run it only after the authority check in the runbook: the requester is a
-- member of this household, or has shown parental responsibility for the
-- child and the owner has been told (a guardian outside the household).
--
-- Read only: one SELECT, no table is changed.
--
-- Set ONE parameter: the household id, or a user id whose household(s) to
-- export (every household that user is a member of, today). The result is
-- one row, one JSON cell per household.

with params as (
  select
    null::uuid as household_id,   -- e.g. '0190a0b0-0000-7000-8000-0000000000a1'
    null::uuid as member_user_id  -- or: every household this user belongs to
),
target as (
  select h.*
  from public.households h, params p
  where (p.household_id is not null and h.id = p.household_id)
     or (p.household_id is null and p.member_user_id is not null and exists (
           select 1 from public.memberships m
           where m.household_id = h.id and m.user_id = p.member_user_id))
)
select h.id as household_id, jsonb_pretty(jsonb_build_object(
  'generatedAt', now(),
  'controller', 'C.E. CODE DESIGNS LTD (Moraki)',
  'household', to_jsonb(h),
  'babies', coalesce((
    select jsonb_agg(to_jsonb(b) order by b.born_at)
    from public.babies b where b.household_id = h.id
  ), '[]'::jsonb),
  -- Names, roles, relation and join date. Members' emails are NOT included:
  -- they are each member's own data, not the household's.
  'members', coalesce((
    select jsonb_agg(to_jsonb(m) order by m.joined_at)
    from public.memberships m where m.household_id = h.id
  ), '[]'::jsonb),
  'invites', coalesce((
    select jsonb_agg(jsonb_build_object(
      'role', i.role, 'createdBy', i.created_by, 'expiresAt', i.expires_at,
      'usedBy', i.used_by, 'usedAt', i.used_at) order by i.expires_at)
    from public.invites i where i.household_id = h.id
  ), '[]'::jsonb),
  -- Every entry, oldest first, with deleted_at set on the deleted ones.
  'events', coalesce((
    select jsonb_agg(to_jsonb(e) order by e.occurred_at, e.id)
    from public.events e where e.household_id = h.id
  ), '[]'::jsonb)
)) as dsar_household_export
from target h
order by h.created_at;
