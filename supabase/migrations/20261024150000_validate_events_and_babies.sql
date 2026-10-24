-- P0.8: the server checks what an entry and a baby's name may hold.
--
-- Until now every check ran in the app (the Zod schemas in
-- src/domain/activities); push_events took any JSON object as a payload, of
-- any size, and babies.name had no limit. A modified client could store
-- arbitrary or oversized content in a household it can write to. These are
-- the same limits the app already enforces, so no app has ever written a row
-- that fails them.
--
-- What is checked, on every insert and update:
--   * type is one of the activity types the app registers. Tombstones too:
--     type is locked once written, so this only ever bites on insert.
--   * a live entry's payload: an object of at most 32 KiB, with the fields
--     each type needs, of the right JSON type, in the app's ranges and text
--     lengths. Lengths count characters (char_length), which is never more
--     than the app's own count (UTF-16 units), so the server is never the
--     stricter of the two. Fields this version does not name are allowed:
--     a newer app may add some (P1-F1), and its rows must still be stored.
--     Text limits allow 32 KiB rather than 8: the largest appointment the app
--     allows (title, doctor, clinic, notes and 20 questions, 4,740
--     characters) is over 8 KiB in Greek, and four times that in emoji.
--   * a deleted entry's payload is not checked: deleting must always work,
--     and a purged one is empty (20261024140000).
--   * a baby's name: 1 to 60 characters, the app's one limit
--     (src/domain/babyName.ts).
--
-- Both constraints are added NOT VALID: they hold for every new insert and
-- update from now on, and the rows already there are not re-read. To check
-- those too, once, after this is deployed:
--   alter table public.events validate constraint events_payload_valid;
--   alter table public.babies validate constraint babies_name_length;
-- (each fails, changing nothing, if any old row does not pass).
--
-- A new activity type needs a migration that adds it to event_payload_valid,
-- or the server refuses its entries: push_events answers rejected/invalid,
-- and the app moves the op to sync errors rather than retrying it.

/** The number at `key`, if any: present only when required, an integer when asked, within lo..hi. */
create function public.payload_number_ok(p jsonb, key text, lo numeric, hi numeric,
    whole boolean, required boolean) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when not (p ? key) then not required
    when jsonb_typeof(p -> key) <> 'number' then false
    else (p ->> key)::numeric between lo and hi
         and (not whole or (p ->> key)::numeric = trunc((p ->> key)::numeric))
  end
$$;

/** The string at `key`, if any: present only when required, lo..hi characters long. */
create function public.payload_text_ok(p jsonb, key text, lo int, hi int, required boolean)
returns boolean
language sql immutable set search_path = '' as $$
  select case
    when not (p ? key) then not required
    when jsonb_typeof(p -> key) <> 'string' then false
    else char_length(p ->> key) between lo and hi
  end
$$;

/** The array at `key`, if any: at most `most` strings of lo..hi characters each. */
create function public.payload_texts_ok(p jsonb, key text, most int, lo int, hi int)
returns boolean
language sql immutable set search_path = '' as $$
  select case
    when not (p ? key) then true
    when jsonb_typeof(p -> key) <> 'array' then false
    else jsonb_array_length(p -> key) <= most
         and not exists (select 1 from jsonb_array_elements(p -> key) item
                         where jsonb_typeof(item) <> 'string'
                            or char_length(item #>> '{}') not between lo and hi)
  end
$$;

/**
 * True when a live entry's payload is one the app could have written: the
 * Zod schemas in src/domain/activities, field by field. A choice field (an
 * enum in the app) is checked as a short string, not against its values, so
 * a newer app can add a value without a server change.
 */
create function public.event_payload_valid(event_type text, p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(p) = 'object'
    and octet_length(p::text) <= 32768
    and case event_type
      when 'feed_bottle' then
        public.payload_number_ok(p, 'ml', 1, 400, true, true)
        and public.payload_text_ok(p, 'milk', 1, 40, true)
        and public.payload_text_ok(p, 'from_stock', 1, 40, false)
      when 'feed_breast' then
        public.payload_text_ok(p, 'side', 1, 40, true)
        and public.payload_number_ok(p, 'left_s', 0, 9007199254740991, true, false)
        and public.payload_number_ok(p, 'right_s', 0, 9007199254740991, true, false)
      when 'diaper' then
        public.payload_text_ok(p, 'kind', 1, 40, true)
        and public.payload_text_ok(p, 'color', 1, 40, false)
        and public.payload_text_ok(p, 'note', 0, 280, false)
      when 'sleep' then
        public.payload_text_ok(p, 'place', 1, 40, false)
      when 'pump' then
        public.payload_number_ok(p, 'ml', 1, 600, true, true)
        and public.payload_text_ok(p, 'dest', 1, 40, true)
      when 'stock_adjust' then
        public.payload_text_ok(p, 'loc', 1, 40, true)
        and public.payload_number_ok(p, 'delta_ml', -9007199254740991, 9007199254740991, true, true)
        and public.payload_text_ok(p, 'reason', 1, 40, true)
      when 'health' then
        (p ? 'note' or p ? 'temp_c')
        and public.payload_text_ok(p, 'note', 1, 500, false)
        and public.payload_number_ok(p, 'temp_c', 34, 43, false, false)
        and public.payload_texts_ok(p, 'tags', 100, 1, 40)
      when 'medication' then
        public.payload_text_ok(p, 'name', 1, 60, true)
        and public.payload_text_ok(p, 'dose', 0, 30, false)
      when 'weight' then
        public.payload_number_ok(p, 'grams', 500, 15000, true, true)
        and public.payload_text_ok(p, 'source', 1, 40, true)
      when 'appointment' then
        public.payload_text_ok(p, 'title', 1, 100, true)
        and public.payload_text_ok(p, 'doctor', 0, 60, false)
        and public.payload_text_ok(p, 'clinic', 0, 80, false)
        and public.payload_text_ok(p, 'notes', 0, 500, false)
        and public.payload_texts_ok(p, 'questions', 20, 1, 200)
      else false
    end,
    false)
$$;

alter table public.events add constraint events_payload_valid check (
  type in ('feed_bottle', 'feed_breast', 'diaper', 'sleep', 'pump', 'stock_adjust', 'health',
           'medication', 'weight', 'appointment')
  and (deleted_at is not null or public.event_payload_valid(type, payload))
) not valid;

alter table public.babies add constraint babies_name_length
  check (char_length(name) between 1 and 60) not valid;
