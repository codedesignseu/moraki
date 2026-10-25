-- P0.4: consent evidence is append only, and written only by the RPCs.
--
-- User 1 and user 2 share household one. User 3 belongs to no household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'three@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'one', '00000000-0000-0000-0000-000000000001');
insert into public.memberships (household_id, user_id, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'One'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Two');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.history(n int) returns text[] language sql security definer as $$
  select coalesce(array_agg(purpose || ':' || action order by id), '{}')
  from public.consent_events
  where user_id = ('00000000-0000-0000-0000-00000000000' || n)::uuid
$$;

select has_table('public', 'consent_events', 'consent_events exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.consent_events'::regclass),
  'consent_events has row level security on');

set local role authenticated;

-- grant_consent and withdraw_consent append ---------------------------------
select pg_temp.login(1);
select isnt(public.grant_consent('en'), null, 'grant_consent: still returns when it was granted');
select results_eq(
  $$select purpose, version, action, text_key, locale from public.consent_events$$,
  $$values ('health_data', public.consent_version(), 'grant', 'consent', 'en')$$,
  'grant_consent: appends one event with the version, the text and the language');
select ok(public.has_consent(), 'grant_consent: the current-state row still gates writing');

select isnt(public.withdraw_consent('en'), null, 'withdraw_consent: returns when it was withdrawn');
select is(pg_temp.history(1), array['health_data:grant', 'health_data:withdraw'],
  'withdraw_consent: appends a withdrawal');
select is(public.withdraw_consent(), null, 'withdraw_consent: withdrawing twice does nothing');
select is(pg_temp.history(1), array['health_data:grant', 'health_data:withdraw'],
  'withdraw_consent: and records nothing');

select isnt(public.grant_consent(), null, 'grant_consent: an app from before P0.4 calls it with no arguments');
select is(pg_temp.history(1), array['health_data:grant', 'health_data:withdraw', 'health_data:grant'],
  're-granting keeps the earlier grant and withdrawal: the history is preserved');
select is(
  (select count(*)::int from public.consents where user_id = '00000000-0000-0000-0000-000000000001'),
  1, 'consents keeps one current-state row per version');
select throws_ok($$select public.grant_consent('fr')$$, '22023', null,
  'grant_consent: refuses a language the app has no text in');

-- Nobody writes events directly ---------------------------------------------
select throws_ok(
  $$insert into public.consent_events (user_id, purpose, version, action, text_key)
    values ('00000000-0000-0000-0000-000000000001', 'terms', '2026-10-24', 'grant', 'terms')$$,
  '42501', null, 'insert: refused even for yourself');
select throws_ok($$update public.consent_events set created_at = now() - interval '1 year'$$,
  '42501', null, 'update: refused on your own events');
select throws_ok($$delete from public.consent_events$$,
  '42501', null, 'delete: refused on your own events');
select throws_ok(
  $$select public.append_consent_event('00000000-0000-0000-0000-000000000001', 'terms',
    '2026-10-24', 'grant', 'terms')$$,
  '42501', null, 'append_consent_event: not callable by a client');

-- Other people's events -----------------------------------------------------
select pg_temp.login(2);
select is_empty($$select 1 from public.consent_events$$,
  'select: another member sees none of your events');
select throws_ok($$update public.consent_events set action = 'withdraw'$$,
  '42501', null, 'update: refused on someone else''s events');
select throws_ok($$delete from public.consent_events$$,
  '42501', null, 'delete: refused on someone else''s events');

-- record_consent -------------------------------------------------------------
select isnt(public.record_consent('terms', '2026-10-24', 'grant', null, 'el'), null,
  'record_consent: records agreeing to the Terms');
select results_eq(
  $$select purpose, version, action, text_key, locale, household_id from public.consent_events$$,
  $$values ('terms', '2026-10-24', 'grant', 'terms', 'el', null::uuid)$$,
  'record_consent: one event, the text key defaulting to the purpose');
select lives_ok(
  $$select public.record_consent('caregiver_agreement', '2026-10-24', 'grant',
    'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'record_consent: about a household the caller belongs to');
select throws_ok($$select public.record_consent('health_data', '2026-10-24', 'grant')$$,
  '22023', null, 'record_consent: health data goes through grant_consent');
select throws_ok($$select public.record_consent('guardian_declaration', '2026-10-24', 'grant')$$,
  '22023', null, 'record_consent: the guardian declaration goes through its own call');
select throws_ok($$select public.record_consent('terms', 'v1', 'grant')$$,
  '22023', null, 'record_consent: the version must be a date');
select throws_ok($$select public.record_consent('terms', '2026-10-24', 'maybe')$$,
  '22023', null, 'record_consent: the action must be grant or withdraw');

select pg_temp.login(3);
select throws_ok(
  $$select public.record_consent('caregiver_agreement', '2026-10-24', 'grant',
    'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, 'record_consent: refused about a household the caller is not in');

-- Not even the database owner rewrites one ----------------------------------
reset role;
select throws_ok($$update public.consent_events set action = 'withdraw'$$,
  '42501', null, 'update: refused by trigger even past row level security');

-- They go with the account ---------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-000000000002';
select is(pg_temp.history(2), '{}'::text[], 'deleting the account takes its events with it');

select * from finish();
rollback;
