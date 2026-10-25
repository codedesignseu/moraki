# Go-live checklist: from main to the App Store

Status on 2026-10-18:

- **On main:** the redesign, the website v2 and the privacy fixes (#151–#188).
- **Next:** work through the sections below in order.
- **Who does what:** "Owner" means Makis. "Claude" means Claude Code, on the owner's go-ahead.
- **Merges:** merges and the production build need the owner to say so, naming the PR numbers.

## A. Backend (owner, now)

- [ ] **Run `supabase db push` against prod.** It makes the consent version 2026-10-18 and the 24-month inactive-household sweep live (#185). After this, every user is asked to agree again.
- [ ] **Check the cron jobs.** In the Supabase dashboard → Integrations → Cron, these three jobs must exist and succeed:
  - `sweep-old-feedback`
  - `sweep-old-invites`
  - `sweep-inactive-households`
- [ ] **Create the Sign in with Apple key.** Apple Developer → Keys → **+**:
  1. Enable Sign in with Apple for `eu.codedesigns.moraki`.
  2. Download the `.p8` file (you can download it only once).
  3. Note the Key ID.
- [ ] **Set the secrets:** `supabase secrets set APPLE_TEAM_ID=285GZCH8W4 APPLE_CLIENT_ID=eu.codedesigns.moraki APPLE_KEY_ID=<id> APPLE_PRIVATE_KEY="$(cat AuthKey_<id>.p8)"`
- [ ] **Deploy the function:** `supabase functions deploy apple-revoke`. If deleting an account later fails with "Invalid JWT", redeploy with `--no-verify-jwt`. The function checks the session itself.
- [ ] **Recommended: move Supabase to the Pro plan** before launch. Free projects pause when idle, and nothing syncs and no sweep runs while paused. The free plan also has no restorable backups.

- [ ] **Sentry server-side scrubbing.** In Sentry, under Settings → Security & Privacy, turn on **Data Scrubber** and **Use Default Scrubbers**. IP storage is already off. Native crash reports skip the app's own scrubber, so these settings are the only filter they pass (`docs/compliance/processors.md`, Sentry section).

Until the Apple steps are done, an account signed in with Apple can't be deleted on iOS. That would fail App Review.

## B. Website (owner)

- [ ] **App Store badge.** Replace `images/app-store-badge-black.svg` and `-white.svg` with Apple's official artwork from https://developer.apple.com/app-store/marketing/guidelines/. Then bump `?v=1` in the pages (Claude can do this).
- [ ] **Mailbox.** `hello@moraki.app` exists and receives mail. Send it a test message.
- [ ] **Placeholders to fill in.** Send them to Claude, or edit them yourself:
  - Privacy, terms and support: `[Company registration number]`, `[Registered address]`, `[VAT number]`, `[Email provider]`, `[Region]`, in English and Greek.
  - Our story: the publish and update dates.
  - Age guides and FAQ: the "Last updated" dates.
  - Our story: decide on the flagged lines (PR #188).
- [ ] **Upload.** Unzip `moraki-site-upload.zip` into the site's root folder, replacing the old files.
  - Ask Claude to rebuild the zip after any change.
  - It must include `.htaccess` and `.well-known/`.
- [ ] **Check in a browser:**
  - https://moraki.app/ and /el/ load.
  - The menu works on a phone.
  - https://moraki.app/join/K7Q4M2XP shows K7Q4-M2XP.
  - A random URL shows the 404 page.
  - https://moraki.app/.well-known/apple-app-site-association shows JSON.
  - The theme switch survives a reload.
- [ ] **Search engines.** In Google Search Console and Bing Webmaster Tools:
  - verify moraki.app with a DNS TXT record;
  - submit `https://moraki.app/sitemap.xml`.

## C. TestFlight

- [ ] **Owner:** say "start the production build and submit to TestFlight".
- [ ] **Claude:** runs `eas build --profile production --platform ios --auto-submit`. The build reaches TestFlight in about 30 minutes.
- [ ] **Owner, on two iPhones:**
  - [ ] The redesign looks right in day and night, in Greek, and at large text.
  - [ ] Log sheets slide up, and close by swipe and by ×.
  - [ ] The app asks for consent again (the new text).
  - [ ] An appointment reminder shows only "Appointment tomorrow at …".
  - [ ] An invite link opens the app on the second phone. The website must be live first.
  - [ ] Deleting an Apple test account: Apple asks to confirm, then Moraki is gone from that Apple ID's Sign in with Apple list.
  - [ ] Old history survives the encrypted database.
  - [ ] Share PDF works, and Export works.
  - [ ] Reminders arrive on time.
  - [ ] Sign-in works by email code, by Apple and by Google.
- [ ] **Claude** fixes what's found. JavaScript-only fixes ship as an over-the-air update. Anything else needs a new build.

## D. Lawyer (owner)

- [ ] **Send the lawyer:**
  - `docs/compliance/privacy-audit-2026-10-18.md`
  - the privacy and terms pages
  - the consent text (EN and EL, in #185)
  - the Our story lines about other apps
- [ ] **Ask about:**
  - the consent wording;
  - entries kept in shared households after an account is deleted;
  - no warning email before the 24-month deletion;
  - the weight chart's 90% line and Day 10/14 markers (the medical-device boundary);
  - export compliance answered as "exempt";
  - the Comfortaa Reserved Font Name on the subset web font.
- [ ] **Claude applies the lawyer's changes.**
  - If the consent text changes, Claude bumps its version.
  - Claude removes the "draft" banners.
  - Then the website is uploaded again.

## E. App Store Connect (owner; texts in `docs/store/`)

- [ ] **Listing in English and Greek** (`app-store-listing.md`):
  - name, subtitle, promotional text, description, keywords;
  - support, marketing and privacy URLs;
  - copyright "2026 CE Code Designs Ltd".
- [ ] **Screenshots.** Use `~/Downloads/moraki-app-store-screenshots/{en,el}` (1320×2868). Swap any that differ from the TestFlight app. Claude frames real screenshots with `design/app-store-screenshots`.
- [ ] **Age rating** answers.
- [ ] **Price and availability.** Price: free. Availability: Cyprus and Greece first.
- [ ] **App Privacy** (`app-privacy-answers.md`, updated 2026-10-18 with Device ID and Other Diagnostic Data, both not linked).
- [ ] **Export compliance.** "Uses encryption", then "exempt" (`docs/adr/011-sqlcipher.md`).
- [ ] **Review notes:**
  - a demo household and a fresh invite code, made just before submitting;
  - "Sign in with Apple, then Settings → Join household → code";
  - delete the demo household after review.
- [ ] **Submit for review** with manual release. Apple usually takes one to three days.

## F. Launch day

- [ ] Press Release in App Store Connect.
- [ ] Check that the App Store badge on moraki.app opens the listing.
- [ ] For the first days, watch Sentry (crashes) and the `hello@moraki.app` inbox.

## Later (v1.1)

- Android and Google Play (the Data safety answers are in `app-privacy-answers.md`).
- Push notifications.
- Live Activity and widgets.
- Payments.
- A warning email before the 24-month deletion.
- Purging old deleted entries.
- An open-source licences screen.
