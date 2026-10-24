-- DSAR: everything the server holds about one PERSON (Article 15 / 20).
-- Runbook: docs/compliance/data-requests.md. Legal review P0.10 / P1.3.
--
-- RUN AS SERVICE ROLE (the `postgres` role) IN THE SUPABASE SQL EDITOR.
-- NEVER COMMIT, PASTE OR ATTACH THE OUTPUT ANYWHERE BUT THE REPLY TO THE
-- VERIFIED REQUESTER. Log the run in the request register.
--
-- Read only: it changes no table. It creates one helper function in pg_temp,
-- which exists for this session only and is gone when the editor's session
-- ends.
--
-- Set ONE of the two parameters below (the other stays null), then run the
-- whole file. The result is one row, one JSON cell: copy it into an
-- encrypted file (see the runbook), never onto a personal device in clear.
--
-- What it covers: the auth account (no tokens, no password hash), memberships,
-- the households they belong to (ids and names only — the household's
-- entries are export_household.sql, and need their own authority check),
-- consent rows and the consent history where that table exists, feedback,
-- invites they created or used, and how many invite attempts are on record.
--
-- What it cannot cover: entries this person logged in a household they have
-- since left (their id stays on those rows as created_by/updated_by; find
-- them with export_household.sql on that household, and treat them as the
-- other members' record too), Supabase logs, backups, and anything on
-- phones.

create or replace function pg_temp.dsar_optional(query text, who uuid) returns jsonb
language plpgsql as $$
declare result jsonb;
begin
  execute query into result using who;
  return result;
end;
$$;

with params as (
  select
    null::uuid as user_id,        -- e.g. '6f1c1e0a-1111-4222-8333-444455556666'
    null::text as email           -- e.g. 'parent@example.com' (case-insensitive)
),
target as (
  select u.*
  from auth.users u, params p
  where (p.user_id is not null and u.id = p.user_id)
     or (p.user_id is null and p.email is not null and lower(u.email) = lower(p.email))
)
select jsonb_pretty(jsonb_build_object(
  'generatedAt', now(),
  'controller', 'C.E. CODE DESIGNS LTD (Moraki)',
  'found', (select count(*) from target),
  'account', (
    select jsonb_build_object(
      'userId', t.id,
      'email', t.email,
      'phone', t.phone,
      'createdAt', t.created_at,
      'emailConfirmedAt', t.email_confirmed_at,
      'lastSignInAt', t.last_sign_in_at,
      'updatedAt', t.updated_at,
      'providers', t.raw_app_meta_data -> 'providers',
      -- Which identity providers are linked, and when. No tokens: identity_data
      -- holds the provider's claims (for Apple, the relay address), so only
      -- the email claim is copied out.
      'identities', coalesce((
        select jsonb_agg(jsonb_build_object(
          'provider', i.provider,
          'email', i.identity_data ->> 'email',
          'createdAt', i.created_at,
          'lastSignInAt', i.last_sign_in_at
        ) order by i.created_at)
        from auth.identities i where i.user_id = t.id
      ), '[]'::jsonb)
    )
    from target t
  ),
  'memberships', coalesce((
    select jsonb_agg(to_jsonb(m) || jsonb_build_object('householdName', h.name)
                     order by m.joined_at)
    from public.memberships m
    join target t on t.id = m.user_id
    left join public.households h on h.id = m.household_id
  ), '[]'::jsonb),
  'consents', coalesce((
    select jsonb_agg(to_jsonb(c) order by c.granted_at)
    from public.consents c join target t on t.id = c.user_id
  ), '[]'::jsonb),
  -- consent_events arrives with legal review P0.4; until then this is null.
  'consentEvents', case
    when to_regclass('public.consent_events') is null then null
    else pg_temp.dsar_optional(
      'select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), ''[]''::jsonb)
         from public.consent_events e where e.user_id = $1',
      (select id from target limit 1))
  end,
  'feedback', coalesce((
    select jsonb_agg(to_jsonb(f) order by f.created_at)
    from public.feedback f join target t on t.id = f.user_id
  ), '[]'::jsonb),
  -- Invite codes are a shared secret while live: the code is left out.
  'invitesCreated', coalesce((
    select jsonb_agg(jsonb_build_object(
      'householdId', i.household_id, 'role', i.role, 'expiresAt', i.expires_at,
      'usedAt', i.used_at) order by i.expires_at)
    from public.invites i join target t on t.id = i.created_by
  ), '[]'::jsonb),
  'invitesUsed', coalesce((
    select jsonb_agg(jsonb_build_object(
      'householdId', i.household_id, 'role', i.role, 'usedAt', i.used_at) order by i.used_at)
    from public.invites i join target t on t.id = i.used_by
  ), '[]'::jsonb),
  'inviteAttempts', (
    select count(*) from public.invite_attempts a join target t on t.id = a.user_id
  ),
  'pushTokens', (
    select count(*) from public.push_tokens p join target t on t.id = p.user_id
  ),
  'entriesAuthored', coalesce((
    select jsonb_agg(jsonb_build_object('householdId', x.household_id, 'entries', x.n,
                                        'stillAMember', x.member))
    from (
      select e.household_id, count(*) as n,
             exists (select 1 from public.memberships m
                     where m.household_id = e.household_id and m.user_id = t.id) as member
      from public.events e join target t on t.id in (e.created_by, e.updated_by)
      group by e.household_id, t.id
    ) x
  ), '[]'::jsonb)
)) as dsar_export;
