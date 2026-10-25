-- DSAR: ERASE ONE PERSON'S ACCOUNT (Article 17), for a request received
-- outside the app. Runbook: docs/compliance/data-requests.md. Legal review
-- P0.10 / P1.3.
--
-- ############################################################################
-- #  THIS DELETES DATA AND CANNOT BE UNDONE.                                 #
-- #                                                                          #
-- #  Before running:                                                         #
-- #   1. The request is in the register, identity VERIFIED per the runbook.  #
-- #   2. export_user.sql was run and the result kept until the reply is sent #
-- #      (the person may want a copy; offer it).                             #
-- #   3. Households: the person is told what happens to each (below).        #
-- #   4. Run first with dry_run := true (the default). Read the notices.     #
-- #   5. Only then set dry_run := false and run again.                       #
-- #                                                                          #
-- #  RUN AS SERVICE ROLE (the `postgres` role) IN THE SUPABASE SQL EDITOR.   #
-- #  Never commit or share the output.                                       #
-- ############################################################################
--
-- What it does: exactly what Settings → Leave or delete → Delete account does,
-- by calling the same SECURITY DEFINER function, public.delete_account, as
-- that user. The person is impersonated for this one transaction only
-- (request.jwt.claims, local to the transaction), so auth.uid() inside the
-- function names them. Nothing is re-implemented here, so this can't drift
-- from the in-app path or its pgTAP tests (13_erasure.test.sql).
--
-- So, as in the app:
--  * a household where they are the ONLY member is deleted with its baby and
--    every entry;
--  * a household OTHERS share stays: the person leaves it, their name goes,
--    their entries stay as the other members' record (author id kept, mapped
--    to no one). If they were its only owner, ownership passes to `successor`
--    when given (must be a member of that household), else to the
--    longest-standing caregiver, else viewer;
--  * auth.users goes, and with it identities, sessions, memberships,
--    consents (and consent history), feedback, push tokens, invite attempts.
--
-- What it does NOT do:
--  * revoke Sign in with Apple or Google access: that needs the person's
--    device. Tell them to remove Moraki under Apple ID → Sign in with Apple,
--    or Google Account → Third-party connections;
--  * clear any phone: copies on their own or other members' phones stay;
--  * reach backups: they age out within 7 days (Supabase Pro). The account
--    and any household deleted are written to public.erasure_log (reason
--    admin_request), which data-requests.md section 7 replays after a restore;
--  * erase their entries in a shared household. That is the other members'
--    record too: a separate decision, logged in the register (see runbook).

do $$
declare
  -- ===== PARAMETERS ========================================================
  target uuid := null;          -- the user id, from export_user.sql
  confirm_email text := null;   -- must equal that account's email, typed again
  successor uuid := null;       -- optional: new owner of a shared household
  dry_run boolean := true;      -- true: do it all, report, then roll back
  -- =========================================================================
  who record;
  h record;
begin
  if target is null or confirm_email is null then
    raise exception 'set target and confirm_email first';
  end if;

  select id, email into who from auth.users where id = target;
  if not found then
    raise exception 'no account with id %', target;
  end if;
  if lower(coalesce(who.email, '')) <> lower(confirm_email) then
    raise exception 'confirm_email does not match the account''s email: nothing done';
  end if;

  for h in
    select m.household_id, m.role,
           (select count(*) from public.memberships o
             where o.household_id = m.household_id and o.user_id <> target) as others
    from public.memberships m where m.user_id = target
  loop
    if h.others = 0 then
      raise notice 'household %: only member, DELETED with its baby and entries', h.household_id;
    else
      raise notice 'household %: % other member(s), person LEAVES (was %); entries stay',
        h.household_id, h.others, h.role;
    end if;
  end loop;

  -- The erasure log (public.erasure_log) records this as a request to us,
  -- not as the person's own deletion in the app.
  perform set_config('moraki.erasure_reason', 'admin_request', true);

  -- Act as the person for this transaction only, as the app's call would.
  perform set_config('request.jwt.claims',
    json_build_object('sub', target, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', target::text, true);

  perform public.delete_account(successor);

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  if exists (select 1 from auth.users where id = target) then
    raise exception 'account still present after delete_account: rolled back';
  end if;

  if dry_run then
    raise exception 'DRY RUN OK for %: everything above would happen. Rolled back; set dry_run := false to erase.', target;
  end if;

  raise notice 'ERASED account %. Record the date and the notices above in the register.', target;
end;
$$;
