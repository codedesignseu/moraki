# Moraki: App Store release progress (Makis's manual steps)

Last updated: 2026-10-08 (TestFlight build 2 findings added). Earlier: 2026-10-05 (evening, Cyprus time). Source: Makis confirmed each item in chat.
Reference: docs/10-release-runbook.md in the repo (not read in this session, so steps below follow the report from the code session).

## Done (confirmed by Makis)

### Code

- PRs #113, #114, #120 (replaces #116), #115, #119, #117, #118 merged into main. #121, #123, #124 merged.

### Apple / App Store Connect / Expo

- Apple ID unlocked after the -20209 lock (Makis proceeded with App Store Connect afterwards).
- Bundle identifier registered at developer.apple.com and matches `ios.bundleIdentifier` in app.json.
- App Store Connect app record created for Moraki. User Access set to Full Access.
- App Store Connect API key created (Admin role) and added to EAS with `eas credentials`. The .p8 file is kept outside the repo.
- Expo DPA: no separate DPA to sign. Expo's terms (section 3.2) make Expo a processor under EU Standard Contractual Clauses, and Expo is certified under the EU-US Data Privacy Framework. Nothing to wait on. Decision: treat as covered, subject to the two follow-ups below.

### Supabase (hosted)

- Supabase CLI logged in and project linked (`supabase login`, `supabase link`). `supabase init` is not needed because supabase/config.toml already exists in the repo.
- `supabase db push` reported "Remote database is up to date". `supabase migration list` shows all migrations on both Local and Remote.
- Auth settings done (Authentication in dashboard): Email provider enabled with confirm email, code length and expiry checked, Site URL and redirect URLs set, email templates include the code, custom SMTP configured, rate limits reviewed, Apple and Google providers set up. This closes P2-F5.

### TestFlight build 2 (main 8a1dc663), 2026-10-08

- Installed from TestFlight on a real iPhone, over an older install that had data (same bundle ID).
- The encrypted database upgrade (SQLCipher, P5-03) kept the history: after a restart, Home and History showed it. Caveat: Home was empty before sign in, so the history seen afterwards may have come from the server pull rather than from the converted file. Confirming the file itself needs an entry that never reached the server (logged offline on the old build) to still show.
- Bug found (P5-F10): after signing in and accepting consent, Home (time since last feed, today strip), History and the feed list stayed empty until the app was force-closed and reopened. Settings showed the baby's details straight away. Root cause and fix in the P5-F10 PR. Needs a new build (build 3) to check on the phone.

## Still open

### Sage design refresh (2026-10-09, overnight run)

- The whole app is restyled to Sage on the integration branch `design/sage-refresh`: PRs #132 to #145, all merged into that branch, none into main.
- Build 3 and the store submission are on hold until the owner has tested the branch and merged it into main.
- One EAS preview build (iOS, `--profile preview`) was run from the branch and **failed at the Sentry source-map upload**: the `preview` profile has no `SENTRY_AUTH_TOKEN` and no `SENTRY_ALLOW_FAILURE`. Log: https://expo.dev/accounts/ce-code-designs-ltd/projects/moraki/builds/a648f007-a7ce-4792-950a-d6b69ef1d455
- To fix (owner): add the token to the EAS preview environment, or `SENTRY_ALLOW_FAILURE=true` to the preview profile. Then rebuild. That build is the first real test of the new icon, the splash and the Sage screens.
- What to check first: `docs/design/REVIEW_NOTES.md`, sections 3 and 7.

### Needs a decision or confirmation

- #122 (D3, owner picks who takes over): confirmed NOT merged yet (2026-10-05). Review and merge.
- Supabase project linked is prod (confirmed 2026-10-05). The hosted deletion test and key rotation therefore run against prod, so use a clearly throwaway account and rotate the key before the production build.
- Follow-up from the DPA finding: confirm Expo is listed as a processor for update checks in records-of-processing.md, with the transfer basis. Confirm the privacy policy names Expo as a recipient with data going to the US.

### Makis's steps still to do

1. Rotate the Supabase publishable key (P3-F5): create new key, update .env and EAS environment variables, delete the old key, before the production build.
2. Delete one throwaway account on the hosted project to confirm deletion works. Also test the two-account case, where the owner deletes and picks a successor (#122).
3. Create the EU Sentry project (EU region at creation). Add the DSN and auth token to .env and EAS.
4. `eas build -p ios --profile production` in his own terminal (first run asks for Apple login and 2FA to create the distribution certificate and provisioning profile).
5. `eas submit -p ios --profile production --latest`. Check `usesNonExemptEncryption: false` in app.json. Answer "no non-exempt encryption" if asked (D5).
6. Install via TestFlight (internal tester) and check on a real iPhone. Build 2 done for the upgrade check (see above); build 3 needed for P5-F10: sign in and accept consent, then Home and History fill without a restart; the same after joining by invite on a second phone. Original list: history survives the encrypted-database conversion (needs an older install with data under the same bundle ID), leave / delete / sign-out work, PDF report shares, a real invite link opens the app (if universal links: moraki.app must serve the Apple association file after the landing page from #124 is deployed).
7. Store review prep: 6.9" iPhone screenshots (about 1320x2868), demo account that works without reading Makis's inbox (sign-in is by emailed code), age rating, App Privacy answers from #115, privacy policy URL, support URL, optional marketing URL (moraki.app now exists), lawyer review of policy, terms and DPIA.

### Not started by design

- P4-09 onboarding polish (after TestFlight).
- Account switching on one phone (P5-F1).
