# Moraki: implementation update for the legal review

- **Date:** 2026-10-24.
- **For:** the Cyprus data-protection lawyer.
- **Replies to:** "Moraki — App Development Fixes Before Launch" (P0/P1/P2), which was based on `developer-assessment-2026-10-24.md`.
- **Prepared by:** the developer, for C.E. CODE DESIGNS LTD.
- **Status words:**
  - **Live:** merged, applied to the production database on 2026-10-25, and in iOS build 1.0.0 (7) (TestFlight, 2026-10-25).
  - **Ready:** written, tested and passing every automated check, waiting for the owner to merge.
  - **In progress:** being written now.
  - **Owner action:** something only the owner can do, in a dashboard or an account.

Nothing below is live for users until the new app build is released. Database changes also need the owner to apply them to production (`supabase db push`).

## 0. What changed since the first version of this note (25 October 2026)

- **Everything in §1 is now live.**
  - The database changes are applied to production.
  - The app changes are in TestFlight build 1.0.0 (7).
  - The website is updated.
  - The owner is running the regression checks you asked for. A report follows.
- **Consent records (your Q1):** implemented with **3 years**.
  - When an account is deleted, its consent history is kept, with only an internal ID, the purpose, the version and the dates. No email or sign-in details.
  - A nightly job erases those records 3 years after the deletion.
  - The period is a single setting, so please confirm or change it.
  - The privacy policy says this.
  - The in-app "Delete account" text no longer says the consent record is deleted with the account.
- **Company details on the website (Privacy and Terms only):** C.E. CODE DESIGNS LTD, HE472540, VAT CY60172873D, Akropoleos 4, Paphos, Cyprus. The owner would prefer not to publish the address. **Please confirm whether it must be public** (e-commerce information duty, GDPR contact details), or whether a different address could be used.
- **Providers added to the privacy policy:**
  - **A2 Hosting:** the hello@moraki.app mailbox and the website, on servers in the Netherlands.
  - **Brevo:** the inactivity warning emails, France.
  - **Cloudflare:** website delivery and DNS, under SCCs and the DPF.
  - Supabase (Pro plan, Frankfurt), Sentry (EU), Expo (US) and Google Workspace (sign-in code emails) were already listed.
- **Expo update checks:** kept as they are (owner decision). Proposed basis: legitimate interest. Please confirm.
- **Backups:** Supabase Pro, daily backups kept 7 days.
- **A fix made while merging:** a deleted entry counts as household activity from the moment it was deleted, not when its content is later erased. The 30-day purge therefore can't keep a household alive and delay its inactivity warning and deletion.

## 1. Status of every item

### P0: before public launch

| Item                                              | Status                | What was built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0.1 Guardian declaration**                     | **Live** (#198, #201) | Creating a household requires the declaration, a separate unticked checkbox, enforced by the server. Wording: "I confirm that I am the parent or legal guardian of this child, or otherwise have lawful authority to provide and manage the child's information in Moraki." Each member is marked as having declared or not. Ownership can pass only to a declared guardian, and if no guardian is left the household can't be handed over. Owners from before this change are asked once, with sharing paused until they declare. A caregiver can make the declaration later from Settings. Self-declared, not independently verified. |
| **P0.2 Consent and access gates**                 | **Live** (#208)       | The guardian gives the health-data consent, before any baby data is uploaded. Caregivers don't consent for the baby. Instead, before joining they see their role, that they will see the full history, and a short confidentiality agreement, which they must accept. The server allows reading household data only after the right agreement. Terms acceptance is also checked by the server.                                                                                                                                                                                                                                          |
| **P0.3 Withdrawal**                               | **Live** (#210)       | A caregiver withdrawing means leaving the household. A guardian withdrawing: if another guardian with consent remains, only that person's processing stops. If none remains, the household is frozen: no new entries, members or reading by non-guardians. The guardian then deletes it, hands it over, or consents again. Deleting your own entries stays possible after withdrawal (it was blocked before).                                                                                                                                                                                                                           |
| **P0.4 Consent evidence**                         | **Live** (#194)       | An append-only history of every grant and withdrawal: purpose (health data, terms, guardian declaration, caregiver agreement), text version, date and user. Records are written only by server functions, and users can read their own but can't change or delete them. The earlier records were copied in.                                                                                                                                                                                                                                                                                                                             |
| **P0.5 Access after removal**                     | **Live** (#211)       | When the server confirms a person is no longer a member, or the household no longer exists, the app clears that household's data and reminders from the phone and shows a notice. A network error never triggers this. Files already exported or shared can't be recalled.                                                                                                                                                                                                                                                                                                                                                              |
| **P0.6 Purging deleted content**                  | **Live** (#203)       | 30 days after deletion, an entry's content is erased on the server, leaving only a small "deleted" marker so an offline phone can't bring it back. Phones also drop the content. Exports never include deleted entries.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **P0.7 Weight chart**                             | **Live** (#193)       | Removed: the 100% and 90% lines, the Day 10 and Day 14 markers, the "pediatrician tracks this" note and the percentage of birth weight. Kept: weights over time, birth and latest weight, and "+/− X g since birth" as plain arithmetic, also in the call script and the PDF.                                                                                                                                                                                                                                                                                                                                                           |
| **P0.8 Server-side validation**                   | **Live** (#206)       | The server checks entry types, value ranges and text lengths (matching the app), with a size cap per entry. Baby names are limited to 60 characters. The checks apply to new writes.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **P0.9 Terms, privacy and disclaimer in the app** | **Live** (#204, #205) | At sign-in: "I agree to the Terms of Use" (unticked), links to the Terms and Privacy Policy in the user's language, and the line "Moraki is a notebook, not medical advice. If you're worried about your baby, contact your doctor." The acceptance is recorded with its version. When the Terms version changes, users are asked again before sharing resumes. Health-data consent stays separate.                                                                                                                                                                                                                                     |
| **P0.10 Rights requests and deletion**            | **Live** (#202, #199) | **#202:** <br>• A written procedure (`data-requests.md`) with a request register and one-month deadline, identity checks (including for Apple "Hide My Email" accounts) and the steps for a guardian who isn't in the household. <br>• Who may run the export and deletion scripts, how backups are handled, and reply templates. <br>• The in-app export now also includes the user's own account details, consent records and feedback. <br>**#199:** Google access is revoked when an account is deleted. Apple access was already revoked (#186).                                                                                   |

### P1: strongly recommended

| Item                          | Status                                | What was built                                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1.1 Sentry**               | **Live** (#196), plus an owner action | Turned off: session tracking, replays, screenshots, app-hang reports and native breadcrumbs. Crash reports stay on. Native crash reports can't be cleaned in the app, so the owner turns on Sentry's server-side Data Scrubber. IP storage is off, and retention is 30 days. |
| **P1.2 PDF cleanup**          | **Live** (#195)                       | PDF reports are deleted from the phone after sharing, as exports already are.                                                                                                                                                                                                |
| **P1.3 Guardian dispute**     | **Live** (#202)                       | A support procedure, not a custody system: ask for evidence, inform the owner, refer disputes to the lawyer.                                                                                                                                                                 |
| **P1.4 Policy-change notice** | **Live** (#205)                       | A new Terms version triggers an in-app notice and a renewed agreement.                                                                                                                                                                                                       |
| **P1.5 Invitations**          | **Live** (#208)                       | The scope is shown before joining, and the agreement is required.                                                                                                                                                                                                            |
| **P1.6 Production access**    | Owner action                          | Two-factor login on Supabase, Sentry, Expo and Apple. Only the owner has access. The secret key isn't kept on laptops.                                                                                                                                                       |
| **P1.7 Test environment**     | Later (owner decision)                | A separate staging project after launch. Before launch, the test households are deleted from production.                                                                                                                                                                     |
| **P1.8 Reminders**            | **Live** (#211)                       | Reminders are cancelled when access is lost or the household is cleared.                                                                                                                                                                                                     |

### P2 and other reviews

- **Sign-in token on iPhone:** **Live** (#197). The token now stays on the device and is not included in backups.
- **Export compliance:** the app uses encryption, answered as "exempt" (local data protection only; `docs/adr/011-sqlcipher.md`). For you to confirm.
- **Other P2 items:** after launch, as you suggested.

### Retention section (your §6)

- **The 24-month inactivity deletion is built and live:** a daily job at 03:31 UTC (#185, applied to production). `retention.md` no longer contradicts this (#200, merged).
- **Warning email before deletion:** **Live** (#207). Brevo is configured and the jobs run nightly.
  - After 23 months without activity, every member receives an email from `hello@moraki.app`, sent through **Brevo** (EU, France).
  - The email says the household will be deleted in 30 days unless someone opens the app. It contains no baby or health details.
  - A household is deleted only if it was warned at least 30 days earlier and nobody used it since.
- **Backups:** Supabase Pro from launch, with daily backups kept 7 days and no point-in-time recovery. The owner confirms this in the dashboard.

**Detail from #208 to #211, for the texts:**

- **Before joining,** a person sees only their role (from an `invite_preview` check) and the statement "you'll see every entry, past and future". They see nothing about the baby until they accept the caregiver agreement.
- **A frozen household:**
  - Nobody can add entries, invite or join.
  - Non-guardians can't read.
  - Authors can always read and delete their own entries.
- **Health-data consent version:** this release asks every user to agree again (version 2026-10-25). Until the owner agrees again, existing households are frozen.

## 2. What the published documents must now say

These are facts for you to put in your own wording. Items marked (after P0.2/0.3/0.5) apply once #208, #210 and #211 are merged.

**Privacy Policy**

1. **Guardian authority:** the person creating a household declares they are the parent or legal guardian, or otherwise have lawful authority. The declaration is self-declared and recorded with its date and version.
2. **Lawful basis (after P0.2):** the health data of the baby is processed on the guardian's explicit consent. Caregivers access it under the guardian's invitation and a confidentiality agreement; they don't consent for the baby. The parent's own data in free-text notes (for example breastfeeding) needs a basis too. **For you to set.**
3. **Before agreement:** without the guardian's consent, no baby data is uploaded. Caregivers can't read household data until they accept the agreement (after P0.2).
4. **Withdrawal (after P0.3):**
   - If a caregiver withdraws, they leave the household.
   - If the last consenting guardian withdraws, the household is frozen until it is deleted, handed to another guardian, or consent is given again.
   - Deleting your own entries remains possible.
5. **Consent records:**
   - What is recorded: purpose, version, date, and every grant and withdrawal.
   - Retention after account deletion: 3 years, kept without email or sign-in details, then erased automatically by a daily job. **Implemented** 2026-10-25 (`20261025090000_keep_consent_records.sql`), pending your confirmation of the period (§3, item 1).
6. **Deleted entries:** the content is erased from our servers 30 days after deletion. A minimal deletion marker remains for synchronisation.
7. **Removed or departed members (after P0.5):**
   - When someone loses access, the app removes the household's data from their phone the next time it connects.
   - Copies they exported or shared before can't be recalled.
8. **Inactive households:**
   - A warning email is sent 30 days before deletion, after 23 months without activity.
   - **Brevo** (EU) is added as a processor: it receives the email address and sends the message.
   - Accounts are kept.
9. **Backups:** daily, kept 7 days. Deleted data leaves the backups within 7 days.
10. **Crash reports (Sentry):**
    - Crash reports only. No usage sessions.
    - IP addresses aren't stored. Kept 30 days.
    - A crash report may include a random install identifier, the device model and the OS version.
11. **App updates (Expo):**
    - On every launch the app checks for updates. This sends the device's IP address and a random install identifier to Expo in the US.
    - Proposed basis: legitimate interest (security and bug fixes).
    - Safeguards: Expo's Standard Contractual Clauses and its EU–US Data Privacy Framework certification.
    - Owner decision: keep this as it is.
12. **Export:** the JSON and CSV export contains the current baby's entries and details, members' names and roles and, when signed in, the user's own account details, consent records and feedback. It doesn't contain deleted entries or other members' email addresses. Anything else is available by request (`data-requests.md`).
13. **Account deletion:**
    - If you signed in with Apple or Google, Moraki also asks Apple or Google to remove its access.
    - Entries in households other people share stay with that household, without your account.
14. **Requests outside the app:**
    - Send them to `hello@moraki.app`.
    - Identity is checked by replying from the account's email or, for Apple "Hide My Email", by a code sent to that address.
    - A guardian outside the household is asked for evidence of parental responsibility.
15. **Medical boundary:** the app shows recorded values and plain totals and differences only. There are no reference ranges, thresholds or expected values.
16. **On the phone:**
    - The local database is encrypted.
    - The sign-in token stays on the device.
    - PDF and export files are deleted after sharing.
17. **Company details:**
    - C.E. CODE DESIGNS LTD, registration HE472540, VAT CY60172873D.
    - Registered address: still a placeholder.
    - Email provider for `hello@moraki.app` and its region: still placeholders.

**Terms of Use**

- **Acceptance in the app:** at sign-in, recorded with its version. Users are asked again when the Terms change.
- **Guardian declaration:** as above. Ownership of a household can pass only to a declared guardian.
- **Caregivers:** joining requires accepting the confidentiality agreement (after P0.2).
- **Eligibility:** users are 18 or over. The App Store rating of 4+ is a content rating only.
- **No medical advice:** the medical disclaimer, as quoted under P0.9.

**Support page:** the deletion and data-request steps follow `data-requests.md`. They were updated in #202 and are marked for your review.

**In-app texts for your review** (English and Greek are in the PRs):

- the guardian declaration;
- the Terms acceptance line;
- the caregiver agreement (P0.2);
- the health-data consent text;
- the household-frozen notice (P0.3);
- the "no longer in this household" notice (P0.5);
- the inactivity warning email.

## 3. Questions for you

1. **Consent records after account deletion.** We propose keeping them for 3 years, without email or sign-in details, to show what was agreed (Art. 7(1)). Should the period match a Cyprus limitation period instead, for example 6 years? **Implemented with 3 years** (decided 2026-10-25), pending your confirmation. The period is one constant, so changing it is a one-line migration.
2. **Lawful basis:**
   - For the parent's own data in notes.
   - For caregivers' access under the guardian's invitation.
   - For Expo update checks (legitimate interest).
3. **Freezing the household** when the last guardian withdraws: is this proportionate, or should the household be deleted?
4. **Purge period:** is 30 days for deleted-entry content acceptable?
5. **The inactivity warning:** 23 months, then 30 days' notice, with only one email. Should there be a second reminder?
6. **Existing owners** (before the declaration existed) are treated as guardians, but are asked once to declare before sharing resumes. Acceptable?
7. **"Not now" on the Terms and guardian screens.** The app keeps working on the phone, but sharing stays paused until the user agrees. Acceptable, or should these screens fully block the app?
8. **Export compliance** answered as "exempt": confirm.
9. **Font licence:** the Comfortaa reserved-name point on the website's font files (low risk).

## 4. Owner actions (not legal)

- **Apply to production:** after each database PR is merged, run `supabase db push`.
- **Sentry:** turn on Data Scrubber and Use Default Scrubbers.
- **Brevo:**
  - Create the account, accept the DPA and create an API key.
  - Verify `moraki.app` (SPF, DKIM and DMARC records in DNS).
  - Add the sender `hello@moraki.app`.
  - Set the secrets, deploy the function and run the setup SQL (`docs/10-release-runbook.md`).
- **Apple:** register `moraki.app` and `hello@moraki.app` for Sign in with Apple email relay.
- **Accounts:** turn on two-factor login on Supabase, Sentry, Expo and Apple.
- **Request register:** start one (`data-requests.md`).
- **Supabase Pro:**
  - Upgrade.
  - Confirm daily backups kept 7 days.
  - Delete the TestFlight test households.
- **Fill in on the website:** registered address, email provider and region.
- **After everything is merged:**
  - Install the new TestFlight build.
  - Confirm you stay signed in when installing over the previous build.
  - Run the regression checks the lawyer listed: guardian creation, refusing consent, withdrawing consent, invitations, removing a caregiver, reconnecting after being offline, deleting an account, deleting a household, deleting entries, and export.

## 5. Round 2 (25 October)

Your corrections to `retention.md`, `data-requests.md` and this document,
each checked against the code before it was written.

**Corrections made**

1. **`retention.md` matches build 7.**
   - Inactive households: the warning email is sent (Brevo, after 23 months), and a household is deleted only 30 days or more after the warning, with nobody using it since. Every "no warning email" statement is gone.
   - The rights table's Restriction row now describes withdrawal: a caregiver withdrawing the agreement leaves, a guardian withdrawing stops their own processing, and the last consenting guardian withdrawing freezes the household. While frozen, nobody writes, invites or joins, members read nothing, and authors can read and delete (not edit) their own entries.
   - Also brought up to date: consent records kept 3 years after account deletion, the 30-day purge, the export's contents, Apple and Google revocation, and backups (Pro, 7 days).
2. **`retention.md`, new section "Why consent records are kept for 3 years":** purpose (Art. 7(1), Art. 17(3)(e)), what is kept and why it is pseudonymous, who can see it, the erasure job, and that the period awaits your confirmation.
3. **`data-requests.md`:**
   - A guardian outside the household: each request is assessed on its own facts, weighing the other household members' rights and competing parental-responsibility claims. Disputed cases go to you before any disclosure or erasure.
   - In-app erasure: what evidence the database keeps (consent records with `account_deleted_at` for a deleted account, nothing for a deleted household), and how to re-apply in-app deletions after a backup restore by comparing ids.
   - Email deletion: Apple and Google access can only be revoked from the person's phone. The EN and EL replies now tell the person how to remove Moraki from their Apple ID and Google account.
4. **Support pages (EN, EL):** the "no longer have the app" part says the same as point 3, still marked as a draft.

**Decisions, implemented (owner, 2026-10-25)**

1. **Frozen household lifecycle.** Implemented in `20261025210000_frozen_household_lifecycle.sql`.
   - After **90 days** frozen, every member with an email address gets a warning from `hello@moraki.app` through Brevo, in English and Greek: the household has been paused because no parent or guardian has agreed to keep sharing, and will be deleted on a named date unless a guardian opens Moraki and agrees again. It names no baby and no health data.
   - **30 days or more** after the warning, if the household is still frozen and every email went out, it is deleted with everything in it, as `delete_household` does.
   - A guardian agreeing again unfreezes it and voids the warning at once.
   - The 90 days count from the first daily run that finds the household frozen. Households frozen when the migration is applied, including those frozen by the 2026-10-25 consent version, start their 90 days then.
2. **Erasure log for backup restores.** Implemented in `20261025200000_erasure_log.sql`.
   - `erasure_log` holds one row per deleted account or household: kind, uuid, time and reason (the person's request, the owner deleting the household, inactivity, frozen, or a request to us). No content, no name, no email.
   - Written by triggers on the tables, so every way of deleting is covered. Readable by the service role only.
   - Kept **35 days** (backups are kept 7), then purged by a daily job.
   - `data-requests.md` section 7 now re-applies erasures from the log, read off production before a restore, instead of comparing ids.
   - The privacy policy (EN, EL) has a short line on each, still marked as a draft.

**Found while checking the code, for you and the owner**

- A guardian who joined by invite accepted the caregiver agreement. If they later withdraw health-data consent while another guardian still consents, the server still lets them read and write through that agreement (`has_access` in `20261024210000_household_freeze.sql`). The in-app withdrawal text says they stop seeing the household's entries.
- The support pages still say account deletion removes "your consent records", and that only Apple access is revoked. Since build 7 consent records stay 3 years and Google access is revoked too. Not changed in this round, as you asked for no other changes there.

## 6. Round 3 (26 October)

- **Guardian access gap, fixed (#217, live):**
  - **Before:** a guardian who joined by invite and then withdrew health-data consent could still see the household through the caregiver agreement.
  - **Now:** guardians need their own current health-data consent, and the caregiver agreement no longer counts for them. Caregivers are unchanged. Authors can still read and delete their own entries.
- **Support and privacy pages, corrected (EN and EL):**
  - Account deletion keeps the consent records for 3 years, as section 0 says.
  - Deleting in the app revokes both Apple and Google access.
  - Inactive households get the warning email, which the old text said they didn't.
- **New website pages (#218, live):** both carry the draft banner for your wording, and both are linked from every footer.
  - **Legal notice** at moraki.app/legal and /el/legal/ ("Στοιχεία εταιρείας"): company name, registration number, VAT number, registered address, contact, supervisory authority, hosting.
  - **Cookie policy** at moraki.app/cookies and /el/cookies/: the website sets no cookies and loads nothing from other servers. It keeps only the light/dark choice in the browser's local storage (`moraki-theme`). Checked on the live site on 2026-10-25: no `Set-Cookie` header from the host or Cloudflare, and Cloudflare Bot Fight Mode is off. **For you to confirm:** that the theme choice is strictly necessary for a feature the visitor chose, so it needs no consent banner.
- **Frozen-household lifecycle and erasure log:** live in production (section 5).
- **Build 8 on device:** the log screens overlapped their header and form in the native form sheet. They now open as the standard iOS page sheet (#221, build 9), which also slides up over Home and closes with a swipe. This is a layout change only; no data handling changes.
- **Erasure record that survives a restore (owner decision 2026-10-26, answering your point):**
  - Deleting a single entry is now logged too, like accounts and households: kind, id, time, reason; no content.
  - Every night the previous day's erasure records are emailed to the owner's mailbox, outside the database, as a CSV of ids only. Days with no erasure send nothing. The emails are kept at least 35 days.
  - After any restore, every erasure in the emails dated on or after the backup day is applied again before the app reopens (`data-requests.md`, section 7). **For you to confirm:** that 35 days is long enough to keep the emails, and whether the privacy policy should mention the journal (it goes through Brevo, already a listed processor).
