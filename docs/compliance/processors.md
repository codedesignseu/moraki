# Processors and sub-processors

**Task:** P4-11. **Written:** 2026-09-26. Replaces the one-line list in SDD 12.1,
which is now a pointer here.

A processor is on this list if personal data reaches it. Services that only ever
see source code, static files or aggregate billing are listed at the bottom as
**not processors**, with the reason, so the distinction is deliberate rather
than forgotten.

---

## Active processors

### Supabase — database, authentication

|                   |                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| What it processes | everything in records-of-processing §3.1–§3.3 and §3.5: the account, the baby, every entry, consents, invites, feedback |
| Region            | EU. Project `tjcahnjpbkgrjytrazfs` — **confirm the exact region in the dashboard and record it here**                   |
| Sub-processors    | AWS (hosting)                                                                                                           |
| Legal             | Supabase's DPA. **Must be signed before any household outside the developer's own joins** (SDD 12.1)                    |
| Status            | live                                                                                                                    |

### Google Workspace — sign-in code delivery (SMTP)

|                   |                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| What it processes | the recipient's email address, and the sign-in code in the message body                                                     |
| Why               | Supabase's built-in sender only mails project team members, a few per hour, so nobody else could sign in without it (P2-F5) |
| Region            | Google's EU infrastructure under the Workspace terms; confirm the data region setting on the account                        |
| Legal             | Google Workspace DPA, accepted with the Workspace agreement                                                                 |
| Status            | live. It carries no health data — an address and a six-digit code                                                           |

### Sentry — crash reporting

|                   |                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------- |
| What it processes | records-of-processing §3.4: a scrubbed crash report. No user, no IP address, no payload |
| Region            | EU organisation, `*.ingest.de.sentry.io`. The app refuses any other DSN at startup      |
| Legal             | Sentry's DPA                                                                            |
| Status            | live from P4-08, and inert in any build without a DSN                                   |

### Expo — build service, and later update delivery

|                   |                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it processes | the developer's own account, build artefacts and signing credentials. **No household data at runtime**: the app talks to Supabase directly, and EAS Update is not configured (no `updates` key in `app.json`) |
| Note              | if EAS Update is switched on (P4-12), Expo begins serving JS bundles to devices and will see device identifiers and IP addresses. Revisit this row then                                                       |
| Region            | US-based company; relevant only to the developer account and build data today                                                                                                                                 |
| Status            | live for builds                                                                                                                                                                                               |

### Apple — distribution

|                   |                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it processes | a TestFlight tester's email address and their device identifier; App Store account data for downloads. No household data                                |
| Note              | push delivery is P4-02 and not built. When it is, an APNs token becomes a processed identifier, and notification bodies must stay content-free (rule 8) |
| Status            | live once TestFlight is used (P4-12)                                                                                                                    |

### Google — distribution

|                   |                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| What it processes | a Play internal-testing tester's account, and Play App Signing holds the release signing key. No household data |
| Note              | same push caveat as Apple, for FCM                                                                              |
| Status            | from P4-12                                                                                                      |

---

## Not processors, and why

| Service                 | Why not                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub                  | source code, issues and CI. No user data; `.env` is gitignored and secrets live in GitHub and EAS secret storage                                                                                                                                       |
| The `moraki.app` host   | serves two static association files and, later, a landing page. It receives ordinary web request logs, not app data. The invite link's code appears in a URL if someone opens it in a browser — which is why codes are single-use and expire in 7 days |
| GoDaddy                 | domain registration and DNS                                                                                                                                                                                                                            |
| Anthropic (Claude Code) | development tooling on the developer's machine. It reads the repository, which contains no household data                                                                                                                                              |

---

## When this list changes

Add a row **before** shipping the change, not after:

- push notifications (P4-02) → Apple APNs and Google FCM become runtime processors of device tokens
- EAS Update (P4-12) → Expo begins serving bundles to devices
- any analytics product → would need a lawful basis, a DPIA revision and a consent mechanism. SDD 12.1 says there is none, and that is a design decision, not an omission
- a landing page with a contact form, newsletter or embedded third-party script
