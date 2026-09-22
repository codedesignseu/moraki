-- P2-01: the server schema from SDD 4.2. Tables, types, indexes and the
-- events sequence trigger only. Access policies are P2-02; until then RLS is
-- enabled with no policies, so no client role can read or write anything.

create table public.households (
  id uuid primary key,
  name text not null,
  reminder_interval_min int not null default 180
    check (reminder_interval_min between 60 and 480),
  second_reminder_min int check (second_reminder_min between 15 and 120),
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'caregiver', 'viewer');

create table public.memberships (
  household_id uuid references public.households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role public.member_role not null,
  display_name text not null check (length(display_name) between 1 and 40),
  relation text check (relation in ('mother', 'father', 'grandparent', 'caregiver', 'other')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.babies (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  born_at timestamptz not null,
  birth_weight_g int check (birth_weight_g between 500 and 7000),
  birth_length_mm int,
  head_circ_mm int,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One sequence for all households. Pull reads `seq > cursor` within one
-- household (SDD 5.3), so the numbers only need to rise in commit order per
-- household; gaps are fine.
create sequence public.event_seq;

create table public.events (
  id uuid primary key,                 -- client generated UUID v7
  household_id uuid not null references public.households on delete cascade,
  baby_id uuid not null references public.babies on delete cascade,
  type text not null,
  occurred_at timestamptz not null,
  ended_at timestamptz,
  payload jsonb not null default '{}',
  group_id uuid,
  created_by uuid not null references auth.users,
  updated_by uuid not null references auth.users,
  client_created_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Always set by events_stamp_seq, on insert and on every update.
  seq bigint not null
);
create index events_pull on public.events (household_id, seq);
create index events_time on public.events (baby_id, occurred_at desc) where deleted_at is null;

-- Every insert and update gets a new seq and server_updated_at (SDD 4.2), so
-- pull by cursor never misses an edit. A sequence hands out numbers when a
-- statement runs, not when it commits: two writers in one household could
-- commit 11 before 10, and a pull in between would move its cursor past 10
-- for good. The transaction lock per household makes writers in the same
-- household take their numbers one at a time, in commit order. Different
-- households never wait on each other.
create function public.events_stamp_seq() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('moraki.events:' || new.household_id::text, 0));
  new.seq := nextval('public.event_seq');
  new.server_updated_at := now();
  return new;
end;
$$;

create trigger events_stamp_seq
  before insert or update on public.events
  for each row execute function public.events_stamp_seq();

create table public.invites (
  code text primary key check (char_length(code) = 8), -- 8 chars, no ambiguous characters (P2-06)
  household_id uuid not null references public.households on delete cascade,
  role public.member_role not null default 'caregiver',
  created_by uuid not null references auth.users,
  expires_at timestamptz not null,
  used_by uuid references auth.users,
  used_at timestamptz
);

create table public.consents (
  user_id uuid references auth.users on delete cascade,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  primary key (user_id, policy_version)
);

create table public.push_tokens (
  user_id uuid references auth.users on delete cascade,
  device_id text not null,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  caregiver_alerts boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Deny by default until P2-02 adds the policies in SDD 4.3.
alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.babies enable row level security;
alter table public.events enable row level security;
alter table public.invites enable row level security;
alter table public.consents enable row level security;
alter table public.push_tokens enable row level security;
