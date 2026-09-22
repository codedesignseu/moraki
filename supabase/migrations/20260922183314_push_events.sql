-- P2-07: push_events, the only way a phone writes to the server (SDD 5.2).
--
-- It runs as the caller (security invoker), so RLS decides every write and
-- the P2-02 triggers still refuse a change to a locked column. It has no
-- rights of its own.
--
-- One row comes back per op, in the order sent:
--   applied   the write happened
--   ignored   nothing to do: an insert that was already there, or an op for
--             an event that is already deleted (delete wins, SDD 5.2)
--   deferred  not yet: the op's not_before is in the future (P1-F13, the
--             undo window from P1-12). The client keeps it and sends it later
--   rejected  it will never work as sent: not_found, forbidden or invalid.
--             The client moves it out of the outbox (SDD 5.2 sync errors)

create type public.push_status as enum ('applied', 'ignored', 'deferred', 'rejected');

/** Epoch milliseconds (what the client stores) or an ISO string. */
create function public.push_time(value jsonb) returns timestamptz
language sql immutable set search_path = '' as $$
  select case
    when value is null or jsonb_typeof(value) = 'null' then null
    when jsonb_typeof(value) = 'number' then to_timestamp((value #>> '{}')::numeric / 1000)
    else (value #>> '{}')::timestamptz
  end
$$;

/** The keys an op of this kind may carry; anything else is a client bug. */
create function public.push_allowed_keys(op text) returns text[]
language sql immutable set search_path = '' as $$
  select case op
    when 'insert' then array['id', 'household_id', 'baby_id', 'type', 'occurred_at', 'ended_at',
                             'payload', 'group_id', 'created_by', 'updated_by', 'client_created_at']
    when 'patch' then array['id', 'updated_by', 'payload', 'unset', 'occurred_at', 'ended_at']
    when 'delete' then array['id', 'deleted_at', 'updated_by']
  end
$$;

create function public.push_events(ops jsonb)
returns table (id uuid, op text, status public.push_status, reason text)
language plpgsql security invoker set search_path = '' as $$
declare
  entry jsonb;
  body jsonb;
  kind text;
  event_id uuid;
  unknown text[];
  existing public.events%rowtype;
  me uuid := auth.uid();
  touched int;
begin
  if me is null then
    raise exception 'sign in to push events' using errcode = 'insufficient_privilege';
  end if;
  -- SDD 5.2 batches at most 100 ops per call.
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 100 then
    raise exception 'push_events takes an array of at most 100 ops' using errcode = 'invalid_parameter_value';
  end if;

  for entry in select value from jsonb_array_elements(ops) loop
    kind := entry ->> 'op';
    body := coalesce(entry -> 'body', '{}'::jsonb);
    event_id := null;
    status := 'rejected';
    reason := null;

    begin
      if kind is null or public.push_allowed_keys(kind) is null then
        reason := 'invalid';
        id := null; op := coalesce(kind, 'unknown'); return next; continue;
      end if;

      begin
        event_id := (body ->> 'id')::uuid;
      exception when others then
        event_id := null;
      end;
      id := event_id;
      op := kind;

      if event_id is null then
        status := 'rejected'; reason := 'invalid'; return next; continue;
      end if;

      -- A field this version doesn't know, or one that can never change
      -- (household_id, baby_id, type in a patch): the client is wrong, and
      -- applying part of it would be worse than refusing it.
      select array_agg(key) into unknown
      from jsonb_object_keys(body) key
      where key <> all (public.push_allowed_keys(kind));
      if unknown is not null then
        status := 'rejected'; reason := 'invalid'; return next; continue;
      end if;

      -- Held back until its time: the undo window (P1-12, P1-F13). A client
      -- bug could send it early, so the server checks too.
      if public.push_time(entry -> 'not_before') > now() then
        status := 'deferred'; reason := 'not_before'; return next; continue;
      end if;

      select * into existing from public.events e where e.id = event_id;

      if kind = 'insert' then
        if existing.id is not null then
          -- Already here, from an earlier try or another phone. Never resurrects
          -- a deleted event: the stored row is left exactly as it is.
          status := 'ignored'; reason := case when existing.deleted_at is null then 'duplicate' else 'deleted' end;
          return next; continue;
        end if;
        insert into public.events (id, household_id, baby_id, type, occurred_at, ended_at, payload,
          group_id, created_by, updated_by, client_created_at)
        values (
          event_id,
          (body ->> 'household_id')::uuid,
          (body ->> 'baby_id')::uuid,
          body ->> 'type',
          public.push_time(body -> 'occurred_at'),
          public.push_time(body -> 'ended_at'),
          coalesce(body -> 'payload', '{}'::jsonb),
          (body ->> 'group_id')::uuid,
          -- The caller is the author; RLS refuses anything else.
          coalesce((body ->> 'created_by')::uuid, me),
          me,
          public.push_time(body -> 'client_created_at'));
        status := 'applied'; return next; continue;
      end if;

      if existing.id is null then
        status := 'rejected'; reason := 'not_found'; return next; continue;
      end if;
      if existing.deleted_at is not null then
        -- Delete is final (SDD 5.2): a later patch or delete does nothing.
        status := 'ignored'; reason := 'deleted'; return next; continue;
      end if;

      if kind = 'patch' then
        update public.events e set
          -- Per field: the keys sent are merged in, the keys in `unset` are
          -- removed (P1-F13), and everything else is left alone.
          payload = (e.payload || coalesce(body -> 'payload', '{}'::jsonb))
                    - coalesce(array(select jsonb_array_elements_text(body -> 'unset')), '{}'::text[]),
          occurred_at = case when body ? 'occurred_at'
                        then public.push_time(body -> 'occurred_at') else e.occurred_at end,
          ended_at = case when body ? 'ended_at'
                     then public.push_time(body -> 'ended_at') else e.ended_at end,
          updated_by = me
        where e.id = event_id;
      else
        update public.events e
          set deleted_at = coalesce(public.push_time(body -> 'deleted_at'), now()), updated_by = me
          where e.id = event_id;
      end if;

      get diagnostics touched = row_count;
      if touched = 0 then
        -- RLS filtered the row away: a viewer, or another household's event.
        status := 'rejected'; reason := 'forbidden';
      else
        status := 'applied';
      end if;
      return next;

    exception
      when insufficient_privilege then
        status := 'rejected'; reason := 'forbidden'; return next;
      when others then
        -- A locked column, a broken payload, a missing baby: never retryable.
        status := 'rejected'; reason := 'invalid'; return next;
    end;
  end loop;
end;
$$;

revoke execute on function public.push_events from public, anon;
grant execute on function public.push_events to authenticated;
