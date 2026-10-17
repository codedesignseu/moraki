# Privacy audit for the lawyer briefing (2026-10-18)

**What this is.** A read-only audit from the code, migrations, config and docs. It is not legal advice.

**What it covers.** `main` at `8ad8a828`, plus the new website on `web/new-site` at `10df5cb7`. PRs #180, #181 and #182 have since been merged into main at `983797e6`. As a result:

- the app and the site now both use `hello@moraki.app`;
- the new website is on main.

**Fixes in progress (2026-10-18).** These are open PRs, not merged:

- neutral appointment reminders, feedback copy, the Face ID string and export clean-up (finding 3 and others);
- Sign in with Apple token revocation;
- a consent text that matches the app, version 2026-10-18;
- a 24-month inactivity sweep.

Each answer gives the finding, the evidence (file:line), and "NOT DETERMINABLE FROM CODE" where the answer lives in a dashboard.

## Owner's dashboard answers so far

- **Sentry:** "Prevent storing IP addresses" is on. Retention is 30 days (free plan).
- **Supabase:** free tier. Backup, point-in-time recovery and log retention are the free-tier defaults; confirm them from Supabase's plan documentation.
- **EAS `production` environment:** holds these variables (names only):
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  - `EXPO_PUBLIC_SENTRY_DSN`
  - `EXPO_PUBLIC_SENTRY_ENV`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `SENTRY_ALLOW_FAILURE`
  - `SENTRY_AUTH_TOKEN`

---

## 1. Caregiver alerts

**Not shipped.** The owner deferred push (P4-02) to v1.1 on 2026-10-05.

- No code registers a push token. There is no `getExpoPushTokenAsync` or `getDevicePushTokenAsync` in `src/` or `app/`.
- There is no edge function: `supabase/functions/` holds only `.gitkeep`.
- There is no Settings opt-in. `RemindersCard` covers local reminders only.
- No push payload exists.

**Evidence:**
- `docs/TASKS.md:303`
- The `push_tokens` table exists but nothing writes to it: `supabase/migrations/20260922151518_core_schema.sql:105-113`, with `caregiver_alerts boolean default false` and `user_id … on delete cascade`.
- Its RLS is "self only": `20260922160300_rls_policies.sql:74-75`.

**What happens to `push_tokens`:**
- Sign out: nothing.
- Leave household: nothing (the table is not linked to a household).
- Delete account: hard-deleted by the cascade from `auth.users`. The table is empty today anyway.

Whether the hosted table holds rows is NOT DETERMINABLE FROM CODE (Supabase → Table editor).

## 2. Feedback

**Table.** `public.feedback`: `id, user_id (not null, FK auth.users on delete cascade), kind ('problem'|'idea'|'other'), message, app_version (≤40), platform ('ios'|'android'|'web'), locale (≤20), created_at`.

Evidence: `supabase/migrations/20260925120000_feedback.sql:11-21`.

**What is attached to a message:**
- The user id.
- No email, but `user_id` joins to `auth.users.email` on the server.
- The app version (the marketing version).
- `Platform.OS`.
- The locale tag.
- No device model and no OS version.

Evidence: `src/features/feedback/useFeedback.ts:28-32`, `src/sync/feedback.ts:39-46`.

**RLS.** The author can insert and select their own rows only (`feedback.sql:31-35`). There is no update or delete policy. The controller reads rows through the dashboard or the service role.

**On delete account.** Rows are hard-deleted by the cascade (`feedback.sql:13`).

**Limits:**
- Length 1–2000 characters (`:16`; `src/sync/feedback.ts:8`).
- 10 messages per hour per account, enforced by a trigger (`:44-58`).
- Rows are deleted after 24 months by a daily pg_cron sweep (`20260928090000_retention_sweeps.sql:21-22, 41-44, 59`).

**Mismatch.** The in-app copy promised a reply through the app, which doesn't exist. This is being fixed.

Whether the cron jobs exist and run on the hosted project is NOT DETERMINABLE FROM CODE (Supabase → Integrations/Cron).

## 3. Deletion

**Jobs.** There are no edge functions. The only jobs are two pg_cron sweeps:
- feedback older than 24 months, daily at 03:17 UTC;
- invites 90 days after they were used or expired, daily at 03:23 UTC.

Evidence: `retention_sweeps.sql:41-60`. **Nothing purges soft-deleted events**, on the server or on the phone.

| Flow | Server | Phone |
|---|---|---|
| **Delete single entry** | `events` is soft-deleted (`deleted_at`, `updated_by`). **The payload, including free text, is kept** for the life of the household (`20260922183314_push_events.sql:148-151`). | Soft delete plus an outbox op after the 6 s undo window (`src/db/repositories/events.ts:37, 301-330`). The tombstone stays. |
| **Leave household** (`leave_household`) | The caller's membership is hard-deleted. If they were the last owner, the successor or a fallback is promoted (`20261005150000_erasure_successor.sql:13-63`). Their events and invites keep their UUID. Their consents, push_tokens, feedback, invite_attempts and `auth.users` row are kept. | `resetPhone` hard-deletes local events, outbox, sync_errors, memberships, babies and the household meta. It keeps consent, night mode, language and reminders (`src/db/resetPhone.ts:31-66`). The account stays signed in. |
| **Delete household** (owner; `delete_household`) | `households` is hard-deleted. The cascade hard-deletes memberships, babies, events (including tombstones) and invites (`20261005090000_erasure.sql:117-126`). Each member's consents, push_tokens, feedback and `auth.users` row are not touched. | The caller's phone runs `resetPhone`. **Other members' phones keep their local copy.** |
| **Delete account** (`delete_account`) | Shared households: `hand_over_and_leave`. Sole member: the household is deleted. Then `delete from auth.users`, which cascades to memberships, consents, push_tokens, feedback and invite_attempts. In shared households, **the person's events and invites remain under their UUID** (the FKs were dropped, `erasure.sql:26-30`; `erasure_successor.sql:68-89`). | `resetPhone({forgetAccount:true})`, then a local sign-out (`src/sync/erasure.ts:58-61`). |

NOT DETERMINABLE FROM CODE (Supabase): the retention of `auth.audit_log_entries`, API and auth logs (IPs, emails), and backups.

## 4. Retention: 24-month inactivity

**Not built** in code or migrations. There is no sweep, no warning email and no function.

- `retention_sweeps.sql:1-16` says so explicitly.
- `docs/compliance/retention.md:25` says "not built … waits on P4-06". That is stale: P4-06 has shipped.
- SDD §12.1 (`docs/02-sdd-and-build-plan.md:671`) still describes it.
- The new policy says entries are kept "for as long as the household exists". That is consistent with the code.

A sweep is being added in an open PR.

## 5. Sentry

**Init** (`src/observability/sentry.ts:24-43`):
- `sendDefaultPii: false`
- `enableCaptureFailedRequests: false`
- `enableAutoPerformanceTracing: false`
- `tracesSampleRate: 0`
- `maxBreadcrumbs: 20`
- `beforeSend` is the allow-list scrubber `scrubEvent`.
- `beforeBreadcrumb` keeps only navigation, app.lifecycle and sentry.event, with `data` dropped.
- `Sentry.setUser(null)`.

**Scrubber** (`src/observability/scrub.ts:67-183`):
- Keeps the app, device, os, runtime and culture contexts, plus tags, release, dist, environment and sdk.
- Keeps stack frames as file, function and line only.
- In message text, replaces emails, UUIDs, `{…}`, `[…]` and quoted runs. Caps the text at 300 characters.

**Not set, so SDK defaults apply:**
- No replay.
- `attachScreenshot` and `attachViewHierarchy` are false by default.
- Release and dist come from the build. Environment comes from `EXPO_PUBLIC_SENTRY_ENV`.
- Source maps are uploaded through the Expo plugin (`app.json:76-80`).

**Region.** The DSN host is `*.ingest.de.sentry.io`, the EU (Germany). The app refuses any other host (`src/observability/dsn.ts:15, 38-43`).

**Residual risks:**
- Redacted messages can still carry unquoted fragments such as numbers.
- **Native crashes do not pass through the JS `beforeSend`** (`node_modules/@sentry/react-native/ios/RNSentryStart.m:232-255`).
- **Session tracking is on by default** (`enableAutoSessionTracking`), and session data is not scrubbed.
- The native SDKs create a per-install ID by default; verify this on a received event.
- A hidden test error is sent after 7 taps on the version label (`SettingsScreen.tsx:239-243`).

The owner confirms IP storage is off and retention is 30 days. NOT DETERMINABLE FROM CODE (Sentry): whether events show `user.id`, `device.id` or a session `did`.

## 6. Network hosts and identifiers

**Hosts the app contacts:**
- **Supabase `*.supabase.co`:** REST and RPC, Auth (email OTP and ID-token exchange), and the Realtime websocket (`src/sync/auth.ts:29-38`, `src/sync/realtime.ts`). The region is eu-central-1 per `docs/compliance/processors.md:20`; confirm in Supabase.
- **Sentry:** `*.ingest.de.sentry.io`.
- **Expo updates:** `https://u.expo.dev/<projectId>` (`app.json:109-111`) and Expo's CDN.
- **Google Sign-In:** Google OAuth endpoints, and Play services on Android.
- **Apple:** Sign in with Apple.
- **The OS:** fetches `moraki.app/.well-known/*`.
- **Browser:** About links open moraki.app pages.
- **Not contacted:** Expo push, APNs or FCM tokens.

**expo-updates config:**
- `url` is u.expo.dev.
- `fallbackToCacheTimeout: 0`.
- `enabled` and `checkAutomatically` use the defaults (enabled, `ON_LOAD`).
- `runtimeVersion` policy is `appVersion`.
- Channels are development, preview and production (`eas.json:13, 26, 31`).
- Request headers include `EAS-Client-ID`, `Expo-Platform`, `Expo-Runtime-Version`, `expo-channel-name` and the update IDs.

**Packages that read identifiers or call out:**
- `expo-eas-client`: a random persisted UUID sent as `EAS-Client-ID`.
- `expo-application` (pulled in by expo-notifications): can read IDFV or `ANDROID_ID`, but no app code calls it.
- `expo-device`: not installed.
- `expo-notifications`: local only.
- Sentry native SDKs: device model, OS, app version, locale, timezone, and an install ID by default.
- `@supabase/supabase-js`: user id and JWT.
- The Google and Apple sign-in SDKs: provider tokens.
- No advertising ID is read anywhere.

**Store labels (reading of the code; the owner and lawyer decide):**
- **App Store "Data Used":** Health (linked), Email (linked), Name (linked), User ID (linked), Other User Content (linked), Crash Data (not linked). **Consider** Device ID (`EAS-Client-ID`, Sentry install ID) and Other Diagnostic Data (Sentry sessions). No tracking. The current draft answers Device ID "No".
- **Google Play Data safety:** Health info, Email, Name, User IDs, Other user-generated content, Crash logs, Diagnostics. **Consider** "Device or other IDs". Encrypted in transit. Deletion URL `https://moraki.app/support#delete`.

## 7. Notifications

All notifications are local, from `scheduleNotificationAsync` (`src/notifications/expoPort.ts:72`). The title is "Moraki".

| Key | EN | EL |
|---|---|---|
| reminders.feed.first | Next feed may be due | Μπορεί να πλησιάζει το επόμενο τάισμα |
| reminders.feed.second | No feed logged since {{time}} | Δεν έχει καταγραφεί τάισμα από τις {{time}} |
| reminders.appointment.dayBefore | Tomorrow: {{title}} | Αύριο: {{title}} |
| reminders.appointment.hourBefore | In an hour: {{title}} | Σε μία ώρα: {{title}} |

- **The free-text appointment title appears on the lock screen** (`src/domain/activities/appointment.ts:39-51`). It is being changed to a neutral text in an open PR.
- No amount, note or temperature appears.
- There are no push strings.
- The widget and Live Activity scaffolds are not wired in.

## 8. Permissions

**iOS:**
- `ITSAppUsesNonExemptEncryption: false` (`app.json:16`), while SQLCipher is in use. That is an export-compliance question.
- `NSFaceIDUsageDescription` comes from the expo-secure-store plugin and is unused. It is being removed.
- `NSLocalNetworkUsageDescription` comes from expo-dev-launcher; check it is absent from production builds.
- No camera, photos, microphone, location, contacts or tracking permission.
- Entitlements: `aps-environment` (from expo-notifications), Sign in with Apple, `applinks:moraki.app`.
- No privacy manifest is declared in `app.json`.

**Android permissions:**
- `INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`.
- `SYSTEM_ALERT_WINDOW` (template).
- `READ/WRITE_EXTERNAL_STORAGE` with `maxSdkVersion` 32.
- No location, contacts, camera or microphone.

**Backups:**
- **Android:** `allowBackup="true"` with expo-secure-store's rules (sharedprefs only, SecureStore excluded), so the database is not backed up.
- **iOS:** the encrypted database file goes into iCloud and device backups. Its key is `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, so it doesn't migrate (`src/db/client.ts:34-40`).
- **iOS session token:** default `WHEN_UNLOCKED`, so it is included in encrypted backups.

NOT DETERMINABLE FROM CODE (EAS build artefact): the final merged manifest and Info.plist.

## 9. On-device storage

- **Database.** SQLCipher (`app.json:51-55`, `src/db/encryption.ts`, file `moraki-encrypted.db`).
- **Database key.** 32 random bytes in SecureStore under `moraki.db.key`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`src/db/client.ts:27-40, 60-62`). If the key is lost, the database is reset.
- **Auth session.** In SecureStore, in chunks under `moraki.auth` (`src/sync/auth.ts:19-36`).
- **Export files.** Left in the cache directory (`src/privacy/useExport.ts:65-68`). This is being fixed.

## 10. Export

- **Where:** Settings → "Data export" → "Export my data".
- **Files:** JSON and CSV, built on the phone and handed to the share sheet. Nothing is uploaded.
- **JSON contents:** exportedAt, householdId, the baby, **every caregiver's userId, display name and role**, and every event with its full payload and author UUIDs (`src/domain/export/exportHousehold.ts:45-79`).
- **CSV contents:** events only.
- **Not included:** emails, feedback, consents, invites. **Soft-deleted rows are not included** (`src/db/repositories/events.ts:427-436`).
- **Who can run it:** any role, signed in or not. There is no role check.

## 11. Consent

**Version.** `2026-09-23`. It is set in `20260923060000_consent.sql:12-13`, `src/privacy/useConsent.ts:13` and i18n. **The text changed after that** (2026-09-24, P3-F6; 2026-10-05, commit 4e58b49b) **without a version bump.** A rewrite and a bump to 2026-10-18 are in an open PR.

**EN text at audit time:**
- **Title:** "Health data"
- "Moraki records what you log about your baby: feeds, diapers, sleep, weight, temperatures, notes and medication. That is health data, so we ask before processing it."
- "It is stored on your phone and, once you sign in, on servers in the EU so your caregivers see it too."
- "Only people in your household see it. It is never sold, never used for advertising, and never used to train anything."
- "You can export everything at any time. You can delete your account, or the whole household, in Settings → Leave or delete. Withdrawing this agreement stops it being processed, and you can delete any entry on this phone."
- "Policy version {{version}}"
- **Buttons:** "I agree" / "Not now" / "Withdraw my agreement"
- **Withdraw hint:** "Your entries stay on this phone and stop syncing. Nothing already saved is deleted."
- **After agreeing:** "You agreed to this on this account."

**EL text at audit time:**
- **Title:** "Δεδομένα υγείας"
- "Το Moraki καταγράφει ό,τι γράφεις για το μωρό σου: ταΐσματα, πάνες, ύπνο, βάρος, θερμοκρασίες, σημειώσεις και φάρμακα. Αυτά είναι δεδομένα υγείας, γι' αυτό ζητάμε τη συμφωνία σου πριν τα επεξεργαστούμε."
- "Αποθηκεύονται στο τηλέφωνό σου και, μόλις συνδεθείς, σε διακομιστές στην ΕΕ, ώστε να τα βλέπουν και οι άλλοι στο νοικοκυριό."
- "Τα βλέπουν μόνο τα άτομα του νοικοκυριού σου. Δεν πωλούνται ποτέ, δεν χρησιμοποιούνται για διαφημίσεις και δεν χρησιμοποιούνται για την εκπαίδευση κανενός μοντέλου."
- "Μπορείς να εξάγεις τα πάντα όποτε θέλεις. Μπορείς να διαγράψεις τον λογαριασμό σου, ή ολόκληρο το νοικοκυριό, από τις Ρυθμίσεις → Αποχώρηση ή διαγραφή. Η ανάκληση αυτής της συμφωνίας σταματά την επεξεργασία, και μπορείς να διαγράψεις οποιαδήποτε εγγραφή σε αυτό το τηλέφωνο."
- "Έκδοση πολιτικής {{version}}"
- **Buttons:** "Συμφωνώ" / "Όχι τώρα" / "Ανακαλώ τη συμφωνία μου"
- **Withdraw hint:** "Οι εγγραφές σου μένουν σε αυτό το τηλέφωνο και σταματούν να συγχρονίζονται. Τίποτα από όσα έχουν αποθηκευτεί δεν διαγράφεται."
- **After agreeing:** "Συμφώνησες με αυτόν τον λογαριασμό."

The consent screen does not link to the privacy policy.

**Blocked without consent:**
- Server: event insert and update, including soft deletes (`consent.sql:67-78`).
- Client: pushing the outbox (`src/sync/pushEngine.ts:47`).

**Not blocked without consent:**
- Pulling and reading household data (`src/sync/pullEngine.ts:83-85`).
- Realtime.
- `create_household` (uploads the baby's name, birth time and birth weight).
- `accept_invite`.
- Updates to `babies`.
- Feedback.
- Local logging.

**On withdrawal:**
- **Phone:** RPC `withdraw_consent`, and the local pref is set to null (`useConsent.ts:56-66`). Pushes stop and the outbox grows. Pulls and reminders continue.
- **Server:** `consents.withdrawn_at = now()` (`consent.sql:52-62`) and the row is kept. RLS now refuses that user's event writes, **including deletes**.

## 12. Roles

Sources: `rls_policies.sql`, `consent.sql`, `erasure*.sql`.

**Owner:**
- Reads everything, including invites.
- Writes events (with consent) and babies, and updates household settings.
- Changes members' roles and relations. Through the API this includes making someone owner; the UI offers caregiver or viewer only.
- Creates and revokes invites, removes members, deletes the household.
- Can't leave as the last owner without handing over.

**Caregiver:**
- Reads households, members, babies and events.
- Inserts and updates **any** household event (with consent), and inserts and updates babies.
- Changes only their own display name. Can leave.
- Can't see invites.

**Viewer:** read-only. Can change their own display name and leave.

**What members see of each other:** `user_id`, `display_name`, `relation`, `role`, `joined_at` (`src/sync/pullCaregivers.ts:22`). No emails.

**When the owner leaves:** the baby's data stays. A successor becomes owner (chosen, or a fallback: the longest-standing caregiver, then viewer; `erasure_successor.sql:13-41`). A sole member must delete the household instead.

## 13. Invites

- **Code:** 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. The generator uses `b % 30`, so `9` never appears; the effective space is 30⁸ (`20260922180014_invites.sql:9-10, 24-38`).
- **Expiry:** 7 days (`:15-16`).
- **Use:** single-use, with `used_at`/`used_by` (`20260927120000_invite_rate_limit.sql:107-125`). One household per account.
- **Rate limit:** 20 attempts per hour **per account**, and accepting requires an attempt within the last 5 s (`:32-129`). There is no per-IP limit.
- **Revocation:** owners can revoke (`src/sync/invites.ts:128-129`).
- **Retention:** rows are swept 90 days after use or expiry.

## 14. Website (`public/`)

- **Cookies:** none.
- **Storage:** `localStorage` key `moraki-theme` only.
- **Scripts:** first-party only (`theme.js`, `join.js`, `404.js`) and one inline script allowed by a CSP hash.
- **Analytics and forms:** none (`form-action 'none'`).
- **Fonts:** self-hosted woff2 with `fonts/OFL.txt`.
- **Outbound links:** apps.apple.com and dataprotection.gov.cy.
- **Headers:** `_headers` and `.htaccess` set:
  - a strict CSP (`default-src 'self'`, `connect-src 'none'`)
  - `Referrer-Policy: no-referrer`, `nosniff`
  - a Permissions-Policy
  - `X-Frame-Options: DENY`
- **Pages:** privacy, terms and support exist in EN and EL. The privacy and terms pages carry a visible "Draft, waiting for a legal review" banner.
- **Missing:** a company registration number and postal address, anywhere. The controller is named inconsistently ("CE Code Designs Ltd (Code Designs Ltd)").

## 15. Legal docs

| File | Last update | Open lines |
|---|---|---|
| `docs/compliance/dpia.md` | 2026-10-05 | :239 "Reviewed by a lawyer: not yet" |
| `docs/compliance/records-of-processing.md` | 2026-10-06 | none |
| `docs/compliance/processors.md` | 2026-10-06 | :31 confirm the Google Workspace data region |
| `docs/compliance/retention.md` | 2026-10-05 | :25 inactive sweep "not built"; :28 hosting |
| `docs/store/app-privacy-answers.md` | 2026-10-05 | "Gaps" :125-143; item 3 (Workspace region) open |
| `docs/store/app-store-listing.md` | 2026-10-05 | :244, :254, :273-274 owner to fill in |
| `docs/adr/011-sqlcipher.md` | 2026-10-05 | accepted |
| `docs/02-sdd-and-build-plan.md` §12 | 2026-10-05 | :671 inactive sweep; "sign the Supabase DPA" (stale) |

**The docs or the policy claim something the code does not do:**
1. Policy §10 says database encryption is "planned". SQLCipher is already built.
2. Policy §9, the support page and `retention.md:36` say the export includes deleted entries. It does not.
3. Policy §11 and DPIA R4 / RoP §7 say there is no health data in notifications. Appointment titles appear (being fixed).
4. Policy §4 and RoP §2 say every caregiver consents before processing. Pulls, household creation, joining and baby edits are not consent-gated.
5. The policy and support page give wrong menu paths: "Settings → Privacy → Health data" and "Settings → Your data → Export everything".
6. The `consent.sql` comment and the SDD say a withdrawn user can still delete entries. RLS blocks this.
7. DPIA R1 says `accept_invite` runs under RLS. It is `security definer`.
8. Policy §2 and RoP §3.4 imply the app strips IP addresses and identity from crash reports. IP storage is a dashboard setting (now on), and native crashes and sessions bypass the scrubber.
9. The app privacy answers say "Device ID: No". The Expo `EAS-Client-ID` and Sentry's install ID exist.
10. The feedback copy promises a reply (being fixed).
11. `retention.md` and the SDD describe a 24-month sweep, while the policy says data is not trimmed (being aligned).
12. The consent version was not bumped after text changes (being fixed).

**The code does something the docs do not mention:**
- Soft-deleted entries keep their full payload on the server indefinitely.
- Other members' phones keep a copy after a household is deleted.
- Export files are left in the app cache (being fixed).
- Sentry session tracking.
- Supabase API and auth logs with IP addresses.
- The Face ID usage string (being removed).
- iOS backups include the encrypted database and the session token.
- The repo `LICENSE` is Expo's MIT template ("650 Industries").
- `processors.md` lists no mailbox provider for `hello@moraki.app`, and calls the web host "not a processor" although it logs IPs and `/join/CODE` URLs.

## 16. Account deletion access

- **In the app:** Settings → "Leave or delete" → "Delete your account" → confirm. This calls the `delete_account` RPC (`SettingsScreen.tsx:203-210`).
- **Without the app:** there is no web form. The support page says to email `hello@moraki.app` from the sign-in address (`support/index.html:105`, anchor `#delete`).
- **Sign in with Apple, hidden email:** in-app deletion works by user id. However:
  - **No Apple token revocation is made**, which Apple requires. It is being added in an open PR.
  - Deletion by email can't match a relay address.
  - No Google `revokeAccess` call is made.

## 17. Medical boundary

**App strings:**
- EN `about.disclaimer.noInterpretation` contains "warnings" ("There are no warnings").
- EL `log.sleep.backwards` and EL `feedback.problem.signed_out` use "πρέπει" as validation wording.
- `report.call.worry.*`: "What I'm worried about" / "Τι με απασχολεί".

**Website:** only disclaimer wording: "worried", "no warnings, ranges or scores", the terms' "πρέπει", and "χαμηλά χρώματα" for night mode. There is no "normal", "healthy" or "φυσιολογικ" anywhere.

**Colours and thresholds:** there are no value-based colours; the error colour is for invalid input only. Input ranges:
- temperature 34–43 °C
- bottle 1–400 ml
- pump 1–600 ml
- weight 500–15000 g
- birth weight 500–7000 g

**Weight chart** (`src/domain/weight/weightSeries.ts:35-39, 77-84`; `src/features/weight/WeightCard.tsx:57-83`):
- Horizontal lines at **100% and 90% of birth weight**, labelled "100%" and "90%".
- Vertical markers at **Day 10 and Day 14**.
- Filled dots for clinic weighings, hollow dots for home.
- Neutral colours.
- Summary text: "{{grams}} g above/below birth weight", with "Your pediatrician tracks this at check-ups."
- The call script shows "Change since birth: {{grams}} g ({{percent}}%)".
- The code calls these "the two lines a clinician uses". **The lawyer should assess this against the MDR "no thresholds" position.**

## 18. Licences

**Outside MIT, Apache-2.0, BSD and ISC:**
- `@expo-google-fonts/comfortaa` and `/manrope`: "MIT AND OFL-1.1". The bundled TTFs are OFL.
- `@sentry/cli`: FSL-1.1-MIT. Build time only.
- `glob` and `sax`: BlueOak-1.0.0. Build time only.

**Native code with attribution duties:**
- SQLCipher: BSD-style, "reproduce the copyright notice" in binaries.
- OpenSSL on Android: Apache-2.0.
- The Google Sign-In and Play services SDKs.

**No in-app licences screen exists.**

**Fonts:** the app bundles Comfortaa and Manrope (OFL-1.1). The website serves woff2 subsets with `OFL.txt`. **Comfortaa has a Reserved Font Name, and the subset is served under that name.**

**Icons:** 31 PNGs from the design's own SVGs. Provenance is NOT DETERMINABLE FROM CODE.

---

## (a) Risks for a privacy lawyer

1. Appointment titles shown on the lock screen (being fixed).
2. Consent gaps:
   - Health data is pulled to, and readable on, a phone without consent.
   - The baby's profile is uploaded and edited without consent.
   - After withdrawal, a user can't delete entries on the server.
   - The consent text changed without a version bump (bump in progress).
3. Soft-deleted entries keep their full content, including notes, on the server and on every phone for the life of the household.
4. The export:
   - omits deleted entries, although the policy says otherwise;
   - includes other members' user IDs and names;
   - can be run by any role, even signed out;
   - leaves its files in the cache (being fixed).
5. A deleted account's entries stay in shared households under its UUID. Other phones keep their copies after a household is deleted.
6. The 24-month inactivity deletion was missing (being added, without a warning email).
7. Sentry: native crashes and sessions bypass the scrubber, and an install ID is sent.
8. Expo update checks reach a US CDN on every launch (IP and install ID). Device ID is undeclared in the store answers.
9. Factual errors in the privacy policy: "planned" encryption, the export of deleted entries, menu paths, notifications.
10. No Apple token revocation (being added). Deletion by email doesn't work for Hide My Email users. There is no web deletion form.
11. The policy lacks a registration number and address, and the company name is inconsistent.
12. Feedback rows keep `user_id`, which links them to the email.
13. iOS backups hold the encrypted database and the session token. `ITSAppUsesNonExemptEncryption=false` while SQLCipher is used.
14. The weight chart's 90% line and Day 10/14 markers: a medical-device-boundary question.
15. Invite rate limiting is per account only.
16. No open-source acknowledgements screen. The repo `LICENSE` names Expo.

## (b) Questions to answer in a dashboard

- **Supabase:**
  - project region;
  - the DPA copy;
  - whether the pg_cron jobs exist and succeed;
  - the retention of API, auth and Realtime logs and of auth audit IPs;
  - backup and PITR retention (free tier);
  - auth rate limits and OTP expiry;
  - the SMTP sender;
  - whether `push_tokens` is empty;
  - the Apple and Google provider settings;
  - **free-tier project pausing after inactivity.**
- **Sentry:**
  - whether events carry `user.id`, `device.id` or a session `did`;
  - the org region and DPA.
  
  IP storage is off and retention is 30 days, as confirmed.
- **Expo/EAS:**
  - update channel and branch mapping;
  - Expo terms and DPF status;
  - whether expo-dev-client strings are absent from the production build.
- **App Store Connect:** the App Privacy answers as submitted, the export compliance answer, the demo account, the deletion URL.
- **Apple Developer:** a Sign in with Apple key for token revocation, the email relay settings, the push capability.
- **Google Cloud:** the OAuth consent screen and scopes, the client IDs.
- **Google Play Console (Android, later):** the Data safety answers and the deletion URL.
- **Web host:** access-log retention (including `/join/CODE` URLs), whether the `.htaccess` headers apply, which version is deployed.
- **Email provider:** whether `hello@moraki.app` exists and who hosts it, the data region, the retention of support and deletion emails.
