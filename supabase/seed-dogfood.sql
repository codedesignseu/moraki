-- A realistic dogfood household: 90 days of a newborn's care, logged by two
-- caregivers, ending now. For local development and demoing only.
--
-- Deliberately NOT named supabase/seed.sql: that filename is auto-loaded by
-- `supabase db reset`, which runs immediately before `supabase test db` in
-- both local development and CI (.github/workflows/ci.yml's `db` job).
-- Several existing pgTAP assertions count rows with no filter --
-- `select count(*) from public.babies` expecting exactly 1, `...memberships`
-- expecting exactly 3, and the same for events, invites and feedback. Seed
-- data auto-loaded ahead of those tests would sit there permanently within
-- that reset and throw every one of those counts off. Run this by hand
-- instead, whenever you actually want it:
--
--   npm run seed:dogfood
--
-- Safe to re-run: it deletes anything already seeded under the same
-- household id first, so running it again just refreshes the dates rather
-- than piling up a second household.
--
-- Also gives P1-11's own waiting-on-device check something real to point
-- at: pull this household down to a phone and there are comfortably over
-- 2,000 events to scroll through.

do $$
declare
  -- Named away from household_id/baby_id on purpose: those are real column
  -- names on several tables this script writes to, and an unqualified
  -- reference in a WHERE clause or VALUES list is ambiguous between "the
  -- column" and "the variable in scope" the moment the names match.
  hh_id    constant uuid := 'd09f00d0-0000-4000-8000-000000000001';
  bb_id    constant uuid := 'd09f00d0-0000-4000-8000-000000000002';
  owner_id constant uuid := 'd09f00d0-0000-4000-8000-000000000101';
  carer_id constant uuid := 'd09f00d0-0000-4000-8000-000000000102';

  days constant int := 100; -- comfortably over 2,000 events, with margin for random() dips
  born constant timestamptz := now() - (days || ' days')::interval;
  birth_weight constant int := 3250; -- grams, a realistic term birth weight

  d int;               -- day offset from birth, 0..days
  clock timestamptz;    -- the moment being generated, walks forward through the day
  author uuid;
  n int;
  side text;
  place text;
begin
  -- Idempotent: clears a previous run of this same seed before regenerating.
  -- memberships_keep_an_owner (P4-07) refuses deleting a household's last
  -- owner -- exactly right for the app, in the way of a script that means
  -- to remove the whole household anyway. Off for this cleanup only, back
  -- on straight after, so nothing outside this script's own connection
  -- ever runs with it disabled.
  alter table public.memberships disable trigger memberships_keep_an_owner;
  delete from public.events where household_id = hh_id;
  delete from public.babies where household_id = hh_id;
  delete from public.memberships where household_id = hh_id;
  delete from public.households where id = hh_id;
  delete from public.consents where user_id in (owner_id, carer_id);
  delete from auth.users where id in (owner_id, carer_id);
  alter table public.memberships enable trigger memberships_keep_an_owner;

  -- A bare (id, email) row isn't what GoTrue itself would have written for
  -- a real signup, and it shows the moment someone actually tries to sign
  -- in as a seeded caregiver: signInWithOtp's "does this email already
  -- have a confirmed account" check doesn't recognise it (no
  -- email_confirmed_at, no auth.identities row, no instance_id/aud/role)
  -- and tries to create the address again, hitting the unique constraint
  -- on auth.users.email -- a 500, and no way to sign in as either seeded
  -- caregiver at all. Fixing that turned up a second, sharper failure:
  -- GoTrue's Go driver scans confirmation_token and the other one-time-
  -- token columns as plain (non-nullable) strings, so a NULL there --
  -- this table's own default -- isn't a missing token, it's a query
  -- GoTrue can't even read the row back for ("Scan error ... converting
  -- NULL to string is unsupported"), a 500 from a completely different
  -- place than the one the identities row below fixes. Both fixes, and
  -- every column and value here, came from making one real local
  -- signInWithOtp request against a throwaway address and reading back
  -- exactly what GoTrue itself had written, not from guessing at the
  -- schema.
  insert into auth.users (
    instance_id, id, aud, role, email, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', owner_id, 'authenticated', 'authenticated',
     'dogfood-owner@example.test', born, '', '', '', '', '', '', '', '',
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('sub', owner_id::text, 'email', 'dogfood-owner@example.test', 'email_verified', true, 'phone_verified', false),
     born, born),
    ('00000000-0000-0000-0000-000000000000', carer_id, 'authenticated', 'authenticated',
     'dogfood-carer@example.test', born, '', '', '', '', '', '', '', '',
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('sub', carer_id::text, 'email', 'dogfood-carer@example.test', 'email_verified', true, 'phone_verified', false),
     born, born);

  insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values
    (owner_id, owner_id::text, 'email', jsonb_build_object('sub', owner_id::text, 'email', 'dogfood-owner@example.test', 'email_verified', true, 'phone_verified', false), born, born, born),
    (carer_id, carer_id::text, 'email', jsonb_build_object('sub', carer_id::text, 'email', 'dogfood-carer@example.test', 'email_verified', true, 'phone_verified', false), born, born, born);

  -- Health data needs consent before an event can even be written (P3-09) --
  -- true for real caregivers, so true for seeded ones.
  insert into public.consents (user_id, policy_version) values
    (owner_id, public.consent_version()),
    (carer_id, public.consent_version());

  insert into public.households (id, name, created_by, created_at) values
    (hh_id, 'The dogfood household', owner_id, born);
  insert into public.memberships (household_id, user_id, role, display_name, relation, joined_at) values
    (hh_id, owner_id, 'owner', 'Owner', 'mother', born),
    (hh_id, carer_id, 'caregiver', 'Caregiver', 'father', born);
  insert into public.babies (id, household_id, name, born_at, birth_weight_g, updated_at) values
    (bb_id, hh_id, 'Sample Baby', born, birth_weight, born);

  -- Feeds, diapers and sleep: the bulk of the volume, at newborn frequency,
  -- with enough jitter that a chart of it looks like a real baby rather than
  -- a metronome. --------------------------------------------------------------
  clock := born;
  while clock < now() loop
    d := extract(day from clock - born)::int;
    author := case when random() < 0.6 then owner_id else carer_id end;

    -- A feed roughly every 2.5-3.5 hours, bottle far more often than breast,
    -- as a household actually logging from a phone tends to.
    if random() < 0.85 then
      insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
      values (gen_random_uuid(), hh_id, bb_id, 'feed_bottle', clock, author, author, clock,
        jsonb_build_object(
          'ml', (60 + (random() * 80)::int),
          'milk', (array['formula','breast','mixed'])[1 + floor(random() * 3)]
        ));
    else
      side := (array['left','right','both'])[1 + floor(random() * 3)];
      insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
      values (gen_random_uuid(), hh_id, bb_id, 'feed_breast', clock, author, author, clock,
        jsonb_build_object('side', side, 'left_s', 300 + (random()*300)::int, 'right_s', 300 + (random()*300)::int));
    end if;

    -- A diaper most feeds, wet more than dirty, both sometimes.
    if random() < 0.8 then
      author := case when random() < 0.6 then owner_id else carer_id end;
      insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
      values (gen_random_uuid(), hh_id, bb_id, 'diaper', clock + interval '5 minutes', author, author, clock + interval '5 minutes',
        jsonb_build_object('kind', case when random() < 0.55 then 'wet' when random() < 0.85 then 'both' else 'dirty' end));
    end if;

    -- A sleep starting soon after most feeds, shorter for a younger baby.
    if random() < 0.75 then
      author := case when random() < 0.6 then owner_id else carer_id end;
      place := (array['crib','bassinet','arms','stroller'])[1 + floor(random() * 4)];
      n := greatest(20, (90 - d) * 2 + (random() * 60 - 30)::int); -- minutes; longer stretches as the baby ages
      insert into public.events (id, household_id, baby_id, type, occurred_at, ended_at, created_by, updated_by, client_created_at, payload)
      values (
        gen_random_uuid(), hh_id, bb_id, 'sleep',
        clock + interval '20 minutes',
        least(now(), clock + interval '20 minutes' + (n || ' minutes')::interval),
        author, author, clock + interval '20 minutes',
        jsonb_build_object('place', place)
      );
    end if;

    clock := clock + (150 + (random() * 60)::int || ' minutes')::interval;
  end loop;

  -- Leave the very last sleep running, as a real home screen would show
  -- mid-nap: an active caregiver's phone almost always has one going.
  update public.events set ended_at = null
  where id = (
    select id from public.events
    where household_id = hh_id and type = 'sleep'
    order by occurred_at desc limit 1
  );

  -- Weight: dense in the first two weeks, as a family actually watching the
  -- regain weighs more often then, weekly after. The insights chart
  -- specifically marks day 10 and day 14, so both are real points here, and
  -- the early dip-then-regain it is built to show actually happens rather
  -- than being sampled straight past.
  foreach d in array array[0,3,5,8,10,12,14,21,28,35,42,49,56,63,70,77,84,91,98]
  loop
    exit when d > days;
    author := case when d % 14 = 0 then owner_id else carer_id end;
    insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
    values (
      gen_random_uuid(), hh_id, bb_id, 'weight',
      born + (d || ' days')::interval + interval '9 hours',
      author, author, born + (d || ' days')::interval + interval '9 hours',
      jsonb_build_object(
        'grams',
        birth_weight
          - case when d <= 10 then round((d * 20 - d * d * 2))::int else 0 end -- dips to about day 6, regained by day 10-12
          + case when d > 10 then ((d - 10) * 20) else 0 end, -- steady gain after, ~150% of birth weight by 3 months
        'source', case when d % 14 = 0 then 'clinic' else 'home' end
      )
    );
  end loop;

  -- Pump sessions, feeding the fridge and freezer stock the home screen's
  -- stock card reads.
  clock := born;
  while clock < now() loop
    author := case when random() < 0.5 then owner_id else carer_id end;
    insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
    values (
      gen_random_uuid(), hh_id, bb_id, 'pump', clock, author, author, clock,
      jsonb_build_object(
        'ml', (80 + (random() * 100)::int),
        'dest', (array['fridge','freezer','fed'])[1 + floor(random() * 3)]
      )
    );
    clock := clock + (interval '1 day') + (random() * interval '10 hours');
  end loop;

  -- A handful of stock corrections, the ordinary kind: something thrown out,
  -- a count fixed after checking the freezer.
  for n in 1..12 loop
    author := case when random() < 0.5 then owner_id else carer_id end;
    clock := born + (random() * days || ' days')::interval;
    insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
    values (
      gen_random_uuid(), hh_id, bb_id, 'stock_adjust', clock, author, author, clock,
      jsonb_build_object(
        'loc', (array['fridge','freezer'])[1 + floor(random() * 2)],
        'delta_ml', case when random() < 0.7 then -(20 + (random()*60)::int) else (20 + (random()*60)::int) end,
        'reason', (array['discard','move','correction'])[1 + floor(random() * 3)]
      )
    );
  end loop;

  -- Health notes and temperatures, a couple of times a week -- a rash
  -- noticed, a temperature check, nothing every day.
  for n in 1..24 loop
    author := case when random() < 0.5 then owner_id else carer_id end;
    clock := born + (random() * days || ' days')::interval;
    insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
    values (
      gen_random_uuid(), hh_id, bb_id, 'health', clock, author, author, clock,
      case when random() < 0.4
        then jsonb_build_object('temp_c', round((36.5 + random() * 1.2)::numeric, 1))
        else jsonb_build_object(
          'note', (array[
            'Seemed a little fussy after the evening feed.',
            'Sneezed a lot this morning, otherwise fine.',
            'Slept well through the night for once.',
            'A small rash on the cheek, watching it.'
          ])[1 + floor(random() * 4)],
          'tags', to_jsonb(array[(array['rash','fussy','congestion','cough'])[1 + floor(random() * 4)]])
        )
      end
    );
  end loop;

  -- Medication: a short course, not a daily thing.
  for n in 1..6 loop
    author := case when random() < 0.5 then owner_id else carer_id end;
    clock := born + (20 + n * 2 || ' days')::interval;
    insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
    values (
      gen_random_uuid(), hh_id, bb_id, 'medication', clock, author, author, clock,
      jsonb_build_object('name', 'Vitamin D', 'dose', '400 IU')
    );
  end loop;

  -- Two appointments: one already had, its questions answered by the visit
  -- itself, and one coming up with questions still on the list -- exactly
  -- what the call script and the home card are for.
  insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
  values (
    gen_random_uuid(), hh_id, bb_id, 'appointment', born + interval '14 days', owner_id, owner_id, born + interval '14 days',
    jsonb_build_object('title', '2-week check-up', 'doctor', 'Dr. Papadopoulou', 'clinic', 'Community Health Clinic')
  );
  insert into public.events (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at, payload)
  values (
    gen_random_uuid(), hh_id, bb_id, 'appointment', now() + interval '5 days', owner_id, owner_id, now(),
    jsonb_build_object(
      'title', '3-month check-up', 'doctor', 'Dr. Papadopoulou', 'clinic', 'Community Health Clinic',
      'questions', to_jsonb(array['Is the weight gain on track?', 'When can we start solids?'])
    )
  );

  raise notice 'Seeded % events for household %', (select count(*) from public.events where household_id = hh_id), hh_id;
end $$;
