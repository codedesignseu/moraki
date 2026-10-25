-- P0.2/P0.3 follow-up (found in review; owner and lawyer, 2026-10-25): a
-- guardian's access rests on their health-data consent, and on nothing else.
--
-- has_access() let in any member with consent as a guardian OR with the
-- caregiver agreement. A guardian who joined by invite accepted the agreement
-- as part of joining, so after withdrawing consent (another guardian still
-- consenting, so the household not frozen) they kept reading and writing
-- through the agreement. The consent text tells them they stop seeing the
-- entries. From here:
--
-- * A member with is_guardian: access needs their health-data consent in
--   force. The caregiver agreement gives a guardian nothing.
-- * Any other member: the caregiver agreement, while the household isn't
--   frozen, as before.
--
-- my_membership_status() needs no change: a guardian without access in a
-- household that isn't frozen already reads `needs_consent`, so the app asks
-- for consent, not the agreement. Authors keep reading and soft deleting
-- their own entries (events_select, events_erase_own, events_erasure_only),
-- which ask only for membership.

-- SECURITY: who may see and send a household's baby data -----------------
create or replace function public.has_access(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = h and m.user_id = auth.uid()
      and case
        when m.is_guardian then public.has_consent()
        else public.has_caregiver_agreement(h) and not public.household_frozen(h)
      end
  )
$$;

revoke execute on function public.has_access from public, anon;
grant execute on function public.has_access to authenticated;
