-- 20261026090000: an agreement to the previous consent version keeps
-- counting for 90 days from the new version's effective date; only an
-- explicit withdrawal starts the frozen-household deletion clock.
--
-- The version in force is consent_version(); the previous one is the latest
-- row before it in consent_versions. The grace is moved by moving the
-- effective_at of the version in force: 10 days ago (inside), then 91 days
-- ago (after).
--
-- H1: 1 owner, sole guardian, agreed to the previous version only; 2 a
--     caregiver with the agreement.
-- H2: 3 owner, guardian on the version in force; 4 a guardian on the
--     previous version.
-- H3: 6 owner, sole guardian on the version in force, who withdraws.
-- H4: 7 owner, sole guardian on the previous version, who withdraws in the grace.
-- 5 agreed to the version two before, which never counts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

create function pg_temp.id(prefix text, n int) returns uuid language sql as $$
  select (prefix || '-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', pg_temp.id('00000000', n), 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.previous() returns text language sql as $$
  select max(version) from public.consent_versions where version < public.consent_version()
$$;
create function pg_temp.grace_began(ago interval) returns void language sql as $$
  update public.consent_versions set effective_at = now() - ago where version = public.consent_version()
$$;
-- An agreement to `version`, as grant_consent would have recorded it then.
create function pg_temp.agreed(n int, version text) returns void language sql as $$
  insert into public.consents (user_id, policy_version, granted_at)
    values (pg_temp.id('00000000', n), version, now() - interval '30 days');
  insert into public.consent_events (user_id, purpose, version, action, text_key, created_at)
    values (pg_temp.id('00000000', n), 'health_data', version, 'grant', 'consent', now() - interval '30 days');
$$;
-- my_membership_status reads only auth.uid(), so it is asked as `n` directly.
create function pg_temp.status(n int, h int) returns text language sql as $$
  select pg_temp.login(n);
  select access from public.my_membership_status(pg_temp.id('aaaaaaaa', h));
$$;
create function pg_temp.since(h int) returns timestamptz language sql as $$
  select frozen_since from public.households where id = pg_temp.id('aaaaaaaa', h)
$$;

insert into auth.users (id, email)
  select pg_temp.id('00000000', n), 'u' || n || '@example.test' from generate_series(1, 7) n;
insert into public.households (id, name, created_by)
  select pg_temp.id('aaaaaaaa', h), 'H' || h, pg_temp.id('00000000', o)
  from (values (1, 1), (2, 3), (3, 6), (4, 7)) x(h, o);
insert into public.memberships (household_id, user_id, role, display_name, is_guardian) values
  (pg_temp.id('aaaaaaaa', 1), pg_temp.id('00000000', 1), 'owner', 'One', true),
  (pg_temp.id('aaaaaaaa', 1), pg_temp.id('00000000', 2), 'caregiver', 'Two', false),
  (pg_temp.id('aaaaaaaa', 2), pg_temp.id('00000000', 3), 'owner', 'Three', true),
  (pg_temp.id('aaaaaaaa', 2), pg_temp.id('00000000', 4), 'caregiver', 'Four', true),
  (pg_temp.id('aaaaaaaa', 3), pg_temp.id('00000000', 6), 'owner', 'Six', true),
  (pg_temp.id('aaaaaaaa', 4), pg_temp.id('00000000', 7), 'owner', 'Seven', true);
insert into public.consent_events (user_id, purpose, version, action, text_key, household_id)
  values (pg_temp.id('00000000', 2), 'caregiver_agreement', public.caregiver_agreement_version(),
          'grant', 'test', pg_temp.id('aaaaaaaa', 1));
select pg_temp.agreed(1, pg_temp.previous());
select pg_temp.agreed(3, public.consent_version());
select pg_temp.agreed(4, pg_temp.previous());
select pg_temp.agreed(5, (select max(version) from public.consent_versions where version < pg_temp.previous()));
select pg_temp.agreed(6, public.consent_version());
select pg_temp.agreed(7, pg_temp.previous());

-- The table -------------------------------------------------------------------------
select ok(exists (select 1 from public.consent_versions where version = public.consent_version()),
  'the version in force has an effective date');
select is(public.consent_grace(), interval '90 days', 'the grace is 90 days');
set local role authenticated;
select pg_temp.login(1);
select throws_ok($$insert into public.consent_versions values ('2099-01-01', now())$$,
  '42501', null, 'a client can''t publish a version');
select throws_ok($$update public.consent_versions set effective_at = now() - interval '1 year'$$,
  '42501', null, 'nor move one');
select ok((select count(*) from public.consent_versions) > 0, 'but can read them');
reset role;

-- As published: 2026-10-26 in force from the migration, so an agreement to
-- 2026-10-25 counts today.
select is(pg_temp.previous(), '2026-10-25', 'the version before the one in force is 2026-10-25');
set local role authenticated;
select pg_temp.login(1);
select ok(public.has_consent() and public.has_access(pg_temp.id('aaaaaaaa', 1)),
  'a guardian on 2026-10-25 keeps access as the new text comes in');
reset role;

-- Inside the grace --------------------------------------------------------------------
select pg_temp.grace_began(interval '10 days');

set local role authenticated;
select pg_temp.login(1);
select ok(public.has_consent(), 'in the grace: the previous version counts');
select ok(public.has_access(pg_temp.id('aaaaaaaa', 1)), 'so the guardian keeps access');
select pg_temp.login(5);
select ok(not public.has_consent(), 'the version before that never does');
reset role;
select is(pg_temp.status(1, 1), 'granted', 'the guardian reads granted');
select is(pg_temp.status(2, 1), 'granted', 'and so does their caregiver: the household is open');
select is(pg_temp.status(4, 2), 'granted', 'a second guardian on the previous version too');
select ok(not public.household_frozen(pg_temp.id('aaaaaaaa', 1)), 'H1 is not frozen');

-- Withdrawing in the grace: the agreement in grace is withdrawn and recorded.
set local role authenticated;
select pg_temp.login(7);
select isnt(public.withdraw_consent('en'), null, 'a guardian in the grace can withdraw');
select ok(not public.has_consent(), 'and has no consent after');
reset role;
select is((select version from public.consent_events
           where user_id = pg_temp.id('00000000', 7) and action = 'withdraw'),
  pg_temp.previous(), 'the withdrawal is recorded against the version it withdraws');
select ok(public.household_withdrawn(pg_temp.id('aaaaaaaa', 4)), 'H4 is frozen by a withdrawal');
select is(public.warn_frozen_households(), 0, 'the daily job warns nobody yet');
select is(pg_temp.since(4), now(), 'H4''s clock starts: an explicit withdrawal');
select is(pg_temp.since(1), null, 'H1, in the grace, has none');

-- After the grace ----------------------------------------------------------------------
select pg_temp.grace_began(interval '91 days');

set local role authenticated;
select pg_temp.login(1);
select ok(not public.has_consent(), 'after the grace: the previous version no longer counts');
select ok(not public.has_access(pg_temp.id('aaaaaaaa', 1)), 'the guardian''s sharing pauses');
reset role;
select is(pg_temp.status(4, 2), 'needs_consent', 'a second guardian on the old text is asked for consent');
select is(pg_temp.status(3, 2), 'granted', 'while the one on the new text carries on');
select is(pg_temp.status(1, 1), 'frozen', 'H1, with no guardian on the new text, is paused');
select ok(not public.household_withdrawn(pg_temp.id('aaaaaaaa', 1)), 'but not by a withdrawal');

-- A lapse never starts the clock, and a clock from before this change goes.
update public.households
  set frozen_since = now() - interval '121 days', frozen_warned_at = now() - interval '31 days'
  where id = pg_temp.id('aaaaaaaa', 1);
insert into public.inactivity_warning_emails
    (household_id, user_id, kind, warned_at, claimed_at, sent_at, delete_on)
  values (pg_temp.id('aaaaaaaa', 1), pg_temp.id('00000000', 1), 'frozen', now() - interval '31 days',
          now() - interval '31 days', now() - interval '31 days', (now() at time zone 'UTC')::date);
select is(public.sweep_frozen_households(), 0, 'a household frozen by a lapse is never deleted');
select is(public.warn_frozen_households(), 0, 'nor warned');
select is(pg_temp.since(1), null, 'and its clock is cleared');
select is((select count(*)::int from public.inactivity_warning_emails
           where household_id = pg_temp.id('aaaaaaaa', 1)), 0, 'with its queued email');

-- The last guardian withdrawing still starts it.
set local role authenticated;
select pg_temp.login(6);
select isnt(public.withdraw_consent(), null, 'H3''s only guardian withdraws');
reset role;
select is(public.warn_frozen_households(), 0, 'the daily job runs');
select is(pg_temp.since(3), now(), 'H3''s clock starts');

-- Agreeing again clears it, and opens a lapsed household again.
set local role authenticated;
select pg_temp.login(6);
select isnt(public.grant_consent(), null, 'H3''s guardian agrees again');
select pg_temp.login(1);
select isnt(public.grant_consent(), null, 'H1''s guardian agrees to the new text');
reset role;
select is(pg_temp.since(3), null, 'H3''s clock is cleared');
select is(pg_temp.status(2, 1), 'granted', 'H1 is open again for its caregiver');

select * from finish();
rollback;
