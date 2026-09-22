# Task Board

Status: `pending` | `in_progress` | `blocked` | `done`

Rule for the agent: work top to bottom within a phase. Skip anything whose
`depends` isn't `done`. Never mark something `done` without its "done when"
condition actually being true (tests passing, not "should work"). Log
anything found while working as a new line under "Found while working" in
the relevant phase, status `pending` — never fix it inline as part of a
different task.

Source: `02-sdd-and-build-plan.md` section 10.3, version 0.3.

---

## Waiting on device

Checks that need real hardware. They are queued, not blocking: work continues,
and this list is cleared in one pass once the Android phone is available. Add
to it whenever a task's done-when can only be met on a device.

- [ ] P0-09 (#9): rebase #9 onto `main` and merge it (eas.json lives there),
      then build the Android development build from `main` and install it on
      the phone. It must be a new build, because expo-sqlite and
      expo-crypto (native) were added after the first EAS build. On first launch
      also check that a fresh install reaches home, which is the first real run
      of migrations and the database gate (P1-03, P1-06).
- [ ] P1-09: start a sleep, force-quit the app, reopen it a few minutes later,
      and check the running sleep card shows the right time and Stop works.
      P1-09 stays `in_progress` until this passes.
- [ ] P1-11: with 2,000 events in the database, scroll the history timeline on the
      Android phone and check it holds 60fps (Android GPU rendering profile or
      the performance monitor). P1-11 stays `in_progress` until this passes.
- [ ] P1-F11 (watch only): during the device pass, check that the first tap on a
      home action after a cold start opens its sheet. It only happens in web
      preview so far; flag it if it reproduces on the phone.

---

## Phase 0 — Foundations

Gate to move on: dev build installed on an iPhone and an Android.

- [x] P0-01 `chore: init expo app with typescript strict, expo-router, CLAUDE.md` — depends: none — done when: `npx expo start` runs, strict TS, engineering rules (SDD section 14) copied into CLAUDE.md
- [x] P0-02 `chore: add eslint, prettier, husky, lint-staged, commitlint` — depends: P0-01 — done when: pre-commit blocks a lint error
- [x] P0-03 `chore: add jest with rntl and a sample domain test` — depends: P0-01 — done when: `npm test` green
- [x] P0-04 `ci: github actions for lint, typecheck, test` — depends: P0-02, P0-03 — done when: PR shows three green checks
- [x] P0-05 `feat(ui): design tokens, light and night themes, typography scale` — depends: P0-01 — done when: tokens file, theme provider, one sample screen in both themes
- [x] P0-06 `feat(ui): primitives Card, Sheet, Stepper, Segmented, Chip, Button, TimerText` — depends: P0-05 — done when: storybook-style demo route renders all primitives
- [x] P0-07 `feat(i18n): i18next with en locale and typed keys` — depends: P0-01 — done when: no hardcoded strings lint rule on
- [x] P0-08 `chore(supabase): init supabase project folder, local docker, env handling` — depends: P0-01 — done when: `supabase start` works, `.env.example` committed
- [ ] P0-09 `build: eas config with development, preview, production profiles` — depends: P0-01 — done when: dev build installed on your iPhone and an Android

### Found while working (P0)

- [x] P0-F1 `chore: untrack node_modules and .expo, ignore them` — found during P0-02 — done when: `git ls-files node_modules .expo` is empty
- [x] P0-F2 `fix(deps): pin react-dom to 19.2.3 to match react` — found during P0-02 — expo-router peers resolved react-dom 19.3.0 (needs react ^19.3.0), so any second `npm install` failed with ERESOLVE — done when: `npm install` runs twice without ERESOLVE
- [x] P0-F3 `fix(deps): pin test-renderer to ~1.2.0 so react-reconciler matches react 19.2` — found during P0-04 — RNTL 14 resolves test-renderer 1.3.0, whose react-reconciler 0.34 needs react ^19.3.0 (npm ci warns ERESOLVE, doesn't fail); react-reconciler 0.33 in test-renderer 1.2 wants ^19.2.0 — done when: `npm ls react` shows no invalid react-reconciler edge and an RNTL render test passes
- [ ] P0-F4 `fix(deps): align react-native-worklets with expo-modules-core peer range` — found during P0-F3 — expo-router pulls @expo/ui and react-native-reanimated 4.7, which resolve react-native-worklets 0.13.0; expo-modules-core 57.0.18 declares optional peer `^0.7.4 || ^0.8.0 || ^0.9.0 || ^0.10.0`. `npm ci` succeeds, `npm install` prints one ERESOLVE warning, `npm ls` reports it invalid — done when: `npm ls --all` reports no invalid edges

---

## Phase 1 — Core logging, one phone

Gate to move on: you use it alone for 3 days without paper backup.

- [x] P1-01 `feat(domain): event types, zod payload schemas, activity module registry` — depends: P0-03 — done when: every type in SDD 4.1 has a schema with valid and invalid tests, and the registry completeness test in SDD 15.3 passes
- [x] P1-02 `feat(domain): time utils (duration format, day buckets, tz safe)` — depends: P0-03 — done when: tests pass under three TZ values and across the 25 Oct DST change
- [x] P1-03 `feat(db): drizzle sqlite schema, local migrations, outbox, meta` — depends: P1-01 — done when: migrations run on fresh install and on upgrade
- [x] P1-04 `feat(db): events repository with insert, patch, softDelete writing outbox in one transaction` — depends: P1-03 — done when: tests prove event and outbox rows commit or roll back together
- [x] P1-05 `feat(domain): home state selector` — depends: P1-01, P1-02 — done when: tests cover no feeds, one feed, breast then bottle, deleted last feed, active sleep
- [x] P1-06 `feat(home): timer card, next side, reminder line, today strip, recent list` — depends: P0-06, P1-04, P1-05 — done when: timer ticks every 30s, updates instantly on log
- [x] P1-07 `feat(log): feed sheet (bottle, breast, mixed) with last-used prefill` — depends: P1-04, P0-06 — done when: bottle feed in 2 taps from home
- [x] P1-08 `feat(log): diaper sheet, one tap save` — depends: P1-04 — done when: wet, dirty, both each save in one tap from the sheet
- [ ] P1-09 `feat(log): sleep start, stop, manual entry, running sleep card` — depends: P1-04 — done when: running sleep survives app kill — status: in_progress (kill simulated in tests by reopening the stored database from scratch; a real kill on a device with the new dev build is still to verify)
- [x] P1-10 `feat(log): health note and medication sheets` — depends: P1-04 — done when: temp range validated, note length capped
- [ ] P1-11 `feat(history): timeline grouped by day with filters` — depends: P1-04 — done when: 2,000 events scroll at 60fps on the Android test phone — status: in_progress (built and tested; the 60fps scroll check is on the Waiting on device list)
- [ ] P1-12 `feat(entry): edit sheet and delete, undo toast on every save` — depends: P1-04, P1-11 — done when: undo within 6s restores exact prior state
- [ ] P1-13 `feat(domain): reminder computation` — depends: P1-05 — done when: tests for recalculation on new feed, edit of last feed, delete of last feed, second reminder
- [ ] P1-14 `feat(notifications): permission flow and local scheduler bound to reminder computation` — depends: P1-13, P0-09 — done when: on a real phone: log feed, lock, notification arrives at the right minute, relog moves it
- [ ] P1-15 `feat(settings): reminder interval, second reminder, per-device reminders toggle` — depends: P1-14 — done when: changing interval reschedules immediately
- [ ] P1-16 `feat(ui): night mode auto, on, off` — depends: P0-05 — done when: switches at 21:00 and 06:00 without restart
- [ ] P1-17 `feat(insights): 7 day milk chart, averages, diaper and sleep counts` — depends: P1-05 — done when: numbers match a hand-checked fixture
- [ ] P1-18 `test(e2e): maestro flows for log feed, log diaper, undo, edit` — depends: P1-12 — done when: flows pass on both simulators in CI or locally
- [x] P1-19 `feat(log): breastfeed duration stepper on the feed sheet` — depends: P1-07 — done when: a breast or mixed feed logged from the sheet saves its duration, so today's breastMs goes up by that duration (tests), with the repeat-feed flow still two taps. Scope: a "Fed for" minutes stepper in the breast part of the sheet (breast and mixed), same pattern as the P1-09 sleep duration stepper, 5-minute steps, 5 to 90 minutes; prefilled with the last breast feed's duration, 15 minutes before the first. Saved as start and end times (occurred_at = sheet opened minus the duration, ended_at = sheet opened), not per-side seconds, since a both-sides feed has no known split. Found as P1-F8. Size: small, about half a day, 150 to 250 lines with tests; touches only the feed sheet, the feed prefill and their tests; blocks nothing in flight
- [x] P1-20 `fix(domain): merge overlapping sleep periods before summing sleep in the last 24 hours` — depends: P1-05 — done when: two overlapping sleeps count their shared time once in sleepMs24h (test), and removing the merge makes that test fail (mutation check). Found while re-reviewing P1-09: a past sleep can be entered while one is running, and overlapping sleeps can also arrive from another caregiver's phone through sync, so no save-time check can prevent it; fixed once where the total is computed. Size: small, about half a day, 100 to 200 lines with tests; touches only the home state fold and its tests; blocks nothing in flight

### Found while working (P1)

- [x] P1-F1 decide the unknown-key policy for event payloads before sync pull — found during P1-01 — the P1-01 schemas use Zod's default `z.object`, which strips unknown keys. When a newer app version adds an optional payload field, an older phone that pulls, edits and pushes that event would silently drop the field. Pick strip, passthrough (`z.looseObject`) or reject per path (write vs pull) and test it — done when: a test shows an event carrying an unknown payload key survives pull, edit and push unchanged (or is rejected, whichever is decided), revisit at P1-04 at the latest — decided in P1-04: strict on what this app writes (unknown fields rejected), lossless on what it stores (unknown fields kept, patches send only changed fields)
- [ ] P1-F2 round-trip test fixture per activity module has no owner — found during P1-01 — SDD 15.3 requires a round-trip test fixture per activity module, but no task in the current build plan explicitly owns adding it. The completeness test (src/domain/activities/completeness.test.ts) checks schema and i18n key presence only, per P1-01's scope. Needs a home — likely alongside whichever task last touches each module's shape, or as its own pass once all modules have LogSheet/summarize (after P3-12). Revisit when scoping P1-11 or P3-13, whichever comes first.
- [x] P1-F3 `feat(app): run local migrations at startup before the first screen` — found during P1-03 — `migrateLocalDb(openLocalDb())` in src/db/client.ts exists and bundles (checked with a throwaway `expo export`), but nothing calls it yet. It needs a place in the root layout that holds the first screen until migrations finish and shows an error state if they fail (i18n strings) — done when: a fresh install and an app update both reach the home screen with the schema at the latest migration. Likely lands with P1-04, the first task that reads or writes the DB — done in P1-06: DatabaseGate in app/_layout.tsx
- [x] P1-F4 read the local placeholder ids from meta — found during P1-03 — migration 0001 seeds `local_household_id`, `local_baby_id` and `local_user_id` (keys in src/db/meta.ts). P1-04's repository needs them for `household_id`, `baby_id`, `created_by` and `updated_by` on every event, and whatever creates the baby profile must insert its `babies` row with `local_baby_id` rather than a new id — done when: an event written by the repository carries the three ids from meta. Repository code, so it belongs to P1-04, not P1-03
- [x] P1-F5 `fix(deps): add react-native-web and @expo/metro-runtime for web preview` — found during P1-03 review — react-native-web was never a committed dependency, so browser preview only worked via an uncommitted local install; on a clean `npm ci`, `npx expo export --platform web` fails with `Unable to resolve module react-native-web/dist/index` — done when: `npx expo export --platform web` succeeds on a clean checkout and `expo start --web` renders the home placeholder, /tokens and /primitives
- [x] P1-F6 home placeholder text is unreadable in night theme — found during P1-F5 — `app/index.tsx` renders an unthemed `<Text>`, so with the OS in dark mode it is near-black on the night background (seen in `expo start --web`). The placeholder is replaced by the real home screen in P1-06 — done when: the home screen's text uses theme colours and is readable in both themes — done: the placeholder was replaced by the themed home screen in P1-06 (#16)
- [x] P1-F7 web preview stops working once a screen touches the database — found during P1-04 — tested for real with a throwaway screen doing migrate, insert and list through the repository under `expo start --web`. Blocker 1: `SharedArrayBuffer is not defined`; expo-sqlite's web build needs a cross-origin isolated page, and Metro's `enhanceMiddleware` adds COOP/COEP to bundles but not to the HTML Expo's dev server serves, so the page is never isolated. Blocker 2: with isolation forced through a local header proxy (`crossOriginIsolated` true), the first synchronous SQLite call fails with `Sync operation timeout` and the WASM file is never requested; an async warm-up query first did not help. The repository is synchronous by design (drizzle sync driver), so this is not a config fix. Options, your call: (a) a web-only database adapter on sql.js behind the same repository (sql.js already runs our migrations in tests and needs no SharedArrayBuffer), (b) make the repository async everywhere, (c) review screens on a dev build or simulator only. Until decided, screens from P1-06 on can't be previewed in a browser; their behaviour is covered by RNTL tests against real SQLite (sql.js) — done: option (a), an in-memory SQLite stand-in in src/db/client.web.ts (web bundles only), with a banner and console warning while in use
- [x] P1-F8 breast feeds logged from the feed sheet carry no duration — found during P1-05 review — Stats.breastMs (breastfeeding time, kept separate from bottle mL) is the per-side seconds when recorded, else ended_at minus occurred_at, else 0. The P1-07 feed sheet saves breast feeds with neither, so every sheet-logged breast feed counts 0 minutes. Needs a duration input, a start/stop, or per-side timers on the breast part of the sheet (your call which) — done when: a breast feed logged from the sheet contributes its duration to breastMs — decided: a duration stepper, tracked as P1-19; done in P1-19
- [ ] P1-F9 SDD deviations approved in P1-10, to fold into the SDD — found during P1-10 — (1) §7 lists `log/health` but no medication route; P1-10 added `log/medication` as its own modal sheet. (2) §4.1 has the health payload's `note` always required; it is now optional, and a health entry needs a note, a temperature, or both (schema refine plus the sheet's save guard), so a temperature can be logged on its own. Not a blocker, just keeping the doc honest — done when: SDD §7's route table lists `log/medication` and §4.1's health row reads `{ note?: string 1..500, temp_c?: number 34..43, tags?: enum[] }, note or temp_c required`
- [x] P1-F10 home doesn't show breastfeeding time — found during P1-19 — today's breastMs is computed (P1-05) and now filled by the feed sheet (P1-19), but the today strip shows only feeds, mL, wet and dirty, so a breastfeeding family sees 0 mL and no minutes. Adding a stat to home is a UI decision (label, format such as "45m breastfeeding", whether it replaces or joins mL) — done when: home shows today's breastfeeding time next to the bottle mL, both as separate figures — done: a Breastfeeding figure beside mL in the today strip
- [ ] P1-F11 web preview: first tap on a home action after a fresh page load does nothing — found during P1-19 — the second tap opens the sheet. Seen only in `expo start --web` (dev server bundles each route lazily on first use); not seen in tests and not expected on device. Low priority, dev-preview only — done when: a first tap after a fresh load opens the sheet, or the cause is confirmed as dev-only lazy bundling and documented
- [x] P1-F12 dates use US order in English — found during P1-11 — history day headings format with the i18n language `en`, which Intl renders as "Friday, October 23". English in Cyprus usually reads "Friday 23 October" (en-GB). Options: format English dates as en-GB, or use the device region from expo-localization. Your call; Greek formats come with P4-04 — done when: English dates follow the chosen convention, with a test — done: English dates display as en-GB via dateLocale() in src/i18n

---

## Phase 2 — Households and sync

Gate to move on: two phones in airplane mode log 20 entries each, reconnect, both screens match.

- [ ] P2-01 `feat(db-server): migrations for households, memberships, babies, events, invites, seq trigger` — depends: P0-08 — done when: `supabase db reset` builds schema from zero
- [ ] P2-02 `feat(db-server): rls policies and helper functions` — depends: P2-01 — done when: policies match SDD table 4.3
- [ ] P2-03 `test(db-server): pgtap tests for every rls cell` — depends: P2-02 — done when: a viewer can't insert, a stranger can't select, CI runs them
- [ ] P2-04 `feat(auth): email otp sign in, session in securestore` — depends: P0-08 — done when: sign in, kill app, still signed in
- [ ] P2-05 `feat(household): create_household rpc and onboarding flow with baby details` — depends: P2-02, P2-04 — done when: new user ends on home with an empty baby
- [ ] P2-06 `feat(household): invites, create code, share link, accept_invite rpc, join route` — depends: P2-05 — done when: second phone joins through the link, role applied
- [ ] P2-07 `feat(sync): push_events rpc with insert, patch, delete semantics` — depends: P2-02 — done when: SQL tests for idempotent insert, per-field patch, delete wins
- [ ] P2-08 `feat(sync): client push with batching, backoff, rejected-op handling` — depends: P1-04, P2-07 — done when: outbox drains, rejected ops appear in sync status
- [ ] P2-09 `feat(sync): client pull by cursor with pending-op protection` — depends: P2-08 — done when: unsent local edit survives a pull of an older server copy
- [ ] P2-10 `feat(sync): realtime ping, foreground, reconnect and interval triggers` — depends: P2-09 — done when: phone B updates within 3s of phone A
- [ ] P2-11 `feat(sync): migrate local-only data into a new household on first sign in` — depends: P2-09 — done when: a P1 user keeps all history after signing up
- [ ] P2-12 `feat(home): author on every row, last entry by line, caregivers list` — depends: P2-06, P2-10 — done when: rows read "You" or the other person's name
- [ ] P2-13 `feat(settings): sync status screen with pending count, last sync, errors` — depends: P2-08 — done when: visible pending count goes to zero when online
- [ ] P2-14 `test(sync): convergence property test with random interleavings` — depends: P2-09 — done when: 1,000 random runs, two simulated clients, identical derived state
- [ ] P2-15 `test(manual): two phone airplane mode checklist in docs` — depends: P2-10 — done when: checklist passes and is committed

### Found while working (P2)

---

## Phase 3 — POC complete

Gate to move on: 14 day household dogfood starts.

- [ ] P3-01 `feat(domain): milk stock fold, fifo, oldest batch age` — depends: P1-01 — done when: tests for pump in, take out, adjust, negative clamp
- [ ] P3-02 `feat(log): pump sheet and from-stock option on bottle feed` — depends: P3-01, P1-07 — done when: fridge total drops on both phones after a feed
- [ ] P3-03 `feat(home): stock card with adjust sheet` — depends: P3-02 — done when: adjust reason saved
- [ ] P3-04 `feat(domain): weight series and regain view model` — depends: P1-01 — done when: tests with a real-shaped day 0 to 21 fixture
- [ ] P3-05 `feat(insights): weight log and regain chart` — depends: P3-04 — done when: reference lines at 90% and 100%, day 10 and 14 markers, no judging copy
- [ ] P3-06 `feat(domain): report builder for call script, 24h, 3d, 7d` — depends: P1-05, P3-04 — done when: snapshot tests of report objects
- [ ] P3-07 `feat(report): call script screen in large type` — depends: P3-06 — done when: readable at arm's length, night mode supported
- [ ] P3-08 `feat(report): pdf template and share` — depends: P3-06 — done when: PDF opens on iOS and Android share sheets, one page for 24h
- [ ] P3-09 `feat(privacy): consent screen, versioned consent rpc, block health writes without consent` — depends: P2-04 — done when: no event can sync for a user without a consent row
- [ ] P3-10 `docs: in-app medical disclaimer and copy review against never list` — depends: P3-07 — done when: every string checked, no advice language
- [ ] P3-12 `feat(appointments): add, edit, home card, questions list, reminders day-before and 1h before` — depends: P1-04, P1-14 — done when: appointment shows on both phones, both reminders fire on a real device
- [ ] P3-13 `feat(report): questions-to-ask pulled into the call script` — depends: P3-07, P3-12 — done when: questions saved on the next appointment appear at the end of the script
- [ ] P3-11 `release: preview builds to both phones, start 14 day dogfood` — depends: all P3 above — done when: both caregivers logging, diary of issues opened

**Dogfood gate:** run 14 days. Log every friction point as a GitHub issue labelled `dogfood`. Fix the ones that caused a missed or doubled log before P4.

### Found while working (P3)

---

## Phase 4 — Beta

Gate to move on: 5 households recruited and onboarded.

- [ ] P4-01 `feat(sync): duplicate feed detection banner` — depends: P2-10
- [ ] P4-02 `feat(push): push token registration and notify-caregivers edge function, content free, opt-in` — depends: P2-10
- [ ] P4-03 `chore(arch): enforce layer boundaries with eslint import rules and dependency-cruiser in CI` — depends: P3-12
- [ ] P4-04 `feat(i18n): greek locale and date formats, language switch` — depends: P0-07
- [ ] P4-05 `feat(privacy): export all household data as json and csv` — depends: P2-09
- [ ] P4-06 `feat(privacy): leave household, delete account, delete household with cascade` — depends: P2-06
- [ ] P4-07 `feat(household): roles management, remove caregiver, viewer role UI` — depends: P2-06
- [ ] P4-08 `chore(obs): sentry eu region, pii scrubbing, no breadcrumbs with payloads` — depends: P0-09
- [ ] P4-09 `feat(onboarding): first run polish, empty states, permission explanations` — depends: P2-05
- [ ] P4-10 `feat(settings): baby profile edit, multiple babies in schema only` — depends: P2-05
- [ ] P4-11 `docs: dpia, records of processing, retention policy, processor list` — depends: P3-09
- [ ] P4-12 `build: testflight and play internal testing tracks, eas update channel` — depends: P0-09
- [ ] P4-13 `feat(feedback): in-app feedback form to a supabase table, no third party` — depends: P2-04

### Found while working (P4)

---

## Phase 5 — v1

Gate to move on: beta retention criteria met (research doc section 6).

- [ ] P5-01 `feat(ios): live activity for time since last feed (native module via config plugin)` — depends: P1-05
- [ ] P5-02 `feat(widgets): home screen widget ios and android` — depends: P1-05
- [ ] P5-03 `feat(security): sqlcipher evaluation and decision recorded as ADR` — depends: P1-03
- [ ] P5-04 `feat(account): sign in with apple and google` — depends: P2-04
- [ ] P5-05 `feat(billing): decision implemented (see ADR-008)` — depends: beta results
- [ ] P5-06 `docs: privacy policy, terms, store listing copy, screenshots` — depends: P4-11
- [ ] P5-07 `release: production submit to app store and play` — depends: all above

### Found while working (P5)
