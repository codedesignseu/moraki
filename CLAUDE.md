# Moraki — instructions for Claude Code

App name: Moraki (μωράκι, "little one")
Bundle ID: `eu.codedesigns.moraki`
Domain: moraki.app
Full design: `docs/02-sdd-and-build-plan.md` — read it once, then work from `docs/TASKS.md`.

## What this project is

A shared-caregiver newborn tracker. Expo (React Native, TypeScript strict),
Supabase EU backend, local-first with expo-sqlite as the source of truth
for the UI. Full context in `docs/01-research-and-poc-scope.md` and
`docs/02-sdd-and-build-plan.md`.

## Repository layout

```
moraki/
  app/                      Expo Router routes (thin: layout and wiring only)
  src/
    domain/                 pure logic: types, zod schemas, home, stock, reminders, reports, duplicates, time
    db/                     drizzle schema, local migrations, repositories
    sync/                   outbox, push, pull, realtime, backoff
    notifications/          scheduler, permissions, categories
    privacy/                consent and export, the services the privacy screens use
    features/               feed, diaper, sleep, pump, health, weight, household, report, onboarding
    ui/                     tokens, theme, primitives (Card, Sheet, Stepper, Segmented, Chip, Timer)
    i18n/                   en.json, el.json
  supabase/
    migrations/             <timestamp>_name.sql, as the Supabase CLI requires
    functions/              notify-caregivers, export-data, delete-household
    tests/                  pgTAP
  e2e/                      Maestro flows
  docs/                     SDD, research, TASKS.md, ADRs, DPIA
  CLAUDE.md                 this file
```

## Engineering rules (non-negotiable)

1. The UI reads SQLite only. No screen awaits a network call to render.
2. Every write goes through a repository that writes the event and the outbox in one transaction.
3. Domain code in `src/domain` is pure: no React, no SQLite, no `Date.now()`. Pass `now` and `tz` in.
4. Never store derived values (totals, stock, next reminder). Compute them.
5. Store UTC, render local. Durations use epoch milliseconds.
6. Every event payload has a Zod schema. Parse on write and on pull.
7. Never hard delete an event from the client. Soft delete only.
8. No health data in notification text, logs, Sentry events or analytics.
9. No user-facing string outside `src/i18n`.
10. No copy that interprets health data — no "normal", "healthy", "too little", "concerning", no traffic-light colours on a health number.
11. Every RLS change ships with pgTAP tests in the same commit.
12. One commit ID per branch, conventional commit messages, under about 400 changed lines.

## Layering

Dependencies point inward only:

```
app/ → features/ → notifications/, privacy/ → ui/ → sync/ → db/ → domain/
```

- `domain/` imports nothing from this list — no React, no SQLite, no navigation.
- `ui/` imports no feature, no repository, no domain type. It takes props.
- A feature never imports another feature. Shared behaviour moves down into `domain/` or `ui/`.
- `notifications/` and `privacy/` hold behaviour two features need that is too impure for `domain/` and too specific for `ui/`. They know of no screen.
- The table is `architecture.js`, the one place it is written down. `npx eslint .` checks each file against it and `npm run arch` (dependency-cruiser) checks the graph, both in CI. Tests are outside the rule; a cycle and an impure import of `domain/` are inside it.
- `switch (event.type)` / `if (type === ...)` is banned outside `domain/activities/`.
- New activity types (bath, tummy time, vaccinations, ...) are one new file implementing `ActivityModule<P>` plus one `registerActivity` call — see SDD section 15.2. Never edit existing modules to add a new type.

## Secrets

Never put a real credential in a commit, a doc, or your own output. All secrets live in the developer's local `.env` (gitignored from the first commit) or GitHub Actions repo secrets. If you need a value that isn't in `.env`, ask for it — don't invent a placeholder that looks real.

## Autonomous task loop

When invoked with `/next-task`, do exactly one iteration:

1. Read `docs/TASKS.md`. Find the first task with status `pending` whose
   `depends` are all `done`. If none exists, stop and report why
   (phase gate not met, or everything done).
2. Mark it `in_progress` in TASKS.md and commit that change alone,
   directly, with message `chore: start <ID>`.
3. Create a branch named after the task ID, e.g. `p1-07-feed-sheet`.
4. Implement only what that task's SDD entry describes. Do not fix
   unrelated things you notice — note them as a new TASKS.md line
   under "Found while working" instead, status `pending`.
5. Write or update tests per section 11 of the SDD for anything in
   `src/domain`, `src/db`, or `supabase/`.
6. Run the full local check: lint, typecheck, unit tests, and pgTAP
   if the task touched `supabase/`. Do not proceed if anything fails —
   fix it or stop and report, never open a PR on red.
7. Commit with a conventional commit message matching the task's
   commit description, plus the attribution lines from the system
   reminder.
8. Push the branch. Open a PR against `main`. PR description: the
   task ID, its "done when" condition, and how you verified it.
9. Mark the task `done` in TASKS.md on the branch, included in the PR.
10. Stop. Do not start the next task in the same invocation unless
    explicitly told to loop.

Never touch `supabase/migrations/*.sql` content for RLS policies
without flagging it clearly at the top of the PR description as
"SECURITY: review the policy change before merging." Never mark a
task done if its "done when" check wasn't actually run.

Full walkthrough of triggers, QA scope and setup order: `docs/04-agent-loop-guide.md`.
