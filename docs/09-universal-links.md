# Universal links: making `https://moraki.app/join/CODE` open the app

**Task:** P2-F6. **iOS half done:** 2026-09-26. **Android half:** waiting on the
signing certificate's SHA-256 fingerprint.

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
- `public/.well-known/assetlinks.json` — **not written yet.** It needs the
  Android signing certificate's SHA-256 fingerprint.

`public/` is Expo's own convention for files copied verbatim into a web export,
so the path in the repository is the path on the domain.

---

## Your steps, in order

### 1. Host the iOS file

Serve the committed file at exactly:

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

### 2. Build and install an iOS development build

`associatedDomains` is a native entitlement, so Expo Go cannot test it and
neither can the existing builds.

```bash
eas build --platform ios --profile development
```

Apple login is interactive the first time. **Commit `app.json` first** — EAS
archives the committed state, so an uncommitted change is not in the build.

### 3. Tap a real link on the phone

With the build installed and signed in as a household owner:

1. Settings → **Invite a caregiver** → create an invite → **Share link**.
2. Send the link to the iPhone in a way that renders it as a link — Messages, Notes or Mail. **Not Safari's address bar**: typing a claimed URL there deliberately stays in the browser, and pasting into Safari is the single most common false failure.
3. Tap it. Moraki must open on the join screen with the code already filled in.
4. Record the result in `docs/TASKS.md` under "Waiting on device".

If it opens Safari instead, in this order:

- Re-check the CDN URL in step 1 — an unfetched or malformed file is the usual cause.
- Delete and reinstall the app: the entitlement is read at install time.
- Only for local debugging, change `app.json` to `applinks:moraki.app?mode=developer` and rebuild. That bypasses Apple's CDN and reads your server directly. **It must never ship** — `universalLinks.test.ts` fails if it is still there at commit time.

### 4. When you have the Android fingerprint

```bash
eas credentials -p android
```

Pick the build profile, read `SHA256 Fingerprint` off the keystore entry, and
hand it over. It is public — it ships in `assetlinks.json` on the domain — so
there is nothing to protect. Then the Android half is:

- `public/.well-known/assetlinks.json`, served the same way as the iOS file.
- `app.json` → `android.intentFilters` with `autoVerify: true` for `https://moraki.app/join`.
- A new development build, and the same tap test on the Android phone.

---

## What stays true either way

The manual code path never goes away. A link can fail for reasons no app
controls — a mail client rewriting URLs for click tracking, a corporate proxy,
a phone with the app not yet installed — so the share message carries the code
as well, and the join screen accepts it typed (P2-06).
