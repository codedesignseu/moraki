# App Privacy and Data safety answers

**Task:** P5-06. **Written:** 2026-10-05. **For:** App Store Connect → App Privacy, and Google
Play Console → Data safety, for v1.

Every answer comes from [`records-of-processing.md`](../compliance/records-of-processing.md)
(cited as **RoP** with its line numbers at `5b0fca95`), [`processors.md`](../compliance/processors.md)
or the code it names. If one of those changes, these answers change with it, before the build
that carries the change is submitted.

---

## App Store Connect: App Privacy

### Do you or your third-party partners collect data from this app?

**Yes.** Once a person signs in, their account and their household's entries are stored in
Supabase (RoP 29–37, processors.md "Supabase"). Apple counts data as collected when it leaves the
device and is kept longer than needed to serve a request in real time, which is the case here.
Someone who never signs in sends nothing but crash reports.

### Tracking

**No data is used to track.** Nothing is shared with data brokers or combined with other
companies' data for advertising. "Nothing is sold, used for advertising, or used to train any
model. There are no analytics and no third-party SDKs in the app beyond the crash reporter"
(RoP 147–150). No advertising identifier is read anywhere (RoP 178). The app therefore needs no
App Tracking Transparency prompt.

### Data types

| Data type (Apple's name)              | Collected | Linked to the user | Tracking | Purpose           |
| ------------------------------------- | --------- | ------------------ | -------- | ----------------- |
| Health & Fitness → **Health**         | Yes       | Yes                | No       | App Functionality |
| Contact Info → **Email Address**      | Yes       | Yes                | No       | App Functionality |
| Contact Info → **Name**               | Yes       | Yes                | No       | App Functionality |
| Identifiers → **User ID**             | Yes       | Yes                | No       | App Functionality |
| Diagnostics → **Crash Data**          | Yes       | **No**             | No       | App Functionality |
| User Content → **Other User Content** | Yes       | Yes                | No       | App Functionality |

Not collected, so answered "No" or left unticked: Financial Info, Location (precise and coarse),
Sensitive Info, Contacts, Emails or Text Messages, Photos or Videos, Audio Data, Gameplay
Content, Customer Support (see the note under Other User Content), Browsing History, Search
History, Device ID, Purchases, Product Interaction, Advertising Data, Other Usage Data,
Performance Data, Other Diagnostic Data, Environment Scanning, Hands, Head, Body, Other Data
Types. The basis for "no" is RoP 63–64 ("No name, address, phone number, payment detail, location
or contact list is collected anywhere in the app") and RoP 178 ("no location, contacts, photos, or
advertising identifiers anywhere"), plus RoP 149 (no analytics). Performance Data is "No" because
tracing is off: `tracesSampleRate: 0` and `enableAutoPerformanceTracing: false` in
`src/observability/sentry.ts`.

### Why each answer

**Health — linked, App Functionality.** Feeds, diapers, sleep, pumping, health notes,
temperature, medication, weight and appointments are Article 9 health data (RoP 72–88, rows
marked **health**; the lawful basis is RoP 32). Each entry is stored with its household, baby and
the id of who created and last updated it (RoP 90–92), so it is linked to an identity. Purpose is
the service itself: "Record a baby's care so caregivers share one picture of it" (RoP 31). Birth
weight, in the baby profile (RoP 68–70), is declared here too.

**Email Address — linked, App Functionality.** The account's email is in `auth.users` (RoP 56)
and is used to send the sign-in code (RoP 33; processors.md "Google Workspace"). Apple's relay
address, if the person chooses Sign in with Apple's hide-my-email, is still an email address.

**Name — linked, App Functionality.** `display_name`, 1–40 characters, shown to other caregivers
on each entry (RoP 58). It is a first name or a nickname, but Apple's "Name" covers a first name,
so declare it. Also covered here, though not yet written into RoP: Google's sign-in token carries
the Google account's name (and a profile picture URL), which Supabase Auth keeps in the user's
identity record. Moraki never reads them. See "Gaps" below.

**User ID — linked, App Functionality.** Every account has a Supabase user id. It is stored on
every membership, every entry it authored (RoP 90–91), every consent row (RoP 61) and every
feedback row (RoP 116). It is never sent to Sentry: `Sentry.setUser(null)` in
`src/observability/sentry.ts`, and the scrubber replaces UUIDs in any text that travels (RoP
109–111).

**Crash Data — not linked, App Functionality.** A crash report carries the exception type, a
redacted message, stack frames, app version, device model and OS, and data-stripped navigation
breadcrumbs (RoP 99–105). "Removed before sending: the user, the IP address, request and
response bodies, console logs, route parameters, stack-frame locals" (RoP 107–108). With no user,
no IP and no device identifier, it cannot be tied back to a person, which is Apple's test for
"not linked". Purpose: "Diagnose crashes" (RoP 36), which Apple files under App Functionality
("minimize app crashes"), not Analytics.

**Other User Content — linked, App Functionality.** Two things land here:

- Feedback: the message, its topic, app version, platform, language, the author's user id and a timestamp (RoP 114–121). Linked, because the user id is stored with it. Purpose: reading and acting on feedback someone chose to send (RoP 37). Apple has a separate "Customer Support" type; feedback is closer to a product suggestion box than a support ticket, so "Other User Content" is the better fit, but ticking Customer Support as well does no harm.
- The baby profile's name and date of birth (RoP 66–70), which is content the family types and not one of Apple's other categories. Linked through the household.

Free-text notes, appointment notes and questions are health data (RoP 96) and are already
declared under Health.

### On-device only, not declared

Preferences, the outbox, `sync_errors` and the reminder schedule stay on the phone (RoP 132–141).
Feed reminders are computed on the device and "nothing sent to a server" (RoP 35). Apple does not
count data that never leaves the device as collected.

---

## Google Play: Data safety

| Play category → type                            | Collected | Shared | Optional? | Purposes                                                              |
| ----------------------------------------------- | --------- | ------ | --------- | --------------------------------------------------------------------- |
| Health and fitness → **Health info**            | Yes       | No     | Optional  | App functionality                                                     |
| Personal info → **Email address**               | Yes       | No     | Optional  | App functionality, Account management                                 |
| Personal info → **Name**                        | Yes       | No     | Optional  | App functionality, Account management                                 |
| Personal info → **User IDs**                    | Yes       | No     | Optional  | App functionality, Account management                                 |
| App activity → **Other user-generated content** | Yes       | No     | Optional  | App functionality (baby profile); Developer communications (feedback) |
| App info and performance → **Crash logs**       | Yes       | No     | Required  | App functionality                                                     |
| App info and performance → **Diagnostics**      | Yes       | No     | Required  | App functionality                                                     |

- **Optional**: an account is not required to use the app (support page, "Do I need an account?"). Nothing in the first five rows reaches a server without signing in.
- **Required** for crash logs and diagnostics: there is no in-app switch for crash reporting. Diagnostics covers the device model, OS and app version that travel with a crash (RoP 102–105).
- **Shared: No** for every row. Play does not count transfers to service providers processing on the developer's behalf (Supabase, Google Workspace, Sentry; processors.md) as sharing.
- **Is all data encrypted in transit?** Yes: "HTTPS/TLS to Supabase and Sentry" (RoP 175).
- **Can users request that data be deleted?** Yes. In the app, in Settings (P4-06), and by email from https://moraki.app/support#delete for someone who no longer has the app. Play asks for that web URL in the account-deletion section.
- **Data processed ephemerally?** No for all rows: everything collected is stored.
- **Independent security review / Families policy**: not applicable. The app is not in the Families programme; it is for adults (terms §2).

---

## Gaps found while writing this

Things the answers rely on that `records-of-processing.md` does not yet say, for the owner and
the lawyer:

1. **Sign in with Apple and Google (P5-04) are not in RoP or processors.md.** Both shipped after
   P4-11 was written. Google's ID token includes the account's name and picture URL, and Supabase
   Auth stores the token's claims in `auth.identities.identity_data`; RoP 56 ("the only identifier
   that is not generated by the app") is no longer quite true. Apple's token carries an email (or a
   relay address) and no name. RoP §3.1 and processors.md need a row each.
2. **The app asks Apple for the full name and then drops it.** `src/features/auth/socialSignIn.ts`
   requests `FULL_NAME`, but only the identity token is passed on, and Apple's token has no name in
   it. Either stop asking (data minimisation) or use it. Until then it is not collected and is not
   declared.
3. **Google Workspace's data region is unconfirmed** (processors.md: "confirm the data region
   setting on the account"). The privacy policy therefore says "Google's infrastructure" rather
   than "EU".
4. **Retention and the DPIA still describe erasure as not built** (retention.md lines 18 and 39,
   DPIA R8). The privacy policy describes P4-06 as available, per the brief. Update both documents
   in the release that ships P4-06's Settings screens, together with the consent screen copy, which
   still says "Deleting it from the servers is coming soon" (`consent.rights` in `src/i18n`).
