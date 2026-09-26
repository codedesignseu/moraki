# Retention policy

**Task:** P4-11. **Written:** 2026-09-26.

Storage limitation (Article 5(1)(e)) means naming a period for every category and
being able to point at the mechanism that enforces it. Where a mechanism does
not exist yet, this document says so instead of implying it does.

---

## Periods

| Category                                         | Kept                                                                                                                                              | Enforced by                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Entries (`events`), including health data        | for the life of the household. A family's record of a newborn is the thing they came for; it is not trimmed on a schedule                         | —                                                                         |
| Soft-deleted entries (`deleted_at` set)          | as a tombstone for the life of the household. The row must outlive the deletion so every other phone learns of it and converges (rule 7, SDD 5.2) | —                                                                         |
| Baby profile                                     | life of the household                                                                                                                             | —                                                                         |
| Account (`auth.users`), membership, display name | until the account is deleted                                                                                                                      | P4-06, **not built**                                                      |
| Consent records                                  | kept after withdrawal, as the evidence that consent was given and withdrawn, and for how long. Deleted with the account                           | cascade on `auth.users`                                                   |
| Feedback messages                                | **24 months**, then deleted; or with the account, whichever is sooner                                                                             | cascade on `auth.users`; the 24-month sweep is **not built** (P4-F5)      |
| Invite codes                                     | expire 7 days after creation. The row persists until revoked, used, or its household is deleted                                                   | expiry is checked in `accept_invite`; no cleanup job (P4-F5)              |
| Sign-in codes                                    | 10 minutes                                                                                                                                        | Supabase Auth                                                             |
| Sessions                                         | until sign-out, or the refresh token expires                                                                                                      | Supabase Auth                                                             |
| Crash reports                                    | Sentry's retention for the plan in use — **90 days on current plans; confirm and record the figure**                                              | Sentry                                                                    |
| Inactive households                              | no activity for 24 months → the owner is warned by email → deleted 30 days later                                                                  | **not built.** SDD 12.1 states the policy; the job does not exist (P4-F5) |
| On-device data                                   | until the app is uninstalled or its data cleared. The session token is in the OS keychain, which on iOS survives uninstalling the app             | the operating system                                                      |
| Export files (JSON/CSV)                          | leave the app through the share sheet. Once handed over they are the person's own copy, wherever they chose to put it                             | out of the controller's hands by design                                   |
| Web request logs on `moraki.app`                 | the host's own log retention. **Record it here once hosting is settled**                                                                          |

---

## What a person can get today, and what they cannot

| Right                             | State                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access, portability (Art. 15, 20) | **Works.** Settings → Your data exports everything as JSON and CSV, including deleted entries, marked as deleted (P4-05)                                    |
| Rectification (Art. 16)           | **Works.** Every entry is editable, and the baby's details are correctable by any writer                                                                    |
| Restriction (Art. 18)             | **Partly.** Withdrawing consent stops this account's writes syncing and stops health data being processed further; nothing already stored is deleted        |
| Erasure (Art. 17)                 | **Not built.** P4-06 (leave household, delete account, delete household with cascade) is reserved for a review window because it destroys data irreversibly |
| Objection (Art. 21)               | withdraw consent, or stop using the app; there is no profiling and no marketing to object to                                                                |

The consent screen's copy was corrected in P3-F6 so it no longer promises
deletion the app cannot perform. It reads: export works at any time, deletion
from the servers is coming, and until then withdrawing stops processing and any
entry can be deleted on the phone. **That sentence has to become a promise
again as soon as P4-06 lands, and the correction has to happen in the same
release, not after it.**

A deletion request arriving before P4-06 exists is handled by hand, by the
controller, directly against the database, and the fact recorded in this
directory. That is acceptable for a beta of five households and not acceptable
at any larger scale.

---

## Follow-ups this document creates

- **P4-F5** — the three sweeps named above do not exist: inactive households, feedback older than 24 months, and used or expired invites. Until they do, every "then deleted" row here is a statement of intent rather than a fact.
- The two figures marked **confirm** (Supabase region, Sentry retention) should be read off the dashboards and written in, rather than left as approximately right.
