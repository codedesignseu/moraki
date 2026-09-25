-- P4-13: in-app feedback, kept in this project's own database. No third party
-- sees it, which is the point of the task: telling us something went wrong
-- should not mean handing a support desk anything about a baby.
--
-- The table deliberately has no household_id and no baby_id. Feedback comes
-- from a person about the app, so nothing here can be joined to health data,
-- and the DPIA (P4-11) has one fewer path to describe. What comes with the
-- message is what helps fix a bug: which build, which platform, which
-- language. Never an event, never a name, never an address.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('problem', 'idea', 'other')),
  -- Trimmed length, so a message of spaces is not a message.
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  app_version text check (char_length(app_version) <= 40),
  platform text check (platform in ('ios', 'android', 'web')),
  locale text check (char_length(locale) <= 20),
  created_at timestamptz not null default now()
);

create index feedback_by_user on public.feedback (user_id, created_at desc);

-- SECURITY: anyone signed in may write their own feedback and read it back.
-- There is no update and no delete policy, so a message cannot be edited or
-- erased through the API once sent; deleting the account takes it with it
-- (on delete cascade), which is the path P4-06 will use.
alter table public.feedback enable row level security;

create policy feedback_insert on public.feedback for insert to authenticated
  with check (user_id = auth.uid());

create policy feedback_select on public.feedback for select to authenticated
  using (user_id = auth.uid());

/**
 * A ceiling of ten messages an hour per account. Not a defence against a
 * determined abuser — that needs something in front of PostgREST (P2-F7) —
 * but this table is the one place any signed-in phone can write rows of its
 * own choosing, and a retry loop in a future build should not be able to
 * fill it.
 */
create function public.feedback_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(*) from public.feedback
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'feedback rate limit' using errcode = '54000';
  end if;
  return new;
end
$$;

create trigger feedback_rate_limit before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
