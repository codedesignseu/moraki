-- The consent text was rewritten to say exactly what the app does (what is
-- shared before agreeing, what withdrawing does and does not undo), so the
-- version in force moves on and every caregiver is asked again.
--
-- Nothing else about consent changes: has_consent(), grant_consent() and
-- withdraw_consent() all read this function, so an agreement to an older
-- version stops counting the moment this runs, and the events policies
-- refuse writes until the caregiver agrees again. The client carries the
-- same string (src/domain/consent.ts) and treats an older one as not agreed.

create or replace function public.consent_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-18' $$;
