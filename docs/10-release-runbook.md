# Release runbook: TestFlight, then the App Store

What the owner runs, in order. Everything here needs your Apple and Expo
accounts; none of it can run from CI yet.

## Once, before the first store build

1. **App Store Connect → My Apps → +.** Bundle ID `eu.codedesigns.moraki`,
   SKU `moraki`, primary language English. Note the numeric **Apple ID**
   App Store Connect shows for the app.
2. **App Store Connect → Users and Access → Integrations → App Store Connect
   API → +** (role App Manager). Download the `.p8` once. Put it outside the
   repo, and run `eas credentials` → iOS → App Store Connect API Key, so EAS
   holds it rather than a file in the working tree.
3. **expo.dev → Account settings → accept Expo's DPA**
   (`docs/compliance/processors.md`, Expo row). Updates go through Expo's CDN
   from this release on.
4. **Hosted Supabase:** apply the migrations (`supabase db push` against the
   linked project), then check P2-F5's auth email settings.
5. **EAS environment variables** for the `production` environment: the same
   `EXPO_PUBLIC_*` values as `preview`, plus `EXPO_PUBLIC_SENTRY_DSN` once the
   EU Sentry project exists.

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
4. Review notes: a demo account. Use a real account on the hosted project, with
   a seeded household, that you can delete after review.
