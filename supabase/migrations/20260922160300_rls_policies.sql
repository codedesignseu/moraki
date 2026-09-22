-- P2-02: the access rules in SDD table 4.3, and the columns a row can never
-- change. Policies apply to signed-in users (`authenticated`); `anon` gets no
-- policy on any table, so it reads and writes nothing. Cells the table marks
-- "RPC only" or "never" have no policy: RPCs (P2-05, P2-06, P4-06) run as
-- security definer and bypass RLS.

-- Helpers from SDD 4.3, plus is_owner in the same shape. Security definer so
-- a policy on memberships can read memberships without recursing into itself;
-- an empty search_path so nothing can shadow the tables they read.
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where household_id = h and user_id = auth.uid())
$$;

create function public.can_write(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where household_id = h and user_id = auth.uid()
                 and role in ('owner', 'caregiver'))
$$;

create function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where household_id = h and user_id = auth.uid()
                 and role = 'owner')
$$;

-- households: member / signed-in user / owner / RPC only
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
-- Anyone signed in may create one, as themselves. Membership, and so access,
-- comes from create_household (P2-05), which makes them the owner.
create policy households_insert on public.households for insert to authenticated
  with check (created_by = auth.uid());
create policy households_update on public.households for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- memberships: member / RPC only / owner, or self for display_name / owner, or self
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(household_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_owner(household_id) or user_id = auth.uid())
  with check (public.is_owner(household_id) or user_id = auth.uid());
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_owner(household_id) or user_id = auth.uid());

-- babies: member / writer / writer / never (soft delete)
create policy babies_select on public.babies for select to authenticated
  using (public.is_member(household_id));
create policy babies_insert on public.babies for insert to authenticated
  with check (public.can_write(household_id));
create policy babies_update on public.babies for update to authenticated
  using (public.can_write(household_id)) with check (public.can_write(household_id));

-- events: member / writer, as themselves / writer / never (soft delete)
create policy events_select on public.events for select to authenticated
  using (public.is_member(household_id));
create policy events_insert on public.events for insert to authenticated
  with check (public.can_write(household_id) and created_by = auth.uid() and updated_by = auth.uid());
create policy events_update on public.events for update to authenticated
  using (public.can_write(household_id))
  with check (public.can_write(household_id) and updated_by = auth.uid());

-- invites: owner / owner / none / owner
create policy invites_select on public.invites for select to authenticated
  using (public.is_owner(household_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.is_owner(household_id) and created_by = auth.uid());
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_owner(household_id));

-- consents and push_tokens: self for everything
create policy consents_self on public.consents for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_self on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- An event's baby must be in the event's household. Without this, a writer in
-- one household could attach an event to another household's baby.
alter table public.babies add constraint babies_id_household_key unique (id, household_id);
alter table public.events add constraint events_baby_in_household
  foreign key (baby_id, household_id) references public.babies (id, household_id);

-- Columns fixed once a row exists (P2-F2), for every role: a row can't be
-- moved to another household, baby or user, or re-authored. Policies can't
-- compare old and new values, so a trigger does. The column names are the
-- trigger arguments.
create function public.keep_columns() returns trigger
language plpgsql set search_path = '' as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
      raise exception '%.% can''t be changed', tg_table_name, col using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

-- Named to sort before events_stamp_seq, so a refused update takes no seq.
create trigger events_keep_columns before update on public.events
  for each row execute function public.keep_columns(
    'id', 'household_id', 'baby_id', 'type', 'created_by', 'client_created_at');
create trigger babies_keep_columns before update on public.babies
  for each row execute function public.keep_columns('id', 'household_id');
create trigger households_keep_columns before update on public.households
  for each row execute function public.keep_columns('id', 'created_by', 'created_at');
create trigger memberships_keep_columns before update on public.memberships
  for each row execute function public.keep_columns('household_id', 'user_id', 'joined_at');

-- "Self for display_name": a member who isn't the owner may change only their
-- own display_name. Applies to direct client updates; RPCs run as their owner.
create function public.memberships_self_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and not public.is_owner(old.household_id)
     and (new.role is distinct from old.role or new.relation is distinct from old.relation) then
    raise exception 'only the owner can change a member''s role or relation'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger memberships_self_update before update on public.memberships
  for each row execute function public.memberships_self_update();
