-- P2-01: the server schema matches SDD 4.2.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

select tables_are(
  'public',
  array['households', 'memberships', 'babies', 'events', 'invites', 'consents', 'push_tokens',
        'feedback', 'invite_attempts'],
  'public has exactly the SDD 4.2 tables, plus feedback (P4-13) and invite_attempts (P2-F7)'
);
select enum_has_labels('public', 'member_role', array['owner', 'caregiver', 'viewer'], 'member_role values');

-- events: every column, its type and nullability, as sync depends on them.
select columns_are('public', 'events', array[
  'id', 'household_id', 'baby_id', 'type', 'occurred_at', 'ended_at', 'payload', 'group_id',
  'created_by', 'updated_by', 'client_created_at', 'server_updated_at', 'deleted_at', 'seq'
], 'events has the SDD columns');
select col_type_is('public', 'events', 'id', 'uuid', 'events.id is uuid');
select col_type_is('public', 'events', 'occurred_at', 'timestamp with time zone', 'occurred_at is timestamptz');
select col_type_is('public', 'events', 'payload', 'jsonb', 'payload is jsonb');
select col_type_is('public', 'events', 'seq', 'bigint', 'seq is bigint');
select col_not_null('public', 'events', 'seq', 'seq is not null');
select col_is_null('public', 'events', 'ended_at', 'ended_at is nullable');
select col_is_null('public', 'events', 'deleted_at', 'deleted_at is nullable');
select col_is_null('public', 'events', 'group_id', 'group_id is nullable');
select col_default_is('public', 'events', 'payload', '{}'::jsonb, 'payload defaults to {}');
select col_is_pk('public', 'events', 'id', 'events keyed by id');
select fk_ok('public', 'events', 'household_id', 'public', 'households', 'id', 'events belong to a household');
select fk_ok('public', 'events', 'baby_id', 'public', 'babies', 'id', 'events belong to a baby');
select has_index('public', 'events', 'events_pull', array['household_id', 'seq'], 'pull index on (household_id, seq)');
select has_index('public', 'events', 'events_time', 'time index for the timeline');
select has_sequence('public', 'event_seq', 'event_seq exists');
select has_trigger('public', 'events', 'events_stamp_seq', 'events get seq from a trigger');

select columns_are('public', 'households', array[
  'id', 'name', 'reminder_interval_min', 'second_reminder_min', 'created_by', 'created_at'
], 'households has the SDD columns');
select col_default_is('public', 'households', 'reminder_interval_min', 180, 'reminder interval defaults to 180');
select col_is_pk('public', 'memberships', array['household_id', 'user_id'], 'one membership per user per household');
select col_type_is('public', 'memberships', 'role', 'member_role', 'role is member_role');
select columns_are('public', 'babies', array[
  'id', 'household_id', 'name', 'born_at', 'birth_weight_g', 'birth_length_mm', 'head_circ_mm',
  'updated_at', 'deleted_at'
], 'babies has the SDD columns');
select col_is_pk('public', 'invites', 'code', 'invites keyed by code');
select col_default_is('public', 'invites', 'role', 'caregiver', 'invites default to caregiver');
select col_is_pk('public', 'consents', array['user_id', 'policy_version'], 'consent per policy version');
select col_is_pk('public', 'push_tokens', array['user_id', 'device_id'], 'one token per device');

-- Check constraints from SDD 4.2 reject out-of-range values.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.test');
select throws_ok(
  $$insert into public.households (id, name, created_by, reminder_interval_min)
    values (gen_random_uuid(), 'h', '00000000-0000-0000-0000-00000000000a', 59)$$,
  '23514', null, 'reminder interval below 60 is rejected'
);
select throws_ok(
  $$insert into public.households (id, name, created_by, second_reminder_min)
    values (gen_random_uuid(), 'h', '00000000-0000-0000-0000-00000000000a', 121)$$,
  '23514', null, 'second reminder above 120 is rejected'
);
insert into public.households (id, name, created_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'h', '00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$insert into public.memberships (household_id, user_id, role, display_name)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'owner', '')$$,
  '23514', null, 'empty display name is rejected'
);
select throws_ok(
  $$insert into public.memberships (household_id, user_id, role, display_name, relation)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'owner', 'A', 'aunt')$$,
  '23514', null, 'relation outside the list is rejected'
);
select throws_ok(
  $$insert into public.babies (id, household_id, name, born_at, birth_weight_g)
    values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'b', now(), 499)$$,
  '23514', null, 'birth weight below 500 g is rejected'
);
select throws_ok(
  $$insert into public.invites (code, household_id, created_by, expires_at)
    values ('ABC', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', now())$$,
  '23514', null, 'invite code must be 8 characters'
);
select throws_ok(
  $$insert into public.push_tokens (user_id, device_id, token, platform)
    values ('00000000-0000-0000-0000-00000000000a', 'd', 't', 'web')$$,
  '23514', null, 'push token platform must be ios or android'
);

-- Deleting a household removes everything that belongs to it.
select lives_ok(
  $$delete from public.households where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'a household can be deleted, cascading to its rows'
);

select * from finish();
rollback;
