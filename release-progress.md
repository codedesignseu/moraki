# Moraki: App Store release progress (Makis's manual steps)

Last updated: 2026-10-05 (evening, Cyprus time). Source: Makis confirmed each item in chat.
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

## Still open

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
6. Install via TestFlight (internal tester) and check on a real iPhone: history survives the encrypted-database conversion (needs an older install with data under the same bundle ID), leave / delete / sign-out work, PDF report shares, a real invite link opens the app (if universal links: moraki.app must serve the Apple association file after the landing page from #124 is deployed).
7. Store review prep: 6.9" iPhone screenshots (about 1320x2868), demo account that works without reading Makis's inbox (sign-in is by emailed code), age rating, App Privacy answers from #115, privacy policy URL, support URL, optional marketing URL (moraki.app now exists), lawyer review of policy, terms and DPIA.

### Not started by design

- P4-09 onboarding polish (after TestFlight).
- Account switching on one phone (P5-F1).
