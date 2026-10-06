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

5. **Open.** Screenshots, age rating, the demo household and invite code
   above, and the lawyer's review of the privacy policy, terms and DPIA.
