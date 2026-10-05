# Release runbook: TestFlight, then the App Store

What the owner runs, in order. Everything here needs your Apple and Expo
accounts; none of it can run from CI yet.

## Once, before the first store build

Status as of 2026-10-05. Done items keep their instructions for the next app.

1. **Done 2026-10-05.** Bundle ID `eu.codedesigns.moraki` registered in the
   Apple Developer portal; it matches `app.json`.
2. **Done 2026-10-05.** App Store Connect app record created (Full Access).
   Its numeric Apple ID goes into `eas.json` as
   `submit.production.ios.ascAppId`; until then `eas submit` asks for it.
3. **Done 2026-10-05.** App Store Connect API key created and added to EAS
   with `eas credentials` → iOS → App Store Connect API Key. The `.p8` is
   not in the repo.
4. **Done 2026-10-05: Expo needs no separate DPA (decision D7).** Expo's terms
   §3.2 make Expo a processor under the EU Standard Contractual Clauses, and
   Expo is certified under the EU-US Data Privacy Framework. Updates go through
   Expo's CDN from this release on.
5. **Hosted Supabase (prod).**
   - **Done.** The Supabase CLI is linked to the **prod** project; the
     staging-or-prod question is closed. `supabase init` is not needed:
     `supabase/config.toml` already exists.
   - **Done.** `supabase db push` reported "Remote database is up to date"
     before #122; every migration was present on Local and Remote.
   - **Open: push again.** #122 (D3) is merged and adds
     `20261005150000_erasure_successor.sql`. Run `supabase db push` against
     prod before the production build.
   - **Done (P2-F5).** Hosted email sign-in: the email provider, URL
     configuration, templates carrying the code, custom SMTP, rate limits,
     and the Apple and Google providers.
   - **Open (P3-F5).** Rotate the publishable key on prod, update
     `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env` and EAS, **before** the
     production build.
   - **Open.** Test deletion on prod with a throwaway account. Cover the
     owner-picks-successor case: a household with a second member, where the
     owner deletes their account and chooses who takes over.
6. **Open.** Create an EU Sentry project, then put its DSN
   (`EXPO_PUBLIC_SENTRY_DSN`) and an auth token (for source maps, P4-F4) into
   `.env` and the EAS `production` environment.
7. **Open.** EAS environment variables for `production`: the same
   `EXPO_PUBLIC_*` values as `preview`, with the rotated key from step 5.
8. **Open.** Deploy `public/` to moraki.app. On 2026-10-05 the live site
   served the 404 page for `/`, `/privacy/`, `/terms/`, `/support/` and the
   Greek pages; only `/.well-known/` was current. App Store Connect needs the
   privacy and support URLs live.

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
