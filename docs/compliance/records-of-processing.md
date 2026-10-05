# Records of processing

**Task:** P4-11. **Written:** 2026-09-26. **Covers:** Moraki as built at
`809de78a` plus the branches open on that date. GDPR Article 30.

**Not legal advice.** SDD 12.1 requires a review by a Cyprus data protection
lawyer before P5. This document is written so that review has something
accurate to read.

---

## 1. Controller

|                |                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller     | CE Code Designs Ltd (trading as the publisher of Moraki), Cyprus                                                                                                           |
| Contact        | the address published in the app's About screen and the store listing (P5-06)                                                                                              |
| DPO            | none appointed. Not required under Article 37 on current scale; revisit if the app is offered beyond a small beta, because the processing is Article 9 data about children |
| Representative | not applicable — the controller is established in the EU                                                                                                                   |

Parents are **data subjects**, not joint controllers: they enter their own
household's data, but the controller decides what is stored, where and for how
long.

---

## 2. Purposes and lawful bases

| Purpose                                                                             | Data                                                       | Lawful basis                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Record a baby's care so caregivers share one picture of it                          | everything in §3.3                                         | Article 6(1)(b), performance of the contract with the account holder                                               |
| Process health data about the baby (feeds, temperatures, notes, medication, weight) | §3.3 rows marked **health**                                | **Article 9(2)(a), explicit consent**, asked per caregiver on its own screen, stored with a policy version (P3-09) |
| Sign in without a password                                                          | email address, one-time code                               | Article 6(1)(b)                                                                                                    |
| Share entries between caregivers in one household                                   | §3.3                                                       | Article 6(1)(b)                                                                                                    |
| Remind a caregiver a feed may be due                                                | computed on the device from §3.3; nothing sent to a server | Article 6(1)(b)                                                                                                    |
| Diagnose crashes                                                                    | §3.4                                                       | Article 6(1)(f), legitimate interest in a working app, with health data excluded by design and by test             |
| Read feedback someone chose to send                                                 | §3.5                                                       | Article 6(1)(a) for the message, or 6(1)(f); it is sent only on a deliberate action                                |

The consent in Article 9(2)(a) is **not** the basis for running the service; it
is the additional condition for processing the special category. Withdrawing it
stops that processing (writes stop syncing) without terminating the account,
which is why the two are kept separate.

**Children's data.** The baby cannot consent. The parents consent as holders of
parental responsibility. A `viewer` who never writes anything still consents,
because reading health data is processing it.

---

## 3. Categories of data

### 3.1 Account

| Field                       | Where                        | Note                                                                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| email address               | `auth.users` (Supabase Auth) | from the code sign-in, or from Apple or Google. With Apple it may be a private relay address                                                                                                                                                                                               |
| sign-in provider identity   | `auth.identities` (Supabase) | Sign in with Apple or Google (P5-04): the provider's user id and the ID token's claims. Apple is asked for the email only (P5-F3). Google's token also carries the account's name and profile picture URL, which Supabase Auth keeps in `identity_data`. The app never reads or shows them |
| one-time sign-in code       | Supabase Auth, transient     | 10 minute expiry                                                                                                                                                                                                                                                                           |
| `display_name` (1–40 chars) | `memberships`                | what other caregivers see on an entry. A first name or a nickname; not asked as a legal name                                                                                                                                                                                               |
| `relation`                  | `memberships`                | optional, one of mother, father, grandparent, caregiver, other                                                                                                                                                                                                                             |
| `role`                      | `memberships`                | owner, caregiver, viewer                                                                                                                                                                                                                                                                   |
| consent record              | `consents`                   | user id, policy version, granted/withdrawn timestamps                                                                                                                                                                                                                                      |

The app asks for no name, address, phone number, payment detail, location or
contact list. The one exception it does not ask for: Google sign-in hands over
the Google account's name and picture URL, stored by Supabase Auth and unused.

### 3.2 The baby

`babies`: name (as the family types it — often a nickname), date and time of
birth, birth weight, and two fields present in the schema but never written by
the app (`birth_length_mm`, `head_circ_mm`).

### 3.3 Entries — `events`

One table, one row per logged thing, the detail in a `jsonb` payload. **Bold**
rows are health data under Article 9.

| Type           | Payload                                           |                                                                                                           |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `feed_bottle`  | `ml`, `milk`, `from_stock`                        | **health**                                                                                                |
| `feed_breast`  | `side`, `left_s`, `right_s`                       | **health**                                                                                                |
| `diaper`       | `kind`, `color`, `note`                           | **health**                                                                                                |
| `sleep`        | `place`                                           | **health**                                                                                                |
| `pump`         | `ml`, `dest`                                      | **health** (the mother's, not the baby's)                                                                 |
| `stock_adjust` | `loc`, `delta_ml`, `reason`                       | inventory                                                                                                 |
| `health`       | `note` (free text, ≤500), `temp_c`, `tags`        | **health**                                                                                                |
| `medication`   | `name`, `dose`                                    | **health**                                                                                                |
| `weight`       | `grams`, `source`                                 | **health**                                                                                                |
| `appointment`  | `title`, `doctor`, `clinic`, `notes`, `questions` | **health**, and it names third parties — a clinician's name is their personal data, entered by the family |

Every row also carries: which household and baby, when it happened and ended,
who created it, who last updated it, when the client made it, the server
sequence number, and a `deleted_at` tombstone.

Two consequences worth stating plainly rather than burying:

- **Free text can hold anything.** `note`, `notes` and `questions` are typed by a parent. The app cannot know what is in them and treats all of it as health data.
- **A deleted entry is not gone.** The client only ever soft-deletes (engineering rule 7): the row stays with `deleted_at` set, so every other phone learns of the deletion and converges. Erasure of the row itself happens when the household is deleted (P4-06).

### 3.4 Crash reports

Sent to Sentry only from a build carrying a DSN. An allow-list rebuilds each
event field by field (`src/observability/scrub.ts`), so what leaves the phone
is: the exception type, a redacted message, stack frames (file, function,
line), the app version, device model and OS, and navigation breadcrumbs with
their data stripped.

Removed before sending: the user, the IP address, request and response bodies,
console logs, route parameters, stack-frame locals, and any field the app has
not explicitly allowed. Text that does travel has quoted runs, JSON blobs,
email addresses and UUIDs replaced and is capped at 300 characters, because a
database error quotes the statement it failed on and a statement can carry a
note. 27 tests assert this against events shaped like real failures.

### 3.5 Feedback

`feedback`: the message (≤2000 chars), what it is about, the app version,
platform, language, the author's user id, and a timestamp. Deliberately **no
household or baby id**, so nothing in it can be joined to health data. Readable
only by its author and the controller. The form asks people to leave health
details out; it cannot enforce that, so a message is treated as potentially
containing them.

**Not in the household export (P4-F2, decided 2026-09-27).** Settings → Your
data (P4-05) exports the _household's_ entries; a feedback row belongs to the
person, not the household, so it was never in scope for that export and
adding it there would mean building a second, person-scoped export path for
one small table. The row is not unreachable, though: its author can already
read it back through the same API the app itself uses (`select` is allowed
for `user_id = auth.uid()`), and GDPR access (Article 15) is met by providing
it on request rather than through the self-serve export.

### 3.6 On the device only, never synced

The local SQLite database mirrors §3.2 and §3.3 and adds: the outbox of
unsent changes, `sync_errors` (what the server refused and why), and
`pref.`-prefixed settings — night mode, language, reminder settings, the
consent copy, the adopted household record, and which duplicate questions have
been answered. The session token lives in the OS keychain (`expo-secure-store`).

On iOS the keychain survives uninstalling the app, so a reinstall can open
already signed in with an empty database.

---

## 4. Recipients

Other caregivers in the same household, and the processors in
[`processors.md`](./processors.md). Nothing is sold, used for advertising, or
used to train any model. There are no analytics and no third-party SDKs in the
app beyond the crash reporter.

## 5. Transfers outside the EU/EEA

None intended. Supabase runs in `eu-central-1` (Frankfurt) and Sentry is an
EU-region organisation; both are chosen for that reason, and the Sentry DSN is
rejected at startup unless it points at the EU ingest host. Apple and Google process data
outside the EU when an app is distributed or a push is delivered — see
[`processors.md`](./processors.md) for what reaches them, which today is a
tester's email address and no household data at all.

Sign in with Apple or Google (P5-04) is a person choosing their own provider:
Apple and Google act as independent controllers of that sign-in, and only the
identity data in §3.1 comes back. Nothing about the household goes to them.

## 6. Retention

See [`retention.md`](./retention.md).

## 7. Security measures

| Measure                                                                                      | Where                                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Row level security on every table, every role, no exceptions                                 | `supabase/migrations/*_rls_policies.sql`, 336 pgTAP assertions                                              |
| A caregiver can only ever reach their own household's rows                                   | `is_member`, `can_write`, `is_owner` helpers with an empty `search_path`                                    |
| Health writes require a current consent row, enforced in the database                        | `has_consent()` in the `events` insert and update policies                                                  |
| Immutable columns on an event, so an update cannot move it between households                | `keep_columns` trigger                                                                                      |
| A household cannot be left without an owner                                                  | `memberships_keep_an_owner` trigger                                                                         |
| Session token in the OS keychain, not in the database                                        | `expo-secure-store`                                                                                         |
| Transport encryption everywhere                                                              | HTTPS/TLS to Supabase and Sentry                                                                            |
| Local database encrypted at rest                                                             | SQLCipher, key in the keychain or Keystore, never backed up off the device (P5-03, ADR-011)                 |
| No health data in notifications, logs or crash reports                                       | engineering rule 8; asserted by tests in `src/i18n/copyRules.test.ts` and `src/observability/scrub.test.ts` |
| Invite codes: 8 characters from a 30-character alphabet, single use, 7-day expiry, revocable | `invites` table and `accept_invite`                                                                         |
| Data minimisation by construction                                                            | no location, contacts, photos, or advertising identifiers anywhere                                          |

**Known gaps**: none open on the board. A removed caregiver keeps the copy
already on their own phone, which no measure here can reach (DPIA R2).
