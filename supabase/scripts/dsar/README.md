# DSAR scripts

SQL for data-subject requests that arrive **outside the app** (email to
hello@moraki.app). The procedure around them — who may run them, identity and
authority checks, the register, deadlines, reply templates — is
[`docs/compliance/data-requests.md`](../../../docs/compliance/data-requests.md).
Never run one without a register entry.

| Script                 | What it does                                                                                                                                                                    | Writes?                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `export_user.sql`      | one person: account, identities (no tokens), memberships, consents, consent history (where the table exists), feedback, invites, counts of invite attempts and authored entries | no (a session-only helper in `pg_temp`) |
| `export_household.sql` | one household: household, baby, members, invites, every entry incl. deleted ones                                                                                                | no                                      |
| `erase_user.sql`       | runs `public.delete_account` as that person, exactly as the app does                                                                                                            | **yes**, after a dry run (the default)  |

Rules:

- **Run as service role (the `postgres` role) in the Supabase SQL editor**, by
  the owner only, signed in with MFA. Not from a laptop's `psql` against
  production, not from CI, not from an agent.
- **Never commit, paste or upload the output.** It goes into an encrypted file
  for the verified requester and is deleted once sent (see the runbook).
- Parameters are edited at the top of each file in the editor. Do not save the
  edited copy back into the repository.
- `erase_user.sql` must be run with `dry_run := true` first. It raises an error
  on purpose at the end of a dry run, which rolls everything back.

Checked against a local `supabase start` database (2026-10-24): both exports
return one JSON cell; the erasure refuses a mismatched email, rolls back on a
dry run, and on a real run deletes a sole-member household, leaves a shared
one with ownership handed on, and removes the auth row with its cascade.
