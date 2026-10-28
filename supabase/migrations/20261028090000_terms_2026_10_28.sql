-- The Terms of Use and Privacy Policy published on moraki.app on 28 October
-- 2026 (the lawyer's final texts). The app carries the same date
-- (TERMS_VERSION), and asks each signed-in account to agree once more.
-- Creating a household or accepting an invite needs agreement to this
-- version; an older agreement stays on record but no longer counts.

create or replace function public.terms_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-28' $$;
