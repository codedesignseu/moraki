-- P2-01: every event insert and update takes a new seq (SDD 4.2), in commit
-- order within a household, so pull by cursor (SDD 5.3) never misses a change.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test');
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'one', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a2', 'two', '00000000-0000-0000-0000-00000000000a');
insert into public.babies (id, household_id, name, born_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'b1', now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'b2', now());

create function pg_temp.new_event(id uuid, household uuid, baby uuid, seq bigint default null)
returns void language sql as $$
  insert into public.events (id, household_id, baby_id, type, occurred_at, created_by,
    updated_by, client_created_at, server_updated_at, seq)
  values (id, household, baby, 'diaper', now(), '00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000a', now(), '2000-01-01', seq)
$$;
create function pg_temp.seq_of(event uuid) returns bigint language sql as $$
  select seq from public.events where id = event
$$;

select pg_temp.new_event('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
select isnt(pg_temp.seq_of('00000000-0000-0000-0000-0000000000e1'), null, 'an insert gets a seq');

-- A client can't pick its own place in the pull order, or its server time.
select pg_temp.new_event('00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 1);
select cmp_ok(pg_temp.seq_of('00000000-0000-0000-0000-0000000000e2'), '>',
  pg_temp.seq_of('00000000-0000-0000-0000-0000000000e1'), 'a seq sent by the client is replaced');
select is((select server_updated_at from public.events where id = '00000000-0000-0000-0000-0000000000e2'),
  now(), 'server_updated_at sent by the client is replaced with the server time');

-- Another household's insert takes the next number from the same sequence.
select pg_temp.new_event('00000000-0000-0000-0000-0000000000e3',
  '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2');
select cmp_ok(pg_temp.seq_of('00000000-0000-0000-0000-0000000000e3'), '>',
  pg_temp.seq_of('00000000-0000-0000-0000-0000000000e2'), 'seq rises across households');

-- Any update moves the event to the end of the pull order.
create temp table before_update as
  select pg_temp.seq_of('00000000-0000-0000-0000-0000000000e1') as seq;
update public.events set payload = '{"kind":"wet"}',
  server_updated_at = '2000-01-01', seq = 1
  where id = '00000000-0000-0000-0000-0000000000e1';
select cmp_ok(pg_temp.seq_of('00000000-0000-0000-0000-0000000000e1'), '>',
  pg_temp.seq_of('00000000-0000-0000-0000-0000000000e3'), 'a patch takes a new, highest seq');
select cmp_ok(pg_temp.seq_of('00000000-0000-0000-0000-0000000000e1'), '>',
  (select seq from before_update), 'the patched event moved past its old seq');
select is((select server_updated_at from public.events where id = '00000000-0000-0000-0000-0000000000e1'),
  now(), 'a patch sets server_updated_at');

update public.events set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000e2';
select is((select max(seq) from public.events),
  pg_temp.seq_of('00000000-0000-0000-0000-0000000000e2'), 'a soft delete takes a new, highest seq');

-- Pulling household one by cursor returns its events in seq order, and only its own.
select results_eq(
  $$select id from public.events where household_id = '00000000-0000-0000-0000-0000000000a1'
    and seq > 0 order by seq$$,
  $$values ('00000000-0000-0000-0000-0000000000e1'::uuid), ('00000000-0000-0000-0000-0000000000e2'::uuid)$$,
  'pull by cursor returns the household''s events, last changed last'
);

-- The write holds its household's transaction lock until commit, so another
-- writer in the same household takes its seq only after this one is visible.
select is(
  (select count(*)::int from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()
     and granted and mode = 'ExclusiveLock'),
  2,
  'this transaction holds one lock per household it wrote to'
);

-- Client roles can use the sequence when push_events (P2-07) inserts as the caller.
select ok(has_sequence_privilege('authenticated', 'public.event_seq', 'usage'),
  'authenticated can take numbers from event_seq');
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.events'::regclass
     and tgname = 'events_stamp_seq' and tgenabled = 'O'),
  1, 'the seq trigger is enabled'
);

select * from finish();
rollback;
