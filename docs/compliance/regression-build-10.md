# Regression test report: Moraki 1.0.0 (build 10)

- **Tested by:** the owner, on two real iPhones (A: owner, B: second test account), with test data only.
- **When:** 26–27 October 2026.
- **Build:** iOS **1.0.0 (10)**, TestFlight. EAS build `930595c4-f4e2-49b7-87b1-45f2babef9ba`, from `main` at `5325ca5a`.
- **Backend:** production Supabase (Pro plan, Frankfurt), with every migration up to `20261026100000_erasure_journal` applied. Checked on 2026-10-26 with `supabase migration list`: every local migration is also on remote.
- **Website:** moraki.app live, with Privacy, Terms, Support, Legal notice, Cookies, Disclaimer and Data deletion pages, in English and Greek.
- **Result: all 28 checks passed.**

This covers the scenarios the lawyer asked for: guardian creation, consent refusal, consent withdrawal, invitations, caregiver removal, offline reconnect, account deletion, household deletion, record erasure and export. It is a functional test on devices, not a security audit or a legal assessment.

| #   | Area               | Check                                                                                                                                                                                       | Result |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| S1  | Sheets             | Log sheets and the entry editor open as page sheets, with no header overlap. Swipe down and × close.                                                                                        | Pass   |
| S2  | Consent version    | The updated consent text (2026-10-26) is asked once. "Not now" keeps the app working within the 90-day grace.                                                                               | Pass   |
| 1   | Update             | Installing build 10 over the earlier build keeps the user signed in (session token moved to this-device-only storage).                                                                      | Pass   |
| 2   | Terms              | Terms acceptance at sign-in, with links to Terms and Privacy and the medical line. "Not now" pauses sharing only. Agreeing resumes it.                                                      | Pass   |
| 3   | Guardian           | An existing household asks once for the guardian declaration, then sharing resumes.                                                                                                         | Pass   |
| 4   | Sign-in            | Sign-in requires the Terms box ticked.                                                                                                                                                      | Pass   |
| 5   | Household creation | Creating a household is refused without the guardian declaration and the health-data consent.                                                                                               | Pass   |
| 6   | Household creation | The household is created and an entry saves.                                                                                                                                                | Pass   |
| 7   | Invitation         | Before joining, the invitee sees only the role, the statement that they will see every past and future entry, and the caregiver agreement. Nothing about the baby.                          | Pass   |
| 8   | Invitation         | After accepting, the caregiver sees the history and logs. Entries appear on both phones.                                                                                                    | Pass   |
| 9   | Invitation         | A revoked invite code is refused.                                                                                                                                                           | Pass   |
| 10  | Withdrawal         | A caregiver withdrawing the agreement leaves the household.                                                                                                                                 | Pass   |
| 11  | Withdrawal         | The last guardian withdrawing pauses (freezes) the household. Each member sees only their own entries. The guardian is offered delete, hand over or agree again. Agreeing again resumes it. | Pass   |
| 12  | Withdrawal         | While withdrawn, a person can still delete their own entries.                                                                                                                               | Pass   |
| 13  | Withdrawal         | A guardian who joined by invite and withdraws, while another guardian still consents, stops seeing the household's entries (only their own).                                                | Pass   |
| 14  | Removal            | A removed caregiver's phone clears the household and its reminders on the next open, and shows a notice.                                                                                    | Pass   |
| 15  | Offline            | A phone removed while offline keeps its data until it reconnects, then clears it.                                                                                                           | Pass   |
| 16  | Offline            | A short network error clears nothing.                                                                                                                                                       | Pass   |
| 17  | Erasure            | A deleted entry disappears on both phones.                                                                                                                                                  | Pass   |
| 18  | Erasure            | Deleting a household removes it on both phones.                                                                                                                                             | Pass   |
| 19  | Account deletion   | Deleting an account that signed in with Apple: Apple confirms, then Moraki is removed from that Apple ID's "Sign in with Apple" list (token revoked).                                       | Pass   |
| 20  | Account deletion   | Deleting an account that signed in with Google: Moraki is removed from the Google account's third-party connections.                                                                        | Pass   |
| 21  | Export             | Both export files share. The JSON includes the user's account section: email, sign-in method, consent records, feedback.                                                                    | Pass   |
| 22  | Report             | The PDF report shares and opens, and is deleted from the app's cache afterwards.                                                                                                            | Pass   |
| 23  | Medical boundary   | The weight chart shows no 90%/100% lines and no Day 10/14 markers, only grams since birth.                                                                                                  | Pass   |
| 24  | Notifications      | The appointment reminder shows only "Appointment tomorrow at …", with no title or health details.                                                                                           | Pass   |
| 25  | Greek              | The Greek greeting is on one line and the Home button reads "Νέο τάισμα".                                                                                                                   | Pass   |
| 26  | Erasure journal    | After 04:05 UTC, the nightly erasure-journal email arrives at the owner's mailbox with a CSV of ids only.                                                                                   | Pass   |

## Not covered by this test, verified separately or still open

- **Owner-confirmed in dashboards** (evidence list, 2026-10-26):
  - Supabase Pro daily backups kept 7 days;
  - Sentry scrubbers on and IP storage off;
  - Apple private email relay registered and tested;
  - Brevo sender authenticated;
  - the data-request register created.
- **Two-factor login** on Supabase, GitHub, Expo, Sentry, Apple, Cloudflare, Brevo and A2 Hosting: being set up by the owner.
- **Time-based behaviour** that a same-day test can't show:
  - the 30-day content purge of deleted entries;
  - the 23-month inactivity warning and 24-month deletion;
  - the 90 + 30-day frozen-household warning and deletion;
  - the 35-day erasure-log purge;
  - the 3-year consent-record erasure;
  - the 90-day consent-version grace expiry.

  These are covered by automated database tests (pgTAP, run on every change) and run as nightly jobs in production. Their success can be checked in Supabase → Integrations → Cron.

- **Android:** not in scope for v1, which is iOS only.
- **Production test households:** the owner keeps them for testing. They must be removed before public launch.

## Open legal decisions

Questions 1–10 in `legal-update-2026-10-24.md`, section 3. The main ones:

- the 3-year consent-record period;
- the lawful bases;
- the frozen-household lifecycle;
- 90 days under the previous consent version for non-material changes;
- the registered address on the Legal notice;
- export compliance.
