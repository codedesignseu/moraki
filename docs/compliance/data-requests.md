# Data-request procedure

**Written:** 2026-10-24. **Legal review items:** P0.10 (verified workflow for
requests outside the app, fuller export), P1.3 (back-office procedure, access
control, audit trail, guardian requests). **Developer assessment:** Q38, Q78,
Q110–113, Q122–128, gap M11.

**Status: draft for the lawyer.** The owner decided on a procedure and SQL
scripts, not an admin app (2026-10-24). Supabase runs on the **Pro** plan from
launch: daily backups, kept 7 days, no point-in-time recovery.

Controller: **C.E. CODE DESIGNS LTD** (Moraki). Contact: **hello@moraki.app**.

---

## 1. Where requests come from

| Channel                                    | What it covers                                                                                                                                                              | Logged in the register?                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| In the app, self-service                   | Settings → Data export (copy), editing any entry or the baby's details (correction), Settings → Leave or delete (erasure), Settings → Privacy → Review consent (withdrawal) | No: the person acts on their own data, authenticated by their session |
| Email to **hello@moraki.app**              | Anything: access, correction, erasure, restriction, objection, portability, a request about a child from a guardian outside the household, a complaint                      | **Yes, every one**                                                    |
| In-app feedback (Settings → Send feedback) | Not a rights channel. If a message asks for a right, treat it as an email request: log it and reply to the account's email                                                  | Yes, once recognised                                                  |
| Post to the registered office              | As email. Reply by email once identity is verified                                                                                                                          | Yes                                                                   |

A request needs no particular wording. "Delete my stuff" is an erasure request.

## 2. The register

One row per request, kept by the owner in a private spreadsheet in the
company's own storage (not in this repository, not in the app's database). It
is the audit trail for everything done by hand. Keep it for 3 years after the
request closes, then delete the row.

| Field                | Content                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `DSR-YYYY-NNN`                                                                                                                               |
| `received`           | date received (the clock starts here)                                                                                                        |
| `requester`          | name and address it came from. No health details, even if the email contains them                                                            |
| `type`               | access, rectification, erasure, restriction, objection, portability, guardian dispute, other                                                 |
| `subject`            | whose data: the requester's account, a household, a child (household id, never the baby's details)                                           |
| `identity_check`     | how identity was verified (section 3), and when                                                                                              |
| `authority_check`    | for a child's data: member, declared guardian, or outside guardian with evidence (section 4). "n/a" for the requester's own account          |
| `actions`            | each script run with date and the result count (not the output), each email sent, each decision and who made it                              |
| `deadline`           | `received` + 1 month. If extended: the new date (+ up to 2 months), the reason, and the date the requester was told (within the first month) |
| `closed`             | date of the final reply                                                                                                                      |
| `erasures_to_replay` | for erasures: the user id, so a restored backup can be cleaned again (section 7)                                                             |

**Deadline:** one month from receipt (Article 12(3)). Extendable by two more
months for complex or numerous requests, telling the requester why within the
first month. Ask for everything verification needs in the first reply, so it
does not eat into the month.

## 3. Verifying identity

The aim is to be sure the requester is the account holder, without asking for
more data than the account already has. Never ask for ID documents for an
account request: the account holds only an email address.

1. **Email accounts, and Apple or Google accounts that share their real
   address.** Look the address up with `export_user.sql` (`email` parameter).
   - Request came **from that address**: reply to it asking the person to
     confirm the request ("Reply YES to confirm"). Their reply from the same
     address is the verification. Note "confirmed from account email" in the
     register.
   - Request came **from another address**: do not act on it. Reply that we
     will write to the address on the account, and send the confirmation
     there. If they no longer control it, they can sign in to the app with it
     and use the in-app paths.
2. **Sign in with Apple, Hide My Email.** The account's email is a relay
   address (`…@privaterelay.appleid.com`) that forwards to the person's real
   inbox. What the person can see:
   - **In the app** (if still installed): Settings → Account shows the relay
     address as the account email. The app shows no user id or other code.
   - **On their iPhone:** Settings → [their name] → Sign in with Apple →
     Moraki shows the relay address.

   Procedure: ask them for the relay address. Look it up. Send a confirmation
   **to the relay address**, containing a random 6-character code; Apple
   forwards it to their real inbox. They reply with the code (from any
   address). Code matches: verified. The "date you signed up" is **not** an
   identity check and is no longer used.

   **Prerequisite (owner):** Apple only forwards mail to relay addresses from
   sender domains registered in the Apple Developer account (Certificates,
   Identifiers & Profiles → Services → Sign in with Apple for Email
   Communication), with SPF/DKIM passing. Register `moraki.app` (and the
   sending address, hello@moraki.app) before launch, and send one test.

3. **The JSON export** from the app now carries the account's user id (section
   8). A requester may quote it, but it is not proof on its own: anyone the
   file was shared with has it. Use it to find the account, then verify as
   above.
4. **Cannot verify** (no reply, wrong code, address not on any account):
   reply once explaining what is needed, log it, close after one month
   without action.

_Future item (not built):_ a short "account reference" in Settings →
Account, and a "Request a copy by email" button that sends a signed request
from the app, would make step 2 unnecessary.

## 4. Authority over a child's data

The child cannot act; their data is reached through a parent or guardian. The
company does not decide custody or parental responsibility, ever.

- **A member of the household** asks about the household (copy of the
  baby's entries, correction): the membership is the authority, as it is in the
  app. Prefer pointing them to the in-app paths. Where the household's
  guardian declaration exists (legal review P0.1), check `is_guardian` on their
  membership in `export_household.sql` and note it.
- **Erasure of a whole household** by email: only the household **owner**,
  verified as in section 3, and only after confirming they understand it
  deletes the record for every member. Other members are not erased, but lose
  access; tell the requester to warn them.
- **A second guardian outside the household** (not a member, or removed):
  1. Acknowledge within a week. Say what we can and cannot do (we hold what
     the household's members record; we do not decide parental
     responsibility).
  2. Ask for evidence of parental responsibility (e.g. birth certificate
     naming them, or a court order), and for the account email of the
     household owner if they know it. Do not confirm or deny that a household
     exists until evidence arrives.
  3. With evidence: log it, then **notify the household owner** by email that
     a guardian has asked about the household's data, without passing on the
     requester's contact details unless they agreed.
  4. **Access request:** with evidence, provide the child's data
     (`export_household.sql`, the baby and entries; strip other members'
     names and ids unless the lawyer advises otherwise).
  5. **Objection, erasure or restriction:** do not delete. Restrict instead
     (no data is changed, the request is logged), and **hand to the lawyer**,
     who decides with both guardians' positions on record. A court order
     binding the company is followed as written.
  6. Record every step in the register as type `guardian dispute`.

  Each such request is assessed on its own facts. Weigh the rights of the
  other people in the household (the other guardian, caregivers whose names
  and entries are in the record) and any competing claims of parental
  responsibility. Where the facts or the authority are disputed, the case
  goes to the lawyer **before** anything is disclosed or erased.

## 5. Running the scripts

Scripts: [`supabase/scripts/dsar/`](../../supabase/scripts/dsar/README.md).

- **Who:** the owner only. No contractor, no agent, no CI.
- **Where:** the Supabase dashboard SQL editor of the production project,
  signed in with **MFA** enabled on the Supabase account. Not a local `psql`
  with the database password.
- **How:** paste the script, set the parameter at the top, run. Do not save
  the parameterised copy, in Supabase's saved snippets or in git.
- **Output:** copy the JSON into a file inside an **encrypted** container
  (e.g. a password-protected 7-Zip AES-256 archive, password sent by a
  different channel), or send it in the body of the reply to the verified
  address. Never to a personal device in clear, never into chat tools or
  issue trackers.
- **After sending:** delete the working file and the archive, empty the trash.
  Note "working files deleted" in the register.
- **Erasure:** `erase_user.sql` with `dry_run := true` first; read the notices
  (which households are deleted, which are left); then run with
  `dry_run := false`. It calls the same `delete_account` the app calls, so it
  does exactly what the in-app deletion does and nothing else.
  Either way the person's consent records (`consent_events`) stay for 3 years
  after the deletion, without email or sign-in details, then a daily job erases
  them (`docs/compliance/retention.md`). Don't delete them by hand: they are the
  evidence of what was agreed (Art. 7(1), Art. 17(3)(e)).

### What each request type means here

| Type                    | Action                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access (Art. 15)        | `export_user.sql`. If they are a member of a household, `export_household.sql` for it too. Add the standard information (purposes, recipients, retention) by linking the privacy policy                                                                                                                                                                       |
| Portability (Art. 20)   | The same JSON. Point to the in-app export, which also gives the CSV                                                                                                                                                                                                                                                                                           |
| Rectification (Art. 16) | Entries and baby details: in the app. Display name or email: the owner changes it in the SQL editor / Auth dashboard, logs the old and new value's field name (not the values)                                                                                                                                                                                |
| Erasure (Art. 17)       | `erase_user.sql`. Their entries in a **shared** household stay as the other members' record (as in the app); erasing those too is a separate decision for the lawyer, logged. Consent records stay 3 years, pseudonymous (see above)                                                                                                                          |
| Restriction (Art. 18)   | In the app: a caregiver withdrawing the agreement leaves the household. A guardian withdrawing health-data consent stops their own processing, and the last guardian with consent withdrawing freezes the household (`retention.md`, rights table). Anything wider: log it, mark the account in the register, and hand to the lawyer before changing any data |
| Objection (Art. 21)     | There is no profiling or marketing. Reply explaining that, and offer withdrawal or erasure                                                                                                                                                                                                                                                                    |
| Guardian dispute        | Section 4                                                                                                                                                                                                                                                                                                                                                     |

### Shared households and personal erasure

Deleting an account never deletes other members' data. A household with only
that person in it goes; a household others share stays, with ownership handed
on. Their entries keep an author id that now names no one. Say this in the
reply. Deleting a shared household needs its owner, and is a separate request.

## 6. What is not covered by the scripts

- **Phones.** Copies on the person's own or other members' phones stay. Tell
  them to use "Sign out and clear this phone" or uninstall.
- **Identity providers.** Apple or Google access can only be revoked from the
  person's own phone, during in-app deletion. Apple needs a fresh
  authorization code, which the app gets by asking the person to confirm with
  Apple (`appleConfirm.ts`, then the `apple-revoke` Edge Function, on iOS).
  Google's revocation runs in the app through the Google sign-in SDK on the
  phone where Google sign-in was used (`googleRevoke.ts`). `erase_user.sql`
  can do neither. So after an email erasure the reply tells the person to
  remove Moraki themselves:
  - **Apple:** on the iPhone, Settings → [their name] → Sign-In & Security →
    Sign in with Apple → Moraki → Stop using Apple ID.
  - **Google:** myaccount.google.com → Security → third-party connections
    (your connections to third-party apps and services) → Moraki → delete the
    connection.
- **Logs:** Supabase API/auth logs, Sentry (30 days), the mailbox. They age
  out on their own retention (see `retention.md`). The request email thread
  itself: keep it with the register entry, delete with it.

## 7. Backups

- Supabase Pro keeps **daily backups for 7 days**. Data deleted today leaves
  the last backup at most 7 days later. Backups are whole-database snapshots;
  one person cannot be removed from one. Say so in erasure replies.
- If a backup is ever **restored**, every erasure since that backup's date
  must be **re-applied** before the app is reopened, using the erasure
  journal emails and the erasure log (below). Erasures done on an email request are in the log too (reason
  `admin_request`); the register's `erasures_to_replay` ids are the check
  that none is missed. Log the replay in the register.
- Owner check (after upgrading): Database → Backups shows daily backups and
  their dates. Record the confirmation date here: _not yet confirmed_.

### The erasure log, and re-applying erasures after a restore

Every deleted account, household and entry is written to `public.erasure_log`
(`supabase/migrations/20261025200000_erasure_log.sql`, entries since
`20261026100000_erasure_journal.sql`), whatever deleted it: the app (delete
an entry, delete household, delete account), the inactivity and
frozen-household sweeps, `erase_user.sql`, or the dashboard. Triggers on
`public.events`, `public.households` and `auth.users` write it, so no path can
skip it.

- **What a row holds:** `kind` (`account`, `household` or `entry`),
  `subject_id` (the uuid), `erased_at`, `reason` (`user_request`,
  `household_deleted_by_owner`, `inactivity`, `frozen`, `admin_request`) and
  `logged_at`. No content, no name, no email. For an entry, `erased_at` is
  its `deleted_at` (the phone's time, which can be days old if the phone was
  offline) and `logged_at` is when the deletion reached the server; for an
  account or a household they are the same. An entry that goes with its
  household is not logged on its own: the household row covers it.
- **Who can read it:** the service role only (SQL Editor, signed in with MFA).
  No policy, no grant: not readable through the app or the API.
- **How long:** 35 days after `logged_at` (`erasure_log_retention()`), longer
  than the 7-day backups with a margin, then the daily job
  `purge-erasure-log` (03:53 UTC) deletes the row.

Other evidence the database keeps: a deleted account's `consent_events` rows
(3 years, with `account_deleted_at`), a `caregiver_agreement` withdrawal when
someone leaves a household, and a deleted entry's tombstone in `events`.

### The erasure journal (email, outside the database)

The log is part of the database, so a restore rolls it back too. Since
2026-10-26 (owner decision, answering the lawyer) a copy leaves the database
every night: at **04:05 UTC** the job `send-erasure-journal` has the Edge
Function of the same name email each whole UTC day not yet sent to the
owner's mailbox (the secret `ERASURE_JOURNAL_TO`, e.g. `hello@moraki.app`),
from `hello@moraki.app`, through Brevo:

- subject `Moraki erasure journal YYYY-MM-DD`, the day (UTC) the rows were
  logged; the body gives counts only;
- attached `moraki-erasure-journal-YYYY-MM-DD.csv`, columns
  `kind,subject_id,erased_at_utc,reason`, nothing else;
- a day with nothing logged sends no email. A day Brevo refuses is retried
  the next night, and no later day is sent before it, so the emails always
  cover every day up to the last one sent.

**Keep the journal emails for at least 35 days** (longer if the lawyer
advises), in a folder of their own, and delete them after. They hold uuids
only, but they are the only record that survives a restore. Don't forward
them. Setup: `docs/10-release-runbook.md`, "Erasure journal email".

### After any restore

Re-apply every erasure made since the backup **before the app is reopened**.

1. **Before restoring**, if production still answers, save the log from it
   too (it holds today's rows, which no journal email has carried yet), in
   the SQL Editor:

   ```sql
   select kind, subject_id, erased_at, reason, logged_at
   from public.erasure_log order by logged_at;
   ```

   Save the result into an encrypted file as in section 5 (ids only, no
   content).

2. Restore. Note the time the backup was taken.
3. Collect the erasures to re-apply: every row of every **journal email dated
   on or after the day of the backup** (that day included: the email covers
   the whole day, and re-applying an erasure already in the backup does
   nothing), plus, from the file of step 1, every row with `logged_at` after
   the backup. The register's `erasures_to_replay` ids are the check that no
   erasure on request is missed.
4. Re-apply them in this order, in the SQL Editor (signed in with MFA):
   - **entry** (`kind = entry`), first, so nothing is left of it whatever
     happens to its household:

     ```sql
     update public.events
     set deleted_at = '<erased_at_utc>'
     where id = '<subject_id>' and deleted_at is null;
     select public.purge_deleted_event_content();
     ```

     The update makes it a tombstone again, with a new `seq`, so every phone
     pulls it and drops its copy. The purge empties it at once if it was
     deleted more than 30 days ago; otherwise the nightly purge does, 30 days
     after `erased_at`, as it would have. No row: it is already gone (its
     household too, most likely); skip it.

   - **household**, then accounts (so `erase_user.sql` doesn't hand a
     deleted household over):

     ```sql
     delete from public.households where id = '<subject_id>';
     ```

     (what `delete_household` does; that function only runs for a signed-in
     owner). Nothing to do if the row is already gone.

   - **account**: `erase_user.sql` for `<subject_id>`. A missing account is
     already gone; skip it.

   Each re-applied erasure is logged again (an entry as `user_request`,
   the others as `admin_request`) and so goes out in the next journal. Note
   the replay in the register.

5. Delete the saved file of step 1, and note it.

Limits: rows logged on the day of the restore, after the last journal email,
are only in production's own log. If production can't be read before the
restore (the reason for restoring may be that it is broken), they are lost:
fall back to the register for erasures on request, and tell the people who
deleted in the app that day, if they can be identified. Check after any
missed night (Edge Functions → send-erasure-journal → Logs) that the journal
caught up.

## 8. The in-app export (P0.10)

Settings → Data export → Export my data. The JSON now also carries, when
signed in, an `account` section: user id, email, sign-in methods, and the
consent records and feedback the server holds for that person, read at the
moment of export. Offline, those records are marked `unavailable` and the rest
still exports. The CSV is unchanged: entries only. Signed out, there is no
account section. For anything not in it (invites, invite attempts, entries in
a household the person has left), the email route above applies.

## 9. Reply templates

Keep them short. Never quote health details back. Sign as Moraki, C.E. CODE
DESIGNS LTD.

**Acknowledge (EN).**

> Thanks — we've received your request (ref DSR-…). To make sure it's you, please reply YES from the email address on your Moraki account [or: reply with the code we've sent to your Apple relay address]. We'll answer within one month.

**Acknowledge (EL).**

> Ευχαριστούμε — λάβαμε το αίτημά σου (αρ. DSR-…). Για να βεβαιωθούμε ότι είσαι εσύ, απάντησε ΝΑΙ από το email του λογαριασμού σου στο Moraki [ή: απάντησε με τον κωδικό που στείλαμε στη διεύθυνση Apple]. Θα απαντήσουμε μέσα σε έναν μήνα.

**Copy sent (EN).**

> Here is a copy of the data we hold about your account (ref DSR-…). It's in an encrypted file; the password follows separately. What we use it for and how long we keep it is in our privacy policy: https://moraki.app/privacy/

**Copy sent (EL).**

> Σου στέλνουμε αντίγραφο των δεδομένων του λογαριασμού σου (αρ. DSR-…), σε κρυπτογραφημένο αρχείο· ο κωδικός ακολουθεί χωριστά. Για ποιο σκοπό τα χρησιμοποιούμε και για πόσο τα κρατάμε: https://moraki.app/el/privacy/

**Erasure done (EN).**

> Your Moraki account has been deleted (ref DSR-…). [A household only you were in was deleted with it. / Households you shared stay with the other caregivers; your name is removed, the entries you logged stay as part of their record.] We keep a record of what you agreed to and when, without your email or sign-in details, for 3 years, then it is erased. Our backups are kept for 7 days, so the data leaves them by [date]. Copies on phones aren't reached: sign out and clear the phone, or uninstall. [If you signed in with Apple or Google:] We can't remove Moraki's access from your Apple or Google account for you, only the app can do that, on your phone. To remove it yourself: for Apple, on your iPhone go to Settings → your name → Sign-In & Security → Sign in with Apple → Moraki → Stop using Apple ID. For Google, go to myaccount.google.com → Security → your connections to third-party apps and services → Moraki → delete the connection.

**Erasure done (EL).**

> Ο λογαριασμός σου στο Moraki διαγράφηκε (αρ. DSR-…). [Ένα νοικοκυριό όπου ήσουν μόνο εσύ διαγράφηκε μαζί του. / Τα κοινά νοικοκυριά μένουν στους άλλους φροντιστές· το όνομά σου αφαιρείται, οι καταχωρήσεις σου μένουν ως μέρος του δικού τους αρχείου.] Κρατάμε ένα αρχείο του τι συμφώνησες και πότε, χωρίς το email ή τα στοιχεία σύνδεσής σου, για 3 χρόνια, και μετά διαγράφεται. Τα αντίγραφα ασφαλείας κρατιούνται 7 ημέρες, άρα τα δεδομένα φεύγουν από αυτά έως [ημερομηνία]. Αντίγραφα σε κινητά δεν τα φτάνουμε: αποσυνδέσου και καθάρισε το κινητό ή απεγκατάστησε την εφαρμογή. [Αν συνδεόσουν με Apple ή Google:] Δεν μπορούμε να αφαιρέσουμε εμείς την πρόσβαση του Moraki από τον λογαριασμό σου στην Apple ή στη Google, αυτό γίνεται μόνο από την εφαρμογή, στο κινητό σου. Για να την αφαιρέσεις εσύ: για Apple, στο iPhone πήγαινε Ρυθμίσεις → το όνομά σου → Σύνδεση και ασφάλεια → Σύνδεση μέσω Apple → Moraki → Διακοπή χρήσης Apple ID. Για Google, πήγαινε στο myaccount.google.com → Ασφάλεια → οι συνδέσεις σου με εφαρμογές και υπηρεσίες τρίτων → Moraki → διάγραψε τη σύνδεση.

**Guardian outside the household (EN).**

> Thanks for writing (ref DSR-…). Moraki holds what the members of a household record; we can't decide questions of parental responsibility. To look into this, please send evidence that you have parental responsibility for the child (for example a birth certificate naming you, or a court order). We'll then let you know what we can do, within one month of your first message.

**Guardian outside the household (EL).**

> Ευχαριστούμε που μας έγραψες (αρ. DSR-…). Το Moraki κρατά ό,τι καταγράφουν τα μέλη ενός νοικοκυριού· δεν μπορούμε να κρίνουμε θέματα γονικής μέριμνας. Για να το εξετάσουμε, στείλε μας αποδεικτικό γονικής μέριμνας για το παιδί (π.χ. ληξιαρχική πράξη γέννησης με το όνομά σου ή δικαστική απόφαση). Θα σου πούμε τι μπορούμε να κάνουμε μέσα σε έναν μήνα από το πρώτο σου μήνυμα.

**Cannot verify (EN).**

> We couldn't confirm that this request comes from the account holder (ref DSR-…), so we haven't acted on it. If you can still sign in to Moraki, you can export or delete your data in Settings. Otherwise reply from the account's email address.

**Cannot verify (EL).**

> Δεν μπορέσαμε να επιβεβαιώσουμε ότι το αίτημα προέρχεται από τον κάτοχο του λογαριασμού (αρ. DSR-…), οπότε δεν προχωρήσαμε. Αν μπορείς ακόμα να συνδεθείς στο Moraki, μπορείς να εξαγάγεις ή να διαγράψεις τα δεδομένα σου από τις Ρυθμίσεις. Αλλιώς, απάντησε από το email του λογαριασμού.

## 10. Owner actions before launch

- [ ] Register `moraki.app` / hello@moraki.app with Apple's Private Email Relay and send a test to a relay address (section 3).
- [ ] MFA on every Supabase account with access to the production project; the owner is the only member with SQL-editor access.
- [ ] Create the register spreadsheet with the section 2 columns.
- [ ] Confirm daily backups in Database → Backups after the Pro upgrade, and fill in section 7.
- [ ] Lawyer: review sections 3–5 and the templates; the support page wording on email requests changed to match (draft).
