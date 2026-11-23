# Data protection impact assessment

**Task:** P4-11. **First written:** 2026-09-26, for a limited beta.
**Updated:** 2026-11-23, for the public iOS release in Cyprus and Greece,
against `main` at `f047637a`. **Controller:** C.E. CODE DESIGNS LTD.

**Not legal advice, and not signed off.** This update was drafted by the
developer from the repository and the owner's statements. The residual-risk
levels below are a **draft proposed by the developer, pending review** by the
legal/data-protection adviser and authorised sign-off by the controller (§7).
Statements the repository does not prove are written as **To confirm** and
collected in §8.

---

## Changelog

**2026-11-23 (this version), against the 2026-09-26 version:**

- Header, §5, §6 and §7: the beta framing ("proceed to a beta of up to five households") is replaced by an assessment of the public iOS release in Cyprus and Greece (1.0, build 14, released 2026-11-22) and of planned expansion (Android, more countries). Sign-off is restructured and marked pending.
- §2: adds the guardian declaration, the separate caregiver agreement, the server-side consent and access controls, household freezing, local-only use without an account, and the new processing for the company's social media accounts.
- §3: corrects the old statement that the baby's details are uploaded before consent; reflects the Build 10 regression test.
- §4: R1, R2, R3, R5, R6, R8, R9 and R10 rewritten for the controls built since 2026-10-24 (legal update P0/P1) and verified in Build 10. R10's Free-plan pause risk is replaced by the Pro-plan configuration. R11 (social media accounts) is new.
- §6: separates the feedback actually obtained from consultation that was not performed. Prior consultation is left pending.
- §8 is new: open items to confirm.

**2026-09-26:** first version (P4-11), for a beta of up to five households.

---

## 1. Why a DPIA is required

Article 35(3) does not list this case outright, so the decision rests on the
Article 35(1) test and the criteria in WP248. Moraki meets several:

- **Special category data** — Article 9 health data: feeds, temperatures, medication, weight, free-text notes about a baby's condition, and pumping volumes about the lactating parent.
- **Data concerning vulnerable data subjects** — a newborn, who cannot consent and whose parent or guardian acts for them.
- **Data processed on a large scale relative to the subject** — every few hours, for months, producing a detailed record of one infant's body and behaviour.
- **Innovative use** — a shared local-first record synchronised between several caregivers' phones.

Any one of the first two would justify it. Public availability in two
countries since 2026-11-22 strengthens the case; it does not change the
conclusion that a DPIA is required.

---

## 2. The processing, described plainly

### 2.1 Use without an account (local-only)

Moraki can be used without signing in. Entries are then stored only in the
encrypted database on the phone and are **not uploaded to Moraki's cloud
database** (privacy policy §3, `docs/legal/final-2026-10-28/privacy-en.md`).
Two technical calls still happen on launch with no account: the Expo update
check (IP address, platform, runtime version, channel, a random install id;
US processor) and, if the app crashes, a scrubbed Sentry crash report (EU).
Neither carries care entries (`records-of-processing.md` §4–5,
`src/observability/sentry.ts`).

Local-only entries are outside the shared service and outside Moraki's
cloud. They are lost with the phone or the app's data, and Moraki cannot
restore, export from the server or erase them for the person: only the
person can, on the phone.

### 2.2 Shared households (signed in)

A signed-in person logs what happens to a baby: feeds, diapers, sleep,
expressed milk, weight, temperature, medication, notes, appointments.
Everything is written to the local SQLite database first, so the app works
with no signal. When the phone has a connection, entries sync through the
production Supabase project (Frankfurt, Pro plan) to the other members of the
same household.

The gates that now stand in front of that sharing, each enforced by the
database and not only by the app:

- **Terms acceptance.** Recorded with its version at sign-in. "Not now" keeps the app working on the phone and pauses sharing (`has_terms()`; Build 10 checks 2 and 4; legal update P0.9).
- **Guardian declaration (final wording, P0.1).** Creating a household requires a separate unticked declaration: "I confirm that I am the parent or legal guardian of this child, or otherwise have lawful authority to provide and manage the child's information in Moraki." `create_household` refuses without it (error `MK001`). It is self-declared and not independently verified. Ownership can pass only to a declared guardian (`memberships_owner_is_guardian` trigger, `20261024100000_guardian_declaration.sql`).
- **Health-data consent by the guardian (P0.2).** `create_household` also refuses without the Terms (`MK004`) and the guardian's health-data consent (`MK003`) on record, so the baby's details are stored only after both (`20261024200000_access_gates.sql`; Build 10 check 5).
- **Separate caregiver agreement (P0.2).** Invited people do not consent for the baby. Before joining they see only their role (`invite_preview`) and the statement that they will see every past and future entry, then accept a confidentiality agreement. The server lets a non-guardian read household data only after that agreement (`has_access()`, `has_caregiver_agreement()`). Since #217 a guardian needs their own current health-data consent; the caregiver agreement no longer counts for them (`20261025180000_guardian_access_needs_consent.sql`).
- **Consent evidence (P0.4).** Every grant and withdrawal of every purpose (Terms, guardian declaration, caregiver agreement, health data) is appended to `consent_events` with version, language and time, written only by server functions (`20261024090000_consent_events.sql`).
- **Consent versions.** A new health-data consent text gives agreement to the previous version 90 days' grace; the app asks once per version (`20261026090000_consent_grace.sql`).

**Household freezing (P0.3).** A caregiver who withdraws the caregiver
agreement leaves the household. A guardian who withdraws while another
guardian still consents stops seeing the household's entries except their
own, and their new entries stay on the phone. When the **last** consenting
guardian withdraws, the household is frozen: nobody adds baby data, nobody is
invited or joins (an earlier invite stops working), and each member sees only
the entries they wrote, which they can still delete but not edit. The guardian
is offered delete, hand over, or agree again (`household_frozen()`,
`20261024210000_household_freeze.sql`; Build 10 checks 10–13). After an
explicit withdrawal, a household still frozen at 90 days is warned by email
and deleted at least 30 days later (`20261025210000_frozen_household_lifecycle.sql`,
`retention.md`). A version change alone never starts that clock.

Nothing is inferred, scored, or compared to a norm. The app adds figures up
and shows them (engineering rules 9–10, `src/i18n/copyRules.test.ts`).

### 2.3 The company's social media accounts (new)

The controller has opened an Instagram account and a Facebook Page, with no
posts yet, and plans a TikTok account (owner, 2026-11-23; account set-up in
the marketing working files, `~/Projects/moraki-marketing/ACCOUNTS.md`,
outside this repository). They promote the app; they are not part of it.

- **What is processed:** whatever people make visible to the company on those platforms (profile names, comments, messages, follows), and aggregate statistics the platforms provide.
- **Facebook Page Insights:** for the statistics Meta compiles about Page visitors, the Page operator and Meta are **joint controllers** (CJEU C-210/16, _Wirtschaftsakademie_), governed by Meta's Page Insights Controller Addendum. **To confirm:** that the addendum has been reviewed and how its essential content is made available to data subjects. Instagram and TikTok business statistics need the same check.
- **No link into the app or the website's data:** moraki.app has no tracking pixel, social plug-in or embed (`public/cookies/index.html`, `docs/legal/final-2026-10-28/cookies-en.md`). Nothing from a household is sent to a social platform.
- **Health details in comments or messages:** the marketing rules say never to ask for or repost a baby's health details, to hide comments that share them, and to point the person to `hello@moraki.app` (marketing `PLAN.md`, "Never" 2–3).
- **Privacy notice:** the published privacy policy (2026-10-28) does not mention the social accounts. Whether it must, with the joint-controller information, is a question drafted for the adviser and **not yet sent** (marketing `LAWYER-EMAIL.md`, marked "Draft. Not sent.").

Purposes, lawful bases, categories, recipients and security are set out in
[`records-of-processing.md`](./records-of-processing.md). Retention is in
[`retention.md`](./retention.md). Processors are in
[`processors.md`](./processors.md). Those three documents have not been
updated for §2.3 (see §8).

---

## 3. Necessity and proportionality

| Question                                     | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is the processing necessary for the purpose? | Yes. A shared care record cannot exist without storing what happened and who logged it. A person who does not want sharing can use the app without an account, with nothing in Moraki's cloud (§2.1)                                                                                                                                                                                                                                                                                                         |
| Is health data necessary?                    | Yes, and it is the point. A parent asked to describe a feeding pattern to a clinic cannot do it from memory at 4am                                                                                                                                                                                                                                                                                                                                                                                           |
| Is the amount minimised?                     | No location, no contacts, no photos, no advertising identifier, no analytics, no third-party SDK but the crash reporter and the update client. Sentry sessions, replays, screenshots and native breadcrumbs are off (`src/observability/sentry.ts`). Display names rather than legal names. The baby's name is whatever the family types, limited to 60 characters (P0.8). Server-side validation of entry types, ranges and lengths (`20261024150000_validate_events_and_babies.sql`)                       |
| Could it be less identifiable?               | End-to-end encryption would stop the controller reading household data. Rejected for v1: it breaks server-side validation and the consent and access gates, which read rows, and key recovery for a parent who reinstalls is a worse risk than the one it removes. The local database is encrypted (SQLCipher, ADR-011). Revisit at a major version                                                                                                                                                          |
| Is consent freely given and informed?        | The guardian's health-data consent is asked on its own screen, separately from the Terms and the guardian declaration, with no pre-ticked box. **Correction to the 2026-09-26 and 2026-10-18 text:** the baby's details are no longer uploaded before consent. Since P0.2 (#208), `create_household` refuses without the guardian's health-data consent and the Terms on record. Refusing leaves the app working on the phone. Withdrawal is in Settings → Privacy → Review consent; its effects are in §2.2 |
| Do the controls work on a device?            | Build 10 regression test, 26–27 October 2026, two iPhones against production: 28 of 28 checks passed, covering guardian creation, consent refusal and withdrawal, invitations, removal, offline reconnect, account and household deletion, entry erasure and export (`regression-build-10.md`). It is a functional test, not a security audit. Build 14, the public build, was not separately regression-tested in the repository's records (**To confirm**, §8)                                             |
| Is the retention justified?                  | A family's record of their newborn is what they came for, so live entries are not trimmed on a schedule. Deleted-entry content, inactive and frozen households, consent records, invites, feedback, crash reports, the erasure log and backups each have a period and a mechanism in `retention.md`                                                                                                                                                                                                          |

---

## 4. Risks

Scored before mitigation, as **likelihood × severity to the data subject**.
Each "Proposed residual" is the developer's draft, pending review (§7).

### R1 — Someone joins a household they have no business in

_Medium × High._ An invite code is what stands between a stranger and a
baby's health record.

Mitigated:

- **The code.** 8 characters from a 30-character alphabet, single use, 7-day expiry, revocable by the owner (Build 10 check 9), 20 attempts per rolling hour per user enforced server-side (`20260927120000_invite_rate_limit.sql`).
- **Pre-joining disclosure.** Before accepting, the invitee sees only the role and the statement that they will see every past and future entry, then the caregiver agreement. Nothing about the baby (`invite_preview`; Build 10 check 7).
- **Acceptance controls.** Joining needs a signed-in account, the Terms, and the caregiver agreement; access to household data follows the agreement, not the membership alone (`has_access()`).
- **Current access restrictions.** A frozen household admits nobody, and invites made before it froze stop working. Only the owner can change roles (`memberships_self_update` trigger, `20260922160300_rls_policies.sql`), and only a declared guardian can become owner.

**Not mitigated:** the person who sends the code decides who receives it, and
the guardian declaration is self-declared.

_Proposed residual: Low._

### R2 — A phone is lost or stolen, or a member loses access

_Medium × High._ The local database holds the household's full history.

Mitigated:

- **At rest.** SQLCipher, keyed by 256 random bits in the keychain or Keystore, never backed up off the device (P5-03, ADR-011). The session token stays on the device and out of backups (legal update, P2).
- **Local cache removal on confirmed loss of access (P0.5, #211).** When the server confirms the person is no longer a member, or the household no longer exists, the app clears that household's data and reminders from the phone and shows a notice (`src/sync/membershipStatus.ts`, `src/sync/erasure.ts`; Build 10 check 14). A network error, or any answer that is not clear, never triggers it (`MembershipStatusError`; Build 10 check 16).

**Offline limitations, not mitigated:** a phone removed while offline keeps
the data until it reconnects (Build 10 check 15); a phone that never
reconnects keeps it indefinitely. Exported or shared files cannot be
recalled. An unlocked phone in someone else's hands shows the app as its
owner sees it.

_Proposed residual: Low._

### R3 — Health data leaks into a crash report

_Low × High._ A stack trace carries whatever the failing code was holding,
and a database error quotes the statement it failed on.

Mitigated:

- **In the app.** An allow-list scrubber rebuilds each JS event and breadcrumb field by field (`src/observability/scrub.ts`, tested in `scrub.test.ts`). `sendDefaultPii` is off.
- **Sessions disabled.** `enableAutoSessionTracking: false`; tracing, profiling, replays, screenshots, app-hang and watchdog reports and native breadcrumbs are off (`src/observability/sentry.ts`, P1.1 #196). This closes the release-health sessions the 2026-10-24 assessment found being sent before any account or consent.
- **Server side.** Native crashes bypass the JS scrubber. Sentry's Data Scrubber and default scrubbers on, and IP storage off, were owner-confirmed in the dashboard on 2026-10-26 (`regression-build-10.md`, "Owner-confirmed in dashboards"). EU ingest only; retention 30 days.

_Proposed residual: Low._

### R4 — Health data leaks into a notification on a lock screen

_Low × High._

Mitigated: notification bodies are content-free by rule (rule 8), asserted by
`src/i18n/copyRules.test.ts`. The appointment reminder shows only
"Appointment tomorrow at …" (Build 10 check 24). Push notifications (P4-02)
are not built.

_Proposed residual: Low._

### R5 — A member sees or changes data they should not

_Low × Medium._ Households are the whole access model.

Mitigated:

- **Row level security** on every table for every role, with the pgTAP suite in `supabase/tests/database/` (888 planned assertions at `f047637a`); helper functions with an empty `search_path`; an event's household is immutable; a household keeps an owner.
- **Caregiver permissions.** Roles are owner, caregiver and viewer. Owners and caregivers write; viewers read only (`can_write()`). Only the owner changes roles or removes members. Any writer can edit or delete another writer's entries; there are no per-category permissions (privacy policy §5).
- **Guardian withdrawal.** A withdrawing guardian stops seeing others' entries; the last one freezes the household (§2.2).
- **Shared-history access, by design.** An invited caregiver or viewer sees the household's **prior** history as well as future entries. This is disclosed before joining (R1) and in the privacy policy (§5), but a guardian cannot limit a member to entries from the day they joined.

**Not mitigated:** competing parental-responsibility claims. The support
procedure asks for evidence and refers disputes to the adviser
(`data-requests.md` §4); the app does not determine custody.

_Proposed residual: Low to Medium,_ because full-history access and
cross-editing are inherent in the design.

### R6 — Free text, and adult health data, beyond what anyone intended

_High × Medium._ `note`, `notes`, `questions` and feedback messages can
contain anything: another child, a clinician's opinion, a family member's
diagnosis.

**Adult health data.** Pumping records (`pump`: volume and destination) and
breast-milk bottle feeds are data about the lactating parent, and notes can
describe a parent's health or breastfeeding. The guardian's consent for the
child does not establish consent for another adult (privacy policy §4). The
lawful basis and Article 9 condition for that adult's data is an open legal
question (legal update §3, Q2).

Mitigated: all free text is treated as health data; length limits (500 for a
note, 2000 for feedback) are enforced by the app and the server (P0.8); the
feedback form asks for health details to be left out and has no household or
baby id; the privacy policy asks users to avoid unnecessary information about
other people.

_Proposed residual: Medium,_ pending the adviser's answer on the adult's
lawful basis.

### R7 — A processor is breached

_Low × High._ Supabase holds everything synced.

Mitigated: EU region (Frankfurt), RLS so a leaked publishable key grants
nothing, no secret key in any client bundle, Supabase's DPA incorporated in its
terms (keep the dated copy). Sentry holds scrubbed reports for 30 days. Brevo
receives email addresses, sign-in codes, deletion dates and the erasure
journal's ids, and no health data.

_Proposed residual: Low to Medium,_ and partly outside the controller's hands.
**To confirm:** two-factor login on every production account (still "being
set up" in the Build 10 report).

### R8 — A person's data is not erased when it should be

_Certain × Medium_ before P4-06.

Mitigated:

- **In-app erasure.** Settings → Leave or delete: leave, delete a household, or delete the account; Apple and Google access revoked on deletion (Build 10 checks 17–20).
- **30-day content purge.** A deleted entry's content is emptied on the server 30 days after deletion by `purge-deleted-event-content` (`20261024140000_purge_deleted_event_content.sql`), leaving a tombstone so offline phones converge; phones drop the content too.
- **Consent evidence.** Consent records stay after account deletion for 3 years, pseudonymous, then are erased by `purge-old-consent-records` (`20261025090000_keep_consent_records.sql`). The period awaits the adviser's confirmation.
- **Backup restoration.** Supabase Pro daily backups, kept 7 days, no point-in-time recovery; deleted data ages out within 7 days. After any restore every erasure since the backup is re-applied before the app reopens (`data-requests.md` §7).
- **External erasure journal.** Every deleted account, household and entry is logged in `erasure_log` (ids only, 35 days), and each night the previous day's rows are emailed to the owner's mailbox through Brevo, outside the database, so they survive a restore (`supabase/functions/send-erasure-journal/`, `20261026100000_erasure_journal.sql`; Build 10 check 26).

**Not mitigated:** a shared household keeps the leaving person's entries under
an author id that maps to no one (decision D3). Time-based jobs (30-day purge,
35-day log purge, 3-year consent erasure) are covered by pgTAP but could not
be observed in a same-day device test.

_Proposed residual: Low._

### R9 — The app, or its marketing, is read as medical advice

_Medium × High._ A parent with a feverish newborn will read anything as
guidance, and promotional text counts towards a product's intended purpose
under EU device law.

Mitigated in the app:

- **Medical-boundary features.** No interpretation, ranges or traffic-light colours on a figure. The weight chart shows grams since birth only, without the 90%/100% lines and Day 10/14 markers (P0.7; Build 10 check 23). The sign-in screen says "Moraki is a notebook, not medical advice" (P0.9). A lint rule and `src/i18n/copyRules.test.ts` fail on words like "normal", "healthy" or `φυσιολογικό` in both languages.

Mitigated in consumer marketing (working files outside this repository,
`~/Projects/moraki-marketing/`; nothing posted yet):

- **Positioning.** The message is "one shared notebook" (`PLAN.md`, `ACCOUNTS.md` bios), not a medical device.
- **No health interpretation.** `PLAN.md` "Never" 1–2: never say what a number means or that the app helps a baby do anything; never answer a health question, reply with a pointer to the paediatrician.
- **AI-labelled images and voice.** AI images are for mood only, with the platform's AI label on and "Εικόνες με AI" in the caption; reels using an AI voice say "Φωνή με AI"; no AI person speaking as a customer, clinician or the founder, no AI baby faces, app screens always real with demo data (marketing `CLAUDE.md`, `REELS.md`).

**Not mitigated yet:** the captions have not been reviewed by the adviser
(drafted question 3 in marketing `LAWYER-EMAIL.md`, not sent).

_Proposed residual: Low,_ revisited whenever app or marketing copy changes.

### R10 — Records outlive their purpose, or the server stops enforcing retention

_Medium × Low._

**Replaced:** the 2026-09-26 risk that the Supabase Free plan pauses an idle
project, stopping the retention sweeps. Production runs on the **Pro plan**
(`regression-build-10.md`, backend line; `retention.md`, "Server backups"),
which does not pause an idle project (owner statement, 2026-11-23). Daily
backups are kept 7 days (owner-confirmed 2026-10-26).

Mitigated: the daily `pg_cron` jobs in `retention.md` — inactivity warning at
23 months and deletion at 24 months, frozen-household warning and deletion,
30-day content purge, invite, feedback and consent-record sweeps.

**To confirm:** that the cron jobs are succeeding in production (Supabase →
Integrations → Cron) and that alerts are on; the owner's daily health email
(L-F5) and monitoring runbook (L-F6) are not built.

_Proposed residual: Low._

### R11 — Social media accounts (new)

_Low × Medium._ People may disclose a baby's health details in comments or
messages; Page statistics are processed jointly with Meta.

Mitigated: no pixel, plug-in or embed on moraki.app; no household data sent to
any platform; the marketing rules on health details (§2.3).

**Not mitigated:** the privacy notice does not yet cover the accounts or the
joint-controller arrangement (§8).

_Proposed residual: Low,_ once the notice question is settled.

---

## 5. Assessment of the public release and future expansion

**Current release.** iOS 1.0, build 14, public in Cyprus and Greece since
22 November 2026 (TASKS L-04). The controls the 2026-09-26 version required
before a public release are in place: erasure (P4-06), local encryption
(P5-03, ADR-011), invite rate limiting (P2-F7). The legal update's P0 items
(guardian declaration, consent and access gates, withdrawal and freezing,
consent evidence, access removal, content purge, medical boundary,
server-side validation, Terms and disclaimer, rights procedure) are live and
passed the Build 10 regression test. The final legal texts are published
(`docs/legal/final-2026-10-28/`, L-01).

**Open points for the current release** (detail in §8): the lawful basis for
an adult's health data in pumping records and notes, and for caregiver access;
the 3-year consent-record period; the privacy notice for social media; the
review of marketing captions; whether a DPO is now required (Art. 37(1)(c):
large-scale processing of special-category data as a core activity — the
records of processing said to revisit this beyond a small beta); test
households removed from production; two-factor login.

**Android.** Built and in Google Play review, not released (TASKS A-08). The
same backend and code apply. Before release: record the Play Data safety
answers as submitted (L-F10), and rerun the access-removal, export and
erasure checks on an Android device. Android adds FCM only if push
notifications are built, which they are not.

**More countries.** Each new market needs, before release: the supervisory
authority and any national age or parental-authority rules, the legal texts
and in-app copy in the local language (rule 9 and the copy-rules test cover
English and Greek only), and a review of this DPIA's §5–§7.

---

## 6. Consultation

**Feedback actually obtained.** The owner's own use on two iPhones with test
data (Build 10). The Cyprus data-protection lawyer's review of the
developer assessment and of the legal texts, through three rounds recorded in
`legal-update-2026-10-24.md`, resulting in the final texts of 2026-10-28.
That is advice on the documents, not a documented review of this DPIA.

**Consultation not performed.** No data subjects (parents, guardians or
caregivers outside the developer's household) have been asked about the
processing or the consent screens. The 2026-09-26 plan to ask beta testers
did not happen in a recorded form. Whether to seek users' views now, for
example on the consent and invitation screens, is for the controller to
decide (Art. 35(9)).

**Prior consultation with the Cyprus Commissioner for Personal Data
Protection.** Article 36 applies where the DPIA indicates a **high residual
risk that the controller cannot mitigate**. The draft in §4 proposes no
residual above Medium. Whether prior consultation is required is **pending**
the adviser's review and the controller's decision; it is not decided here.

---

## 7. Review and sign-off — Public release

|                                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assessment status                         | Updated for the public iOS release of Moraki in Cyprus and Greece on 22 November 2026                                                                                                                                                                                                                                                                                                                                                                                                       |
| Assessment scope                          | The Moraki iOS app 1.0 (build 14) and its production backend (Supabase, Frankfurt, Pro plan) as at `main` `f047637a`; local-only use without an account; shared households; the processors in `processors.md`; the website moraki.app; the company's Instagram and Facebook accounts and planned TikTok account. Android (in Play review) and other countries are assessed as planned expansion only                                                                                        |
| Assessment carried out by                 | the developer, with Claude Code, for C.E. CODE DESIGNS LTD                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Previous release decision                 | The original assessment concerned a limited beta and has been superseded for operational status                                                                                                                                                                                                                                                                                                                                                                                             |
| Changes reviewed                          | Guardian declaration; Terms acceptance; guardian health-data consent before any baby data is stored; separate caregiver agreement and pre-joining disclosure; server-side access gates; withdrawal and household freezing with its lifecycle; consent evidence and versioning; local cache removal on loss of access; 30-day content purge; erasure log and journal; Supabase Pro backups; Sentry hardening; weight-chart and copy medical boundary; local-only mode; social media accounts |
| Residual-risk conclusion                  | To be recorded following reassessment. The levels in §4 are a draft proposed by the developer, pending review                                                                                                                                                                                                                                                                                                                                                                               |
| Prior consultation (Art. 36)              | Pending (§6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Reviewed by legal/data-protection adviser | Pending documented review                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Controller approval                       | Pending authorised sign-off by C.E. CODE DESIGNS LTD                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Next review                               | On a material change to processing, purposes, risks, service providers, data categories, analytics, advertising technology or supported markets, and otherwise per the documented review schedule                                                                                                                                                                                                                                                                                           |

---

## 8. Open items to confirm

1. The lawful basis and Article 9 condition for an adult's health data in pumping records and notes, and for caregiver access (legal update §3, Q2).
2. The 3-year consent-record period (Q1) and the other open questions in legal update §3 and `regression-build-10.md`, "Open legal decisions".
3. Whether the privacy policy must mention the social accounts and the Page Insights joint-controller arrangement; that Meta's Page Insights Controller Addendum has been reviewed; the equivalent for Instagram and TikTok business statistics.
4. The adviser's review of the marketing captions and AI-labelled reels.
5. Whether a DPO must be appointed now that the app is public (Art. 37(1)(c)).
6. That the production test households were removed before public launch (`regression-build-10.md`).
7. Two-factor login on Supabase, GitHub, Expo, Sentry, Apple, Cloudflare, Brevo and A2 Hosting.
8. That the production cron jobs are succeeding, and monitoring and alerts are on.
9. That build 14 needs no separate regression test beyond Build 10 (app and database changes between Build 10 `5325ca5a` and build 14 `6063b0df`: the 28 October Terms version, L-02; joining by code while signed out, L-F1; the Sign in with Apple name fix, P5-F14).
10. That the Pro plan does not pause an idle project, with dated evidence in `retention.md`.
11. The data-request register: the Build 10 report lists it as created; TASKS L-F4 lists it as deferred.
12. Update `records-of-processing.md`, `processors.md` and `retention.md` for the social accounts and for the corrections in §3.
