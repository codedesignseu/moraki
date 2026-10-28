# Go-live checklist: from main to the App Store

Status on 2026-10-28:

- **Submitted:** build 12 (commit 048fec97) went to App Review on 2026-10-28 with manual release. Sections A to E are done.
- **On main, not in build 12:** #232, joining by a typed code without the link. It ships as an over-the-air update after release, then in build 13.
- **Legal:** the lawyer's final texts are live on moraki.app (#228, #230, #231).
- **Next:** section F, then G.
- **Who does what:** "Owner" means Makis. "Claude" means Claude Code, on the owner's go-ahead.
- **Merges:** merges and the production build need the owner to say so, naming the PR numbers.

## A. Backend (owner, now)

- [x] **Run `supabase db push` against prod.** It makes the consent version 2026-10-18 and the 24-month inactive-household sweep live (#185). After this, every user is asked to agree again.
- [x] **Check the cron jobs.** In the Supabase dashboard → Integrations → Cron, these jobs must exist and succeed:
  - `sweep-old-feedback`
  - `sweep-old-invites`
  - `sweep-inactive-households`
  - and, since build 7: `warn-inactive-households` (02:47), `warn-frozen-households` (02:50), `send-inactivity-warnings` (02:53), `sweep-frozen-households` (03:35), `purge-deleted-event-content` (03:41), `purge-old-consent-records` (03:47), `purge-erasure-log` (03:53)
  - and, since the erasure journal (2026-10-26): `send-erasure-journal` (04:05)
- [x] **Create the Sign in with Apple key.** Apple Developer → Keys → **+**:
  1. Enable Sign in with Apple for `eu.codedesigns.moraki`.
  2. Download the `.p8` file (you can download it only once).
  3. Note the Key ID.
- [x] **Set the secrets:** `supabase secrets set APPLE_TEAM_ID=285GZCH8W4 APPLE_CLIENT_ID=eu.codedesigns.moraki APPLE_KEY_ID=<id> APPLE_PRIVATE_KEY="$(cat AuthKey_<id>.p8)"`
- [x] **Deploy the function:** `supabase functions deploy apple-revoke`. If deleting an account later fails with "Invalid JWT", redeploy with `--no-verify-jwt`. The function checks the session itself.
- [x] **Inactivity warning emails (Brevo).** Steps in `docs/10-release-runbook.md`, "Inactivity warning emails (Brevo)". Until they are done no warning goes out, and so no inactive household is deleted.
  1. Brevo account, DPA, and an API key.
  2. Verify `moraki.app` in Brevo (SPF, DKIM, DMARC records at Cloudflare) and add the sender `hello@moraki.app`.
  3. Apple Developer → Sign in with Apple for Email Communication: register `moraki.app` and `hello@moraki.app`.
  4. `supabase secrets set BREVO_API_KEY=… INACTIVITY_WARNINGS_CRON_SECRET=…`
  5. `supabase functions deploy send-inactivity-warnings`
  6. The two `vault.create_secret` lines in the SQL Editor.
  7. Test with a throwaway household; check the cron jobs `warn-inactive-households`, `warn-frozen-households` and `send-inactivity-warnings`.
  8. After the frozen-household change (2026-10-25): `supabase db push`, then `supabase functions deploy send-inactivity-warnings` again, in that order.
- [x] **Erasure journal email** (owner decision 2026-10-26). Steps in `docs/10-release-runbook.md`, "Erasure journal email". Until they are done no journal is sent.
  1. `supabase secrets set ERASURE_JOURNAL_TO=hello@moraki.app ERASURE_JOURNAL_CRON_SECRET=…`
  2. `supabase db push`, then `supabase functions deploy send-erasure-journal`
  3. The two `vault.create_secret` lines (`erasure_journal_function_url`, `erasure_journal_cron_secret`) in the SQL Editor.
  4. Check the cron job `send-erasure-journal` (04:05), and keep the journal emails in their own folder for at least 35 days.
- [x] **Upgrade Supabase to the Pro plan before launch** (owner decision 2026-10-24). On Pro the project never pauses, so sync and the cleanup jobs keep running, and daily backups are kept for 7 days. Point-in-time recovery is a paid add-on and is not enabled. After upgrading, check Database → Backups.

- [x] **Sentry server-side scrubbing.** In Sentry, under Settings → Security & Privacy, turn on **Data Scrubber** and **Use Default Scrubbers**. IP storage is already off. Native crash reports skip the app's own scrubber, so these settings are the only filter they pass (`docs/compliance/processors.md`, Sentry section).

Until the Apple steps are done, an account signed in with Apple can't be deleted on iOS. That would fail App Review.

## B. Website (owner)

- [x] **App Store badge.** Replace `images/app-store-badge-black.svg` and `-white.svg` with Apple's official artwork from https://developer.apple.com/app-store/marketing/guidelines/. Then bump `?v=1` in the pages (Claude can do this).
- [x] **Mailbox.** `hello@moraki.app` exists and receives mail. Send it a test message.
- [x] **Placeholders to fill in.** Send them to Claude, or edit them yourself:
  - Privacy, terms and support: `[Company registration number]`, `[Registered address]`, `[VAT number]`, `[Email provider]`, `[Region]`, in English and Greek.
  - Our story: the publish and update dates.
  - Age guides and FAQ: the "Last updated" dates.
  - Our story: decide on the flagged lines (PR #188).
- [x] **Upload.** Unzip `moraki-site-upload.zip` into the site's root folder, replacing the old files.
  - Ask Claude to rebuild the zip after any change.
  - It must include `.htaccess` and `.well-known/`.
- [x] **Check in a browser:**
  - https://moraki.app/ and /el/ load.
  - The menu works on a phone.
  - https://moraki.app/join/K7Q4M2XP shows K7Q4-M2XP.
  - A random URL shows the 404 page.
  - https://moraki.app/.well-known/apple-app-site-association shows JSON.
  - The theme switch survives a reload.
- [x] **Search engines.** In Google Search Console and Bing Webmaster Tools:
  - verify moraki.app with a DNS TXT record;
  - submit `https://moraki.app/sitemap.xml`.

## C. TestFlight

- [x] **Owner:** say "start the production build and submit to TestFlight".
- [x] **Claude:** runs `eas build --profile production --platform ios --auto-submit`. The build reaches TestFlight in about 30 minutes.
- [x] **Owner, on two iPhones:**
  - [x] The redesign looks right in day and night, in Greek, and at large text.
  - [x] Log sheets slide up, and close by swipe and by ×.
  - [x] The app asks for consent again (the new text).
  - [x] An appointment reminder shows only "Appointment tomorrow at …".
  - [x] An invite link opens the app on the second phone. The website must be live first.
  - [x] Deleting an Apple test account: Apple asks to confirm, then Moraki is gone from that Apple ID's Sign in with Apple list.
  - [x] Old history survives the encrypted database.
  - [x] Share PDF works, and Export works.
  - [x] Reminders arrive on time.
  - [x] Sign-in works by email code, by Apple and by Google.
- [x] **Claude** fixes what's found. JavaScript-only fixes ship as an over-the-air update. Anything else needs a new build.

## D. Lawyer (owner)

- [x] **Send the lawyer:**
  - `docs/compliance/privacy-audit-2026-10-18.md`
  - the privacy and terms pages
  - the consent text (EN and EL, in #185)
  - the Our story lines about other apps
- [x] **Ask about:**
  - the consent wording;
  - entries kept in shared households after an account is deleted;
  - the warning email before the 24-month deletion: the privacy policy must mention it and add Brevo as a processor;
  - the weight chart's 90% line and Day 10/14 markers (the medical-device boundary);
  - export compliance answered as "exempt";
  - the Comfortaa Reserved Font Name on the subset web font.
- [x] **Claude applies the lawyer's changes.**
  - If the consent text changes, Claude bumps its version.
  - Claude removes the "draft" banners.
  - Then the website is uploaded again.

## E. App Store Connect (owner; texts in `docs/store/`)

- [x] **Listing in English and Greek** (`app-store-listing.md`):
  - name, subtitle, promotional text, description, keywords;
  - support, marketing and privacy URLs;
  - copyright "2026 CE Code Designs Ltd".
- [x] **Screenshots.** App Store Connect asked for the 6.3" size, so `~/Downloads/moraki-app-store-screenshots-6.3in/{en,el}` (1206×2622) were uploaded. The 1320×2868 originals are in `~/Downloads/moraki-app-store-screenshots/`. Swap any that differ from the TestFlight app. Claude frames real screenshots with `design/app-store-screenshots`.
- [x] **Age rating** answers.
- [x] **Price and availability.** Price: free. Availability: Cyprus and Greece first.
- [x] **App Privacy** (`app-privacy-answers.md`, updated 2026-10-18 with Device ID and Other Diagnostic Data, both not linked).
- [x] **Export compliance.** `ITSAppUsesNonExemptEncryption` is false, so no documentation is uploaded (`docs/adr/011-sqlcipher.md`).
- [x] **Digital Services Act** trader details, and **Regulated Medical Device** declared "No" (2026-10-28).
- [x] **Review notes:**
  - a demo household and a fresh invite code, made just before submitting;
  - "Sign in with Apple, then Settings → Join household → code";
  - keep the demo household for later reviews (owner, 2026-10-28). Notes: `~/Downloads/moraki-review-notes.txt`, which also gives the `moraki.app/join/CODE` link.
- [x] **Submit for review** with manual release. Apple usually takes one to three days.

## F. Launch day

- [ ] Apple approves (status "Pending Developer Release"). If rejected, the Resolution Center message goes to Claude.
- [ ] If still waiting after 5 days: make a fresh invite code and update the review notes. Codes expire after 7 days.
- [ ] Press Release in App Store Connect.
- [ ] **Claude**, on "publish the join fix": `eas update --branch production --message "Join by code without the link (#232)"`.
- [ ] Check that the App Store badge on moraki.app opens the listing.
- [ ] For the first days, watch Sentry (crashes) and the `hello@moraki.app` inbox.

## G. After launch

- [ ] Google Search Console and Bing Webmaster Tools: verify moraki.app with a DNS TXT record in Cloudflare, and submit `https://moraki.app/sitemap.xml`.
- [ ] **Build 13** after the EAS free-plan iOS build allowance resets on 2026-11-01. Pull main into `~/Projects/moraki` first, and check that `eas build:list` shows the build's commit equal to origin/main (build 11 was made from a stale checkout).
- [ ] **Alerts (owner, 5 minutes).** Sentry → Alerts → Create Alert → Issues: "a new issue is created", and "more than 20 events in an issue in 1 hour", both emailing the owner. Supabase → Organization → Billing: spend and usage notifications on.
- [ ] **Claude:** the daily health email and the monitoring runbook (TASKS L-F5, L-F6).
- [ ] The owner's list of flow improvements.
- [ ] Add a `.easignore`: the upload archive is 238 MB, mostly the untracked `design/` folders.

## Later (v1.1)

- Android and Google Play (the Data safety answers are in `app-privacy-answers.md`).
- Push notifications.
- Live Activity and widgets.
- Payments.
- Purging old deleted entries.
- An open-source licences screen.
