# Moraki: implementation update for the legal review

- **Date:** 2026-10-24.
- **For:** the Cyprus data-protection lawyer.
- **Replies to:** "Moraki — App Development Fixes Before Launch" (P0/P1/P2), which was based on `developer-assessment-2026-10-24.md`.
- **Prepared by:** the developer, for C.E. CODE DESIGNS LTD.
- **Status words:**
  - **Merged:** the change is in the main code line.
  - **Ready:** written, tested and passing every automated check, waiting for the owner to merge.
  - **In progress:** being written now.
  - **Owner action:** something only the owner can do, in a dashboard or an account.

Nothing below is live for users until the new app build is released. Database changes also need the owner to apply them to production (`supabase db push`).

## 1. Status of every item

### P0: before public launch

| Item | Status | What was built |
|---|---|---|
| **P0.1 Guardian declaration** | Ready (#198, #201) | Creating a household requires the declaration, a separate unticked checkbox, enforced by the server. Wording: "I confirm that I am the parent or legal guardian of this child, or otherwise have lawful authority to provide and manage the child's information in Moraki." Each member is marked as having declared or not. Ownership can pass only to a declared guardian, and if no guardian is left the household can't be handed over. Owners from before this change are asked once, with sharing paused until they declare. A caregiver can make the declaration later from Settings. Self-declared, not independently verified. |
| **P0.2 Consent and access gates** | Ready (#208) | The guardian gives the health-data consent, before any baby data is uploaded. Caregivers don't consent for the baby. Instead, before joining they see their role, that they will see the full history, and a short confidentiality agreement, which they must accept. The server allows reading household data only after the right agreement. Terms acceptance is also checked by the server. |
| **P0.3 Withdrawal** | Ready (#210) | A caregiver withdrawing means leaving the household. A guardian withdrawing: if another guardian with consent remains, only that person's processing stops. If none remains, the household is frozen: no new entries, members or reading by non-guardians. The guardian then deletes it, hands it over, or consents again. Deleting your own entries stays possible after withdrawal (it was blocked before). |
| **P0.4 Consent evidence** | Ready (#194) | An append-only history of every grant and withdrawal: purpose (health data, terms, guardian declaration, caregiver agreement), text version, date and user. Records are written only by server functions, and users can read their own but can't change or delete them. The earlier records were copied in. |
| **P0.5 Access after removal** | Ready (#211) | When the server confirms a person is no longer a member, or the household no longer exists, the app clears that household's data and reminders from the phone and shows a notice. A network error never triggers this. Files already exported or shared can't be recalled. |
| **P0.6 Purging deleted content** | Ready (#203) | 30 days after deletion, an entry's content is erased on the server, leaving only a small "deleted" marker so an offline phone can't bring it back. Phones also drop the content. Exports never include deleted entries. |
| **P0.7 Weight chart** | **Merged** (#193) | Removed: the 100% and 90% lines, the Day 10 and Day 14 markers, the "pediatrician tracks this" note and the percentage of birth weight. Kept: weights over time, birth and latest weight, and "+/− X g since birth" as plain arithmetic, also in the call script and the PDF. |
| **P0.8 Server-side validation** | Ready (#206) | The server checks entry types, value ranges and text lengths (matching the app), with a size cap per entry. Baby names are limited to 60 characters. The checks apply to new writes. |
| **P0.9 Terms, privacy and disclaimer in the app** | Ready (#204, #205) | At sign-in: "I agree to the Terms of Use" (unticked), links to the Terms and Privacy Policy in the user's language, and the line "Moraki is a notebook, not medical advice. If you're worried about your baby, contact your doctor." The acceptance is recorded with its version. When the Terms version changes, users are asked again before sharing resumes. Health-data consent stays separate. |
| **P0.10 Rights requests and deletion** | Ready (#202) and **Merged** (#199) | **#202:** <br>• A written procedure (`data-requests.md`) with a request register and one-month deadline, identity checks (including for Apple "Hide My Email" accounts) and the steps for a guardian who isn't in the household. <br>• Who may run the export and deletion scripts, how backups are handled, and reply templates. <br>• The in-app export now also includes the user's own account details, consent records and feedback. <br>**#199:** Google access is revoked when an account is deleted. Apple access was already revoked (#186). |

### P1: strongly recommended

| Item | Status | What was built |
|---|---|---|
| **P1.1 Sentry** | **Merged** (#196), plus an owner action | Turned off: session tracking, replays, screenshots, app-hang reports and native breadcrumbs. Crash reports stay on. Native crash reports can't be cleaned in the app, so the owner turns on Sentry's server-side Data Scrubber. IP storage is off, and retention is 30 days. |
| **P1.2 PDF cleanup** | **Merged** (#195) | PDF reports are deleted from the phone after sharing, as exports already are. |
| **P1.3 Guardian dispute** | Ready (#202) | A support procedure, not a custody system: ask for evidence, inform the owner, refer disputes to the lawyer. |
| **P1.4 Policy-change notice** | Ready (#205) | A new Terms version triggers an in-app notice and a renewed agreement. |
| **P1.5 Invitations** | Ready (#208) | The scope is shown before joining, and the agreement is required. |
| **P1.6 Production access** | Owner action | Two-factor login on Supabase, Sentry, Expo and Apple. Only the owner has access. The secret key isn't kept on laptops. |
| **P1.7 Test environment** | Later (owner decision) | A separate staging project after launch. Before launch, the test households are deleted from production. |
| **P1.8 Reminders** | Ready (#211) | Reminders are cancelled when access is lost or the household is cleared. |

### P2 and other reviews

- **Sign-in token on iPhone:** **Merged** (#197). The token now stays on the device and is not included in backups.
- **Export compliance:** the app uses encryption, answered as "exempt" (local data protection only; `docs/adr/011-sqlcipher.md`). For you to confirm.
- **Other P2 items:** after launch, as you suggested.

### Retention section (your §6)

- **The 24-month inactivity deletion is built and live:** a daily job at 03:31 UTC (#185, applied to production). `retention.md` no longer contradicts this (#200, merged).
- **Warning email before deletion:** Ready (#207).
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
   - Retention after account deletion: proposed 3 years, kept without email or sign-in details, then erased automatically (§3, item 1).
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

1. **Consent records after account deletion.** We propose keeping them for 3 years, without email or sign-in details, to show what was agreed (Art. 7(1)). Should the period match a Cyprus limitation period instead, for example 6 years?
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
