# Universal links: making `https://moraki.app/join/CODE` open the app

**Task:** P2-F6. **Both platforms configured:** 2026-09-26. **Outstanding:**
hosting the two files on `moraki.app`, and the tap test on each phone.

An invite link is how a second caregiver gets in (P2-06). The app has had the
`/join/[code]` route since then, but nothing told a phone to open Moraki for
that address, so tapping it opened a browser and the shared message's manual
code was the only way through.

Three things have to agree, and nothing at runtime checks that they do:

| Where                 | What it says                                            |
| --------------------- | ------------------------------------------------------- |
| `src/sync/invites.ts` | the link the app builds: `https://moraki.app/join/CODE` |
| `app.json`            | the domain each platform claims                         |
| `moraki.app`          | the file that lets the domain confirm the claim         |

`src/sync/universalLinks.test.ts` holds the first two together on every run — a
renamed bundle id, a changed path or a stray `?mode=developer` fails the suite.
The third is a hosting step, and only a device can prove it.

---

## What is in the repository

- `public/.well-known/apple-app-site-association` — the iOS file, with the real
  Team ID and `eu.codedesigns.moraki`, claiming `/join/*`. No file extension, by
  Apple's rule.
- `app.json` → `ios.associatedDomains: ["applinks:moraki.app"]`.
- `public/.well-known/assetlinks.json` — the Android file, granting
  `eu.codedesigns.moraki` the right to handle these URLs, with the EAS signing
  certificate's SHA-256 fingerprint.
- `app.json` → `android.intentFilters`, one `VIEW` filter for
  `https://moraki.app/join` with `autoVerify: true`.

`public/` is Expo's own convention for files copied verbatim into a web export,
so the path in the repository is the path on the domain. `public/_headers` sets
`Content-Type: application/json` on both files, which is what Cloudflare Pages
and Netlify read.

---

## Your steps, in order

### 1. Point the domain somewhere that can serve a file

As of 2026-09-26 `moraki.app` is still parked at GoDaddy, so there is nothing
to serve the association file. It needs a static host with HTTPS on the apex
domain. GitHub Pages is out: this repository is private on the Free plan.

**Cloudflare Pages** fits with the least moving parts — free, serves the apex
directly, deploys from a private repository, and reads the `public/_headers`
file committed here:

1. Cloudflare → **Add a site** → `moraki.app` → follow it to the two nameservers it gives you.
2. GoDaddy → **My Products** → `moraki.app` → **DNS** → **Nameservers** → **Change** → **I'll use my own nameservers** → paste Cloudflare's two. Propagation is usually minutes, up to a few hours.
3. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → this repository.
4. **Build command: leave empty. Build output directory: `public`.** Nothing of the app is published this way — `public/` holds the two association files and `_headers`, nothing else.
5. **Custom domains** → add `moraki.app` (and `www.moraki.app` only if you want the redirect; see the redirect warning below).

Netlify works the same way (`_headers` included) if you would rather point A
records at a host than move nameservers.

### 2. Check what the domain actually serves

The committed file has to answer at exactly:

```
https://moraki.app/.well-known/apple-app-site-association
```

Requirements Apple enforces, each of which silently breaks the link if missed:

- **HTTPS**, with a certificate that validates.
- **`Content-Type: application/json`** — a `text/plain` or `application/octet-stream` answer is rejected.
- **No redirect.** Not even `http` → `https`, and not `moraki.app` → `www.moraki.app`. If the domain redirects to `www`, claim `applinks:www.moraki.app` as well and serve the file on both.
- **No authentication**, no Cloudflare "Under Attack" challenge, no geo-block.
- **No extension** on the filename.

Check it from anywhere before touching a phone:

```bash
curl -sSI https://moraki.app/.well-known/apple-app-site-association | head -5
curl -sS  https://moraki.app/.well-known/apple-app-site-association | python3 -m json.tool
```

The first must show `200` and `content-type: application/json`, with no
`location:` header. The second must print the JSON rather than an error.

Then confirm Apple's CDN has fetched it — this is the copy the phone actually
reads, and it lags your deploy by minutes to hours:

```bash
curl -sS "https://app-site-association.cdn-apple.com/a/v1/moraki.app" | python3 -m json.tool
```

### 3. Build and install an iOS development build

`associatedDomains` is a native entitlement, so Expo Go cannot test it and
neither can the existing builds.

```bash
eas build --platform ios --profile development
```

Apple login is interactive the first time. **Commit `app.json` first** — EAS
archives the committed state, so an uncommitted change is not in the build.

The **Apple ID** prompt wants the email address the developer account is
registered to. It is not the Team ID: a Team ID is ten characters
(`285GZCH8W4`), an Apple ID is an email. EAS caches whatever is typed there in
the macOS keychain and reuses it silently on the next run, so a wrong entry
repeats itself — and repeated failed sign-ins are what locks an Apple Account
(`Apple Service Error -20209`).

Recovering from that:

1. Unlock the account at <https://iforgot.apple.com>, then sign in once at <https://appleid.apple.com> and at <https://developer.apple.com/account> to clear any pending agreement or verification step. EAS cannot get past either.
2. Delete the cached credential: **Keychain Access** → search the wrong value (for example the Team ID) and also `deliver` and `idmsa.apple.com` → delete the matching entries. Otherwise the next `eas build` reuses it without asking.
3. Run the build again and enter the email address at the Apple ID prompt.

An App Store Connect API key does not avoid this for a first build. The key
authenticates App Store Connect operations — `eas submit`, and repairing or
re-signing credentials in CI, through `EXPO_ASC_API_KEY_PATH`,
`EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID` and
`EXPO_APPLE_TEAM_TYPE` — but creating the distribution certificate and
provisioning profile the first time still goes through an Apple ID session.

### 4. Tap a real link on the phone

With the build installed and signed in as a household owner:

1. Settings → **Invite a caregiver** → create an invite → **Share link**.
2. Send the link to the iPhone in a way that renders it as a link — Messages, Notes or Mail. **Not Safari's address bar**: typing a claimed URL there deliberately stays in the browser, and pasting into Safari is the single most common false failure.
3. Tap it. Moraki must open on the join screen with the code already filled in.
4. Record the result in `docs/TASKS.md` under "Waiting on device".

If it opens Safari instead, in this order:

- Re-check the CDN URL in step 2 — an unfetched or malformed file is the usual cause.
- Delete and reinstall the app: the entitlement is read at install time.
- Only for local debugging, change `app.json` to `applinks:moraki.app?mode=developer` and rebuild. That bypasses Apple's CDN and reads your server directly. **It must never ship** — `universalLinks.test.ts` fails if it is still there at commit time.

### 5. The same on Android

`assetlinks.json` is served from the same place, with the same rules. Its
extension means hosts usually get the content type right on their own, and
`public/_headers` states it regardless.

`autoVerify: true` makes Android fetch the file **at install time**. So:

```bash
eas build --platform android --profile development
```

A new build is needed — the intent filter is in the manifest, not the JS — and
then the same tap test as step 4, opening the link from a chat or a note rather
than typing it into Chrome's address bar.

If it opens the browser instead, Android will say why:

```bash
adb shell pm get-app-links eu.codedesigns.moraki
```

`verified` is the goal. `legacy_failure` or `1024` means it could not fetch or
parse the file. A reinstall re-runs verification, and so does:

```bash
adb shell pm verify-app-links --re-verify eu.codedesigns.moraki
```

### Before the Play Store release: a second fingerprint

**The fingerprint in `assetlinks.json` today is the EAS keystore's.** If Play
App Signing is used — it is the default for a new app — Google re-signs the
upload with **its own** key, so an app installed from the Play Store presents a
different certificate, verification fails against this file, and every invite
link silently opens a browser for real users while working perfectly in
testing.

The fix is to list both: Play Console → **Setup** → **App signing** → copy the
**SHA-256 certificate fingerprint** under _App signing key certificate_, and add
it to `sha256_cert_fingerprints` beside the existing one. `assetlinks.json`
takes an array precisely for this. Tracked as P2-F13 on the board, due with
P4-12.

---

## What stays true either way

The manual code path never goes away. A link can fail for reasons no app
controls — a mail client rewriting URLs for click tracking, a corporate proxy,
a phone with the app not yet installed — so the share message carries the code
as well, and the join screen accepts it typed (P2-06).
