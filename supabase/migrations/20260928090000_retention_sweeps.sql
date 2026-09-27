-- P4-F5: the retention policy (docs/compliance/retention.md) names three
-- sweeps. Only two are built here.
--
-- Feedback older than its stated retention, and invite codes long since
-- used or expired, are both safe to delete on a schedule: neither destroys
-- anything a household still needs, and both are already promised in the
-- policy. The third -- warning an inactive household by email, then
-- deleting it 30 days later -- is deliberately NOT built here. It would
-- call a delete_household RPC that does not exist: P4-06 (leave household,
-- delete account, delete household with cascade) is reserved for a review
-- window, because it destroys accounts and households irreversibly, and an
-- automated sweep that deletes a household is exactly the thing that
-- review exists to look at before it ships. There is also no email-sending
-- path in this project yet -- Supabase Auth sends the sign-in code, and
-- nothing else. Building either half now would be building around P4-06's
-- reserved decision rather than through it.

create extension if not exists pg_cron;

/** How long a feedback message is kept, from src/compliance/retention.md. */
create function public.feedback_retention() returns interval
language sql immutable as $$ select interval '24 months' $$;

/**
 * How long an invite row is kept after it stops being useful. Not the same
 * as invite_lifetime() (7 days, how long a code can be *redeemed*): an
 * invite is deliberately kept around well past that so two things already
 * relied on elsewhere keep working --
 *   - an expired, unused code still shows in the owner's invite list
 *     (P2-F8): "it expired" is the answer to "why hasn't the link worked",
 *     and that answer needs the row to still exist.
 *   - a retried accept_invite call on an already-used code answers with
 *     the same join rather than "no such invite" (the idempotency check in
 *     accept_invite reads used_by/used_at); a network retry days later
 *     should still see that.
 * 90 days clears both comfortably while still eventually clearing the table.
 */
create function public.invite_retention() returns interval
language sql immutable as $$ select interval '90 days' $$;

create function public.sweep_old_feedback() returns void
language sql security definer set search_path = '' as $$
  delete from public.feedback where created_at < now() - public.feedback_retention()
$$;

create function public.sweep_old_invites() returns void
language sql security definer set search_path = '' as $$
  delete from public.invites
  where (used_at is not null and used_at < now() - public.invite_retention())
     or (used_at is null and expires_at < now() - public.invite_retention())
$$;

revoke execute on function public.sweep_old_feedback from public, anon, authenticated;
revoke execute on function public.sweep_old_invites from public, anon, authenticated;

-- Once a day, off-peak UTC. cron.schedule is idempotent by job name, so
-- reapplying this migration (a `supabase db reset`) does not create a
-- second job.
select cron.schedule('sweep-old-feedback', '17 3 * * *', 'select public.sweep_old_feedback()');
select cron.schedule('sweep-old-invites', '23 3 * * *', 'select public.sweep_old_invites()');
