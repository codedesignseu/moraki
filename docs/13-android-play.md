# Android: from EAS to Google Play

Status on 2026-11-22 (Publishing overview still shows the resubmitted changes in review):

- **Decided 2026-11-09 (owner):** Android comes forward from v1.1 and runs alongside the iOS review.
- **Build in review:** 1.0.0 (3), versionCode 3, from main `fbe1e15a`, EAS build `572ebb9d-30a5-439b-9c04-3130a876f707`. It carries #236 (the Sign in with Apple name fix) and strips `AD_ID`, `SYSTEM_ALERT_WINDOW` and external storage through `android.blockedPermissions` (#238).
  - It is on internal testing. The production full rollout was first sent for review on 2026-11-14.
- **Rejected 2026-11-21: "Inaccurate Health Apps Declaration".** Play matched the store description against four health categories that weren't declared. The fix was form-only, with no new build (step 3, item 9).
- **Resubmitted 2026-11-21:** the production rollout, two Alpha tester changes, the Health declaration and a fresh App access code.
  - Sending the code change restarted the review begun earlier that day.
  - The pre-check warning about `android.hardware.screen.portrait` (it excludes some tablets, desktops and XR) was ignored. Making it optional in the manifest is for the next build.
- **Managed publishing is on.** After approval, the owner clicks **Publish changes**. iOS was released first, on 2026-11-22.
- **Task IDs:** A-01 to A-09 in `docs/TASKS.md`, "Launch — Android".

## Effect on the iOS review (over: released 2026-11-22)

The rule is now about Play: **no `eas update --branch production` until Play has decided on 1.0.0 (3).**

- The iOS and Android builds both listen to the `production` update channel. A published update would reach the Play reviewer's app.
- Building Android publishes no update. It has its own versionCode and its own EAS build allowance.
- The website change in step 8 edits `assetlinks.json` only. Leave `apple-app-site-association` as it is, and check it still loads after uploading the site again.
- Google Cloud: a new Android OAuth client doesn't change the Web or iOS clients.
- No Supabase change is needed.

## Step 0. What you need open

- Play Console: https://play.google.com/console
- Google Cloud Console: https://console.cloud.google.com, in the project that holds the Google sign-in clients (project number `865433627932`, from the iOS client ID).
- The `.aab` file (link above).
- EAS credentials: https://expo.dev/accounts/ce-code-designs-ltd/projects/moraki/credentials

## Step 1. Check the developer account

Play Console → ⚙ Settings → Developer account → Account details.

1. The account type is **Organization** (CE Code Designs Ltd), with D-U-N-S verified. A **Personal** account needs a 14-day closed test with 12 testers before production; if that's the case, stop and plan for it.
2. Identity verification shows Verified.
3. Developer email and phone are verified. The public email is `hello@moraki.app` and the website is `https://moraki.app`.
4. If Home shows a banner about Android device verification, install the Play Console app on the Android phone and follow it.

## Step 2. Create the app

Home → Create app.

| Field            | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| App name         | `Moraki: Newborn Tracker`                               |
| Default language | English (United States) – en-US                         |
| App or game      | App                                                     |
| Free or paid     | Free (this can't be changed later)                      |
| Declarations     | Developer Program Policies, US export laws: both ticked |

## Step 3. App content

Policy and programs → App content. Do every card.

1. **Privacy policy:** `https://moraki.app/privacy`
2. **App access:** "All or some functionality is restricted". Add these instructions, with a fresh invite code made on the day of the production submission (codes expire after 7 days):

   ```text
   Logging feeds, diapers and sleep works without an account.
   To test sharing: Settings → Sign in → Continue with Google (any Google account)
   or email code. Then Settings → Join household → enter code XXXX-XXXX.
   ```

   Each code is single-use. When a review runs longer than the code, a new code goes in as a separate change, and sending it restarts the review in progress (as happened on 2026-11-21).

3. **Ads:** No.
4. **Content rating:**
   - Email: `hello@moraki.app`. Category: "All other app types".
   - Answer No to violence, sexuality, language, controlled substances and gambling.
   - Content is shared only inside a household the user invites. If a question asks about interaction with strangers, answer No.
   - The expected rating is PEGI 3 / Everyone.
5. **Target audience:** 18 and over only. "Could your app unintentionally appeal to children?": No.
6. **News app:** No.
7. **Data safety:** see the table in `docs/store/app-privacy-answers.md`, "Google Play: Data safety".
   - Data collected: yes. Encrypted in transit: yes.
   - Account creation: OAuth (Google) and Other (email code). An account isn't required.
   - Deletion URL: `https://moraki.app/support#delete`
   - For every row: collected yes, shared no, processed ephemerally no.
8. **Government apps:** No. **Financial features:** none.
9. **Health:** tick every category the store description touches. Play checks the declaration against the listing text, and rejected the app on 2026-11-21 when only "Other" was ticked. Declared since then:
   - Nutrition and weight management (feeds, pumping, milk stock, weight);
   - Sleep management;
   - Healthcare services and management (appointments, the pediatrician summary);
   - Medication and treatment management (medication log);
   - Other, with the existing "newborn care log … no diagnosis, dosing advice or medical interpretation" text.

   Leave every medical device, clinical decision and research option unticked. This matches the App Store's "Regulated Medical Device: No". If the description gains a new feature, check this card again.

10. **Advertising ID:** No. If Play warns that the build declares `AD_ID`, Claude strips the permission in the next build.
11. **Sensitive permissions:** this card appears after the first upload. For exact alarms, declare "user-set reminders" (feed and appointment reminders). Send Claude anything else that appears.

## Step 4. Store listing

Grow users → Store presence → Main store listing.

| Field                   | EN                                                                                  | EL                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| App name (30)           | `Moraki: Newborn Tracker`                                                           | `Moraki: Ημερολόγιο μωρού`                                                      |
| Short description (80)  | `Log a bottle in two taps, one-handed, at 4am. Shared feeds, diapers & sleep.` (76) | `Κατέγραψε ένα μπιμπερό με δύο αγγίγματα, με το ένα χέρι, στις 4 το πρωί.` (72) |
| Full description (4000) | "Description", `docs/store/app-store-listing.md`                                    | the Greek "Description" in the same file                                        |

- Greek goes in Manage translations → Add your own translation text → Greek (el-GR).
- **Graphics:**
  - App icon 512×512 PNG, no transparency.
  - Feature graphic 1024×500: Claude makes it.
  - 2 to 8 phone screenshots at 9:16, at least 1080 px on the short side (1080×1920). The App Store 1206×2622 set isn't 9:16, so Claude reframes it with `design/app-store-screenshots`. Skip tablet screenshots.
- **Store settings:** category Parenting, email `hello@moraki.app`, website `https://moraki.app`.

## Step 5. Countries, price and managed publishing

1. Test and release → Production → Countries / regions: Cyprus, Greece.
2. Free, with no in-app products.
3. Publishing overview → **Managed publishing ON**. This is Play's version of iOS manual release: approved changes wait for **Publish changes**.

## Step 6. Upload access for EAS (service account)

1. Enable the API: https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com
2. https://console.cloud.google.com/iam-admin/serviceaccounts → Create service account `eas-play-submit`, with no project roles.
3. The account → Keys → Add key → JSON. Keep the file outside the repository, in a password manager.
4. Play Console → Users and permissions → Invite new users → the service account's email → App permissions → Moraki. Tick:
   - Release to production, exclude devices, and use Play App Signing
   - Release apps to testing tracks
   - Manage testing tracks and edit tester lists
5. `eas credentials -p android` → production → Google Service Account → upload the JSON. Then delete the downloaded copy.

## Step 7. First upload to internal testing (by hand, Google's rule)

1. Testing → Internal testing → Testers → Create email list `Moraki team`: the owner's and the second caregiver's Gmail addresses. Copy the "Join on Android" link.
2. Releases → Create new release:
   - App signing: **Use Google-generated key** (Play App Signing).
   - Upload the `.aab`. Release name: `1.0.0 (2)`.
   - Release notes: `<en-US>First release.</en-US>` and `<el-GR>Πρώτη έκδοση.</el-GR>`.
   - Save and publish. Internal testing has no review.
3. On the phone: uninstall the old development APK, because its signature differs. Open the join link, accept, and install from Play.

From the second build on: `eas build --profile production --platform android --auto-submit` uploads to the internal track as a draft.

## Step 8. Signing fingerprints

1. Test and release → App integrity → App signing. Send Claude the SHA-1 and SHA-256 of both the **app signing key** and the **upload key**. They're public fingerprints, not secrets.
   - The upload key's SHA-256 should match the EAS key already in `assetlinks.json` (`48:AA:E0:98:…:65:C6`).
2. **Claude:** adds the app signing key's SHA-256 to `public/.well-known/assetlinks.json` (P2-F13) and rebuilds the site zip. **Owner:** uploads the site. Play Console → Grow users → Deep links then shows `moraki.app` verified.
3. **Owner, Google sign-in:** https://console.cloud.google.com/apis/credentials, in the same project as the Web and iOS clients.
   - Check any existing Android client's package and SHA-1.
   - Create an OAuth client ID of type Android: `Moraki Android (Play)`, package `eu.codedesigns.moraki`, the app signing key's SHA-1.
   - Make a second one, `Moraki Android (upload/EAS)`, with the upload key's SHA-1, unless one already exists. Google allows one SHA-1 per Android client.
   - Without these, Google sign-in on Android fails with `DEVELOPER_ERROR`.
   - Supabase and EAS need no change: the app sends the Web client ID.

## Step 9. Phone test (installed from Play)

- [ ] The app opens and the consent screen shows.
- [ ] Email-code sign-in works.
- [ ] Google sign-in works, with no `DEVELOPER_ERROR`.
- [ ] A `https://moraki.app/join/CODE` link opens Moraki on the join screen, not the browser.
- [ ] Joining by a typed code works (#232).
- [ ] A feed logged on one phone shows on the other.
- [ ] Reminders: the permission is asked once, the notification arrives on time, and its text has no baby data.
- [ ] Night mode, Greek, and the largest font.
- [ ] Share PDF and Export.
- [ ] Deleting a test account.

JavaScript-only fixes ship as an over-the-air update **only after Play has decided on 1.0.0 (3)**.

## Step 10. Production

1. The Dashboard shows every "Set up your app" task ticked.
2. Production → Create new release → Add from library → `1.0.0 (3)`, with the same notes. Done 2026-11-14.
3. Publishing overview → Send changes for review. A first review takes from hours to about 7 days. Forward any rejection to Claude. Sent 2026-11-14, rejected 2026-11-21 (Health declaration), resubmitted the same day.
4. Once approved, click **Publish changes** at the time agreed with the iOS release.
5. Claude adds the Google Play badge to moraki.app.

## Known limitation

An account linked to Sign in with Apple is deleted on Android without revoking its Apple tokens. Revoking them needs Apple's native sheet, which Android doesn't have (P5-F12).
