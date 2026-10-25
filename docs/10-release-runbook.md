# Release runbook: TestFlight, then the App Store

What the owner runs, in order. Everything here needs your Apple and Expo
accounts; none of it can run from CI yet.

## Once, before the first store build

Status as of 2026-10-06. Done items keep their instructions for the next app.

1. **Done 2026-10-05.** Bundle ID `eu.codedesigns.moraki` registered in the
   Apple Developer portal; it matches `app.json`.
2. **Done 2026-10-05.** App Store Connect app record created (Full Access).
   Its numeric Apple ID, `6819394944`, is in `eas.json` as
   `submit.production.ios.ascAppId` (2026-10-06), so `eas submit` doesn't ask.
3. **Done 2026-10-05.** App Store Connect API key created and added to EAS
   with `eas credentials` → iOS → App Store Connect API Key. The `.p8` is
   not in the repo.
4. **Done 2026-10-05: Expo needs no separate DPA (decision D7).** Expo's terms
   §3.2 make Expo a processor under the EU Standard Contractual Clauses, and
   Expo is certified under the EU-US Data Privacy Framework. Updates go through
   Expo's CDN from this release on.
5. **Hosted Supabase (prod).** Done 2026-10-05/06.
   - The Supabase CLI is linked to the **prod** project; the staging-or-prod
     question is closed. `supabase init` is not needed: `supabase/config.toml`
     already exists.
   - `supabase migration list` (at `e1733177`) shows all 13 migrations on
     Local and Remote, including `20261005150000_erasure_successor`; prod
     already had them, so `db push` had nothing to apply. The SQL Editor shows
     `delete_account(successor uuid)`, `hand_over_and_leave(h, who, successor)`
     and `leave_household(household_id, successor)`, and no old signatures.
   - Hosted email sign-in (P2-F5): email provider, URL configuration,
     templates carrying the code, custom SMTP, rate limits, and the Apple and
     Google providers.
   - Publishable key rotated and the old key deleted (P3-F5).
     `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
     in the EAS `production` environment.
6. **Sentry.** The EU project exists. `EXPO_PUBLIC_SENTRY_DSN` and
   `EXPO_PUBLIC_SENTRY_ENV` (`production`) are in the EAS `production`
   environment (2026-10-06). Source-map upload is configured (P4-F4): the
   plugin in `app.json` (org `ce-code-designs-ltd`, project `moraki`,
   `https://de.sentry.io/`) and Sentry's Metro config. `SENTRY_AUTH_TOKEN`
   goes into EAS as a **secret** (the owner is adding it). Until it is there,
   the build still succeeds: `SENTRY_ALLOW_FAILURE=true` in `eas.json`'s
   production profile turns a failed upload into a warning, and crash reports
   still arrive, only with minified stack traces. To confirm the token works,
   look in the EAS build log for "Source maps upload" without a
   `SENTRY_ALLOW_FAILURE` warning.
7. **EAS `production` environment, 2026-10-06 evening:** 6 variables. Every
   variable the build reads:

   | Variable                               | Status                          |
   | -------------------------------------- | ------------------------------- |
   | `EXPO_PUBLIC_SUPABASE_URL`             | in EAS                          |
   | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | in EAS (rotated)                |
   | `EXPO_PUBLIC_SENTRY_DSN`               | in EAS                          |
   | `EXPO_PUBLIC_SENTRY_ENV`               | in EAS, `production`            |
   | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`     | in EAS                          |
   | `SENTRY_AUTH_TOKEN`                    | open: owner adding, as a secret |

   Not needed in EAS: `APPLE_TEAM_ID` (nothing in the app or its config reads
   it; EAS takes the team from its credentials), `EXPO_TOKEN` (for the CLI,
   not the build) and `SUPABASE_SECRET_KEY` (server only, **never** in a
   build). The Google iOS client ID isn't a variable either: the app derives
   it from `iosUrlScheme` in `app.json` (P5-F9).

8. **Done 2026-10-06.** `public/` deployed to moraki.app. `/`, `/privacy/`,
   `/terms/`, `/support/` and `/el/` load as real pages, and
   `apple-app-site-association` is reachable (P5-F8).
9. **Google sign-in, outside the repo: done 2026-10-06.** The iOS OAuth
   client in Google Cloud has bundle ID `eu.codedesigns.moraki`, and
   Supabase's Google provider lists both the web and the iOS client IDs.
10. **Working folder clean, 2026-10-06.** The local `ios/` folder from a
    prebuild is deleted, and `/ios` and `/android` are now in `.gitignore` so a
    stray one can't be uploaded to EAS. The `expo run:*` script changes in
    `package.json` are reverted. `public/Archive.zip` is deleted locally and
    from the web host.
11. **Testing on device happens on TestFlight.** There is no local simulator
    testing: Expo Go and the old development builds crash with "Cannot find
    native module 'ExpoUpdates'", which is expected since #117 and #118 added
    native modules, and Xcode isn't used here. The first TestFlight build
    covers the deletion test on prod (including owner-picks-successor), the
    history surviving the SQLCipher conversion, PDF sharing, and the invite
    link.

## Each TestFlight build

```sh
eas build --platform ios --profile production
eas submit --platform ios --latest
```

`eas submit` asks for the app's Apple ID the first time. Once you have it, add
it to `eas.json` under `submit.production.ios.ascAppId` (it's a public number,
not a secret), and later submits stop asking.

The build number goes up by itself (`autoIncrement`, with the version kept on
EAS's side). The marketing version is `version` in `app.json`.

### Checking that crash reports are readable (P4-F4)

Each new build should send one test error, so you know its source maps were
uploaded:

1. In the TestFlight build, open **Settings** and scroll to the bottom.
2. Tap **Version x.y.z** seven times. A card asks "Send a test error to
   Sentry?". Tap **Send test error to Sentry**.
3. A toast says "Test error sent to Sentry." If it says crash reporting is off,
   the build has no `EXPO_PUBLIC_SENTRY_DSN`. Check the EAS `production`
   environment and build again.
4. In Sentry (`https://de.sentry.io/`, org `ce-code-designs-ltd`, project
   `moraki`), open the newest issue, **SentryTestError: Moraki Sentry test
   error, sent on purpose from Settings**. The top stack frames should name
   `src/observability/testError.ts` and `src/features/settings/useSentryTest.ts`
   with line numbers. If the frames show `main.jsbundle` or bundle offsets
   instead, the upload failed: look in the EAS build log for "Source maps
   upload" and a `SENTRY_ALLOW_FAILURE` warning (usually a missing or wrong
   `SENTRY_AUTH_TOKEN`).
5. Check the event carries nothing personal: no user, no IP address, no
   breadcrumbs with entries. `scrubEvent` keeps only the stack trace and the
   build's details.
6. Resolve the issue in Sentry, so the next build's test shows up as new.

## Shipping a JavaScript-only fix

```sh
eas update --channel production --message "what changed"
```

Phones on the same `version` pick it up on their next launch. Anything that adds
or changes a native module (a new `expo-*` package, an `app.json` plugin) needs
a new build instead. `runtimeVersion` follows `version`, so bump `version` with
every new build that changes native code, and an update never reaches a binary
that can't run it.

Channels: `development`, `preview` and `production`, one per build profile in
`eas.json`.

## Sign in with Apple token revocation

App Store guideline 5.1.1(v): an app that offers Sign in with Apple must revoke
the person's Apple tokens when they delete their account. Supabase keeps no
Apple refresh token after `signInWithIdToken`, so the app gets a fresh one at
deletion time:

1. Settings → Leave or delete → Delete account → "Yes, delete my account".
2. If the account is linked to Apple and the phone is an iPhone, Apple's sheet
   asks the person to confirm (no scopes, so it asks for nothing new). The app
   gets a one-time `authorizationCode`, valid for five minutes.
3. The app sends the code to the `apple-revoke` Edge Function with the
   person's Supabase session. The function checks the session
   (`auth.getUser`), signs a five-minute ES256 client secret with the Sign in
   with Apple key, exchanges the code at `https://appleid.apple.com/auth/token`
   and revokes the refresh token (or the access token, if Apple returns no
   refresh token) at `https://appleid.apple.com/auth/revoke`.
4. Only after `{ revoked: true }` does the app call `delete_account`.

If the person closes Apple's sheet, or the revoke fails (offline, Apple down,
secrets missing), **nothing is deleted** and the screen says so; they can try
again. Deleting without revoking would leave the app listed under the person's
Apple ID with no way for them to trigger the revoke later, because the account
it belongs to is gone. The flip side: until the secrets below are set and the
function is deployed, an Apple-linked account cannot be deleted on iOS, so
this is a **release blocker**.

Off iOS (Android is v1.1; there is no web app) Apple's native sheet doesn't
exist, so an Apple-linked account is deleted without revoking. Known
limitation: the person can remove Moraki at appleid.apple.com → Sign-In and
Security → Sign in with Apple. Nothing is logged in either case.

The function logs only a failure code (`invalid_code`, `apple_rejected`,
`apple_unreachable`, `not_configured`), never the code, Apple's tokens, the key
or an email. Source: `supabase/functions/apple-revoke/` (`apple.ts` is the
tested logic, `index.ts` the Deno entry point). No new processor: Apple is
already listed as an independent controller for sign in, and the function runs
on Supabase.

### Owner steps, once

1. **Create the key.** Apple Developer → Certificates, Identifiers & Profiles →
   Keys → **+**. Name it e.g. "Moraki Sign in with Apple", tick **Sign in with
   Apple**, Configure → primary App ID **eu.codedesigns.moraki** → Save →
   Continue → Register. **Download the `.p8` file** (Apple lets you download
   it once only) and note the **Key ID** shown on the page. Keep the `.p8`
   out of the repo, e.g. in your password manager.
2. **Set the secrets** on the hosted project (from the repo root, logged in
   with `supabase login` and linked with `supabase link`):

   ```sh
   supabase secrets set \
     APPLE_TEAM_ID=285GZCH8W4 \
     APPLE_CLIENT_ID=eu.codedesigns.moraki \
     APPLE_KEY_ID=<the Key ID from step 1> \
     APPLE_PRIVATE_KEY="$(cat ~/path/to/AuthKey_<KEYID>.p8)"
   ```

   `supabase secrets list` shows the names (not values) afterwards.

3. **Deploy the function:**

   ```sh
   supabase functions deploy apple-revoke
   ```

   Edge Functions are included in the free tier. The gateway's JWT check is
   left on (the default). If the app's call is refused with 401 "Invalid JWT"
   because the project signs sessions with the newer asymmetric JWT keys,
   redeploy with `--no-verify-jwt`: the function checks the session itself
   with `auth.getUser` and refuses anyone without one.

### How to test

1. Without a session the function refuses:
   `curl -i -X POST https://<project-ref>.supabase.co/functions/v1/apple-revoke`
   answers 401.
2. On a TestFlight build, sign in with Apple using a throwaway Apple ID (or
   your own, on a test account), then Settings → Leave or delete → Delete
   account → confirm. Apple's sheet appears; confirm with Face ID. The account
   is deleted and the phone signs out.
3. On the iPhone: Settings → [your name] → Sign-In & Security → Sign in with
   Apple. Moraki is no longer listed (it may take a minute). Apple also emails
   the Apple ID that the app was disconnected.
4. Cancel case: repeat with another test account, close Apple's sheet; the
   screen says nothing was deleted, and the account is still there.
5. Logs: Supabase dashboard → Edge Functions → apple-revoke → Logs show only
   a failure code, if anything.

## Inactivity warning emails (Brevo)

A household nobody has used for 24 months is deleted
(`docs/compliance/retention.md`). Since 2026-10-24 every member is emailed a
warning first, and nothing is deleted until that email has gone out:

1. **02:47 UTC**, `warn-inactive-households`: a household unused for 23 months
   gets `inactivity_warned_at` and one queued email per member. A household
   used again after its warning has the warning cleared.
2. **02:53 UTC**, `send-inactivity-warnings`: `request_inactivity_warnings()`
   posts to the `send-inactivity-warnings` Edge Function through `pg_net`,
   with a shared secret header. The function claims the queue
   (`claim_inactivity_warnings`, service role only) and sends each email
   through Brevo from `hello@moraki.app`, in English and Greek, naming the
   deletion date: 31 days after sending.
3. **03:31 UTC**, `sweep-inactive-households`: deletes a household only if it
   has been unused for 24 months, its warning is at least 30 days old, nobody
   used it since, and every member's email was sent with a date that has come.

Each email is claimed before it is sent and never handed out again, so nobody
gets the same warning twice. One Brevo refused is retried the next day, and
its household is kept until it goes. The function logs counts and error codes
(`brevo_rejected`, `brevo_unauthorized`, `brevo_rate_limited`,
`brevo_unavailable`, `brevo_unreachable`), never an address or the text.
Source: `supabase/functions/send-inactivity-warnings/` (`warning.ts` is the
tested logic, `index.ts` the Deno entry) and
`supabase/migrations/20261024180000_inactivity_warning.sql`.

**Until the steps below are done, no email is sent and so no household is
deleted.** Warnings still queue up and go out once they are.

### Owner steps, once

1. **Brevo account and API key.** Sign up at brevo.com with the company
   (C.E. CODE DESIGNS LTD), accept the DPA, then SMTP & API → API keys →
   Generate a new API key, e.g. "moraki-supabase". Copy it once into your
   password manager. (secret)
2. **Verify the sender domain.** Brevo → Senders, Domains & Dedicated IPs →
   Domains → Add `moraki.app`. Brevo shows DNS records: a TXT `brevo-code`, a
   DKIM record, and an SPF include (`include:spf.brevo.com`) plus a DMARC
   record if there is none. Add them at Cloudflare (DNS for `moraki.app`),
   with the DKIM CNAMEs set to **DNS only** (grey cloud), never proxied. An SPF
   TXT already exists: `v=spf1 mx ip4:185.146.22.242 include:spf.a2hosting.com include:spf.brevo.com ~all`.
   If `include:spf.brevo.com` is ever missing, add it to that one record
   rather than creating a second. Then Senders → add
   `hello@moraki.app`, name "Moraki", and confirm it.
3. **Apple private relay.** People who signed in with Apple and hid their
   address only get mail from registered senders. Apple Developer →
   Certificates, Identifiers & Profiles → Services → **Sign in with Apple for
   Email Communication** → Configure → add the domain `moraki.app` and the
   address `hello@moraki.app`. It must pass SPF (step 2 first).
4. **Secrets on the hosted project** (repo root, after `supabase login` and
   `supabase link`). Make the cron secret a long random string, e.g.
   `openssl rand -hex 32`, and keep it for step 6:

   ```sh
   supabase secrets set \
     BREVO_API_KEY=<the key from step 1> \
     INACTIVITY_WARNINGS_CRON_SECRET=<the random string>
   ```

5. **Deploy the function:**

   ```sh
   supabase db push   # the migration, if not pushed yet
   supabase functions deploy send-inactivity-warnings
   ```

   `supabase/config.toml` turns the gateway's JWT check off for this one
   function; it checks the shared secret itself and refuses anything else.

6. **Tell pg_cron where the function is.** Supabase dashboard → SQL Editor,
   once (Supabase's documented pattern for cron calling an Edge Function:
   the URL and secret live in Vault, not in a migration):

   ```sql
   select vault.create_secret(
     'https://tjcahnjpbkgrjytrazfs.supabase.co/functions/v1/send-inactivity-warnings',
     'inactivity_warnings_function_url');
   select vault.create_secret('<the same random string as step 4>',
     'inactivity_warnings_cron_secret');
   ```

   To change either later: `select vault.update_secret(id, '<new value>')`
   with the id from `select id, name from vault.secrets`.

7. **Check the jobs.** Dashboard → Integrations → Cron:
   `warn-inactive-households` (02:47) and `send-inactivity-warnings` (02:53)
   are listed next to the three sweeps.

### How to test

Never on a real family's household. On a staging project, or on prod with a
throwaway household whose only member is an account you own:

1. Without the secret the function refuses:
   `curl -i -X POST https://tjcahnjpbkgrjytrazfs.supabase.co/functions/v1/send-inactivity-warnings`
   answers 401.
2. Make the test household look idle and warn it (SQL Editor; `<id>` is the
   household id from `select id, name from households where name = '…'`):

   ```sql
   -- Only a test household: this is what a household unused for 23 months looks like.
   insert into public.inactivity_warning_emails (household_id, user_id, warned_at)
   select household_id, user_id, now() from public.memberships where household_id = '<id>';
   update public.households set inactivity_warned_at = now() where id = '<id>';
   select public.request_inactivity_warnings();
   ```

   (Don't call `warn_inactive_households()` for this: it would warn every
   household that really is idle.)

3. Within a minute the test account's inbox has the email, in English and
   Greek, from Moraki `<hello@moraki.app>`, with a date 31 days away. Brevo →
   Transactional → Logs shows it delivered.
4. Edge Functions → send-inactivity-warnings → Logs shows
   `{"sent":1,"failed":0,...}` and no address.
5. Open the app with the test account. The next 02:47 run clears the warning
   (`inactivity_warned_at` back to null). Or delete the test household.

## Submitting for review

1. Store listing and privacy answers: `docs/store/` (P5-06).
2. Screenshots: 6.9" iPhone, taken on a device.
3. Export compliance: see `docs/adr/011-sqlcipher.md`.
4. **Review sign-in.** Sign-in is by emailed code, which App Review can't
   read. Nothing in the code needs to change, because:
   - the app works fully without an account, offline, on one phone;
   - **Sign in with Apple** lets the reviewer sign in with their own Apple ID,
     with no inbox involved.

   For the shared-household features, seed a demo household on prod owned by
   a review account you control, and put a fresh **invite code** (valid 7
   days, single use) in the review notes: "Sign in with Apple, then Settings →
   Join with a code → `XXXXXXXX`". Make the code shortly before submitting,
   and delete the household after review. No credentials leave your inbox.

5. **Account deletion with Apple** works on the build (see "Sign in with Apple
   token revocation" above): the `apple-revoke` secrets are set and the
   function is deployed.
6. **Open.** Screenshots, age rating, the demo household and invite code
   above, and the lawyer's review of the privacy policy, terms and DPIA.
