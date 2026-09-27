-- P4-F5: two of the three sweeps docs/compliance/retention.md promises.
-- The third (inactive households, warn then delete) is not built -- it
-- would call a delete_household RPC that does not exist, since P4-06 is
-- reserved for a review window. See the migration's own header.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_function('public', 'sweep_old_feedback', 'the feedback sweep exists');
select has_function('public', 'sweep_old_invites', 'the invite sweep exists');
select ok(
  (select count(*)::int from cron.job where jobname in ('sweep-old-feedback', 'sweep-old-invites')) = 2,
  'both sweeps are actually scheduled, not just callable by hand'
);
select ok(not has_function_privilege('authenticated', 'public.sweep_old_feedback()', 'execute'),
  'nothing but the schedule may run the feedback sweep');
select ok(not has_function_privilege('authenticated', 'public.sweep_old_invites()', 'execute'),
  'nothing but the schedule may run the invite sweep');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'sweep@example.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Sweep', '00000000-0000-0000-0000-000000000001');

-- Feedback: one past its retention, one still inside it. -------------------
insert into public.feedback (id, user_id, kind, message, created_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'other', 'old', now() - interval '25 months'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'other', 'recent', now() - interval '1 month');
select public.sweep_old_feedback();
select results_eq(
  $$select message from public.feedback order by message$$,
  $$values ('recent'::text)$$,
  'only the message past 24 months is swept'
);

-- Invites: used long ago, used recently, expired long ago, expired
-- recently, still open. -----------------------------------------------------
insert into public.invites (code, household_id, created_by, expires_at, used_by, used_at) values
  ('ABCDEFGH', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   now() - interval '100 days', '00000000-0000-0000-0000-000000000001', now() - interval '95 days'),
  ('JKMNPQRS', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   now() - interval '5 days', '00000000-0000-0000-0000-000000000001', now() - interval '2 days');
insert into public.invites (code, household_id, created_by, expires_at) values
  ('TUVWXYZ2', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() - interval '95 days'),
  ('TUVWXYZ3', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('TUVWXYZ4', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() + interval '3 days');
select public.sweep_old_invites();

select is(
  (select count(*)::int from public.invites where code = 'ABCDEFGH'),
  0, 'a code used 95 days ago is swept');
select is(
  (select count(*)::int from public.invites where code = 'JKMNPQRS'),
  1, 'a code used 2 days ago is not -- accept_invite reads used_by/used_at to answer a retry the same way');
select is(
  (select count(*)::int from public.invites where code = 'TUVWXYZ2'),
  0, 'a code expired 95 days ago is swept');
select is(
  (select count(*)::int from public.invites where code = 'TUVWXYZ3'),
  1, 'a code expired yesterday is not -- P2-F8: an expired code still shows, as the answer to "why hasn''t the link worked"');
select is(
  (select count(*)::int from public.invites where code = 'TUVWXYZ4'),
  1, 'a code still open is untouched');

select * from finish();
rollback;
