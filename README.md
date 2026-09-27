# moraki.app

App for 40 first days of a new born.

Expo (React Native, TypeScript) with a Supabase EU backend. The app is
local-first: SQLite is what every screen reads, and sync fills it in.

- What it is and why: `docs/01-research-and-poc-scope.md`
- How it is built: `docs/02-sdd-and-build-plan.md`
- What is next: `docs/TASKS.md`
- How the build loop runs: `docs/04-agent-loop-guide.md`

## Running it

```bash
npm install
npm start          # Expo dev server; press w for the web preview
npm test           # unit and screen tests
npm run test:tz    # the same suite under three timezones, as CI runs it
npm run lint
```

## Crash reporting

Off by default. With `EXPO_PUBLIC_SENTRY_DSN` set, the app sends crashes to
Sentry; with nothing set — every local run, every test — it sends nothing.

The DSN must be an **EU** project (`*.ingest.de.sentry.io`). Anything else
throws at startup rather than shipping reports out of the EU (SDD 12.1).

What a report carries: the exception, the stack frames, the build, the device
and OS, and the last few navigation steps. What it never carries: the user, the
IP address, request or response bodies, console logs, route params, quoted text
from an error message, or any field this app has not explicitly allowed
(`src/observability/scrub.ts`). Rule 8 is enforced there, in tests, not by
Sentry's own settings.

For a build made by EAS, the same two variables have to exist as EAS
environment variables as well — `.env` is only read locally.

## The database and sign in

The app can be pointed at either the hosted Supabase project or a local one.
`.env` decides (copy `.env.example`); Expo bakes those values into the bundle,
so **restart with `npx expo start -c` after changing them**.

```bash
supabase start     # local Postgres, auth and a mail catcher
supabase db reset  # apply migrations from zero
supabase test db   # pgTAP: schema, policies, RPCs
npm run test:local # real sign in and invites against the local stack
npm run seed:dogfood # a realistic household to look at -- see below
```

**`npm run seed:dogfood`** fills the local database with one household's
worth of a real-looking 100-day newborn history — feeds, diapers, sleep,
weight with the early dip and regain, a couple of appointments, over 2,000
events from two caregivers — so History, Insights and the stock card have
something real to scroll through instead of an empty app. Safe to re-run any
time; it clears its own household first. It is `supabase/seed-dogfood.sql`,
not `supabase/seed.sql` on purpose: that filename auto-loads on every
`supabase db reset`, which runs right before `supabase test db` both locally
and in CI, and several pgTAP assertions count rows with no filter — seed data
sitting there permanently would throw every one of those off. Pull the
household to a phone and there are enough events on it to run P1-11's own
60fps scroll check for real.

Moraki does not use the Supabase CLI's usual ports (see `supabase/config.toml`):

| What                | Where                                                   |
| ------------------- | ------------------------------------------------------- |
| API                 | http://127.0.0.1:55321                                  |
| Database            | postgresql://postgres:postgres@127.0.0.1:55322/postgres |
| Studio              | http://127.0.0.1:55323                                  |
| Sign-in code emails | http://127.0.0.1:55324                                  |

**Reading a sign-in code.** Codes come from whichever project `.env` points at,
so read them in the same place: the local mail catcher above, or the real
inbox for the hosted project. On this machine port 54324 belongs to a
different project's stack, so opening it shows the wrong mailbox rather than
an error.

**Testing on a phone.** In Expo Go, `localhost` means the phone. Point `.env`
at the Mac's LAN address (`http://192.168.x.x:55321`) and read codes at
`http://192.168.x.x:55324`; the local stack already listens on all
interfaces. Against the hosted project this doesn't apply, but its emails
depend on its own SMTP settings.

**Code length.** A Supabase project sends a 6 to 10 digit code, set per
project; the local stack sends 6. The app accepts any length in that range.
