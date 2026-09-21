# P0-01 — everything for the first commit

Task: `chore: init expo app with typescript strict, expo-router, CLAUDE.md`
Done when: `npx expo start` runs, strict TS, engineering rules copied into CLAUDE.md.

This is the file manifest so Claude Code isn't guessing what "init" includes.
Two groups: what the Expo CLI generates for you, and what needs to be
added or edited by hand on top of that scaffold.

---

## 1. Run this first

```bash
npx create-expo-app@latest moraki --template blank-typescript
cd moraki
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

This generates the bulk of the project on its own:

- `package.json`, `package-lock.json`
- `app.json` (you'll overwrite this — see below)
- `tsconfig.json` (you'll overwrite this — see below)
- `babel.config.js`
- `.gitignore` (you'll append to this — see below)
- `App.tsx` or an `app/` starter, `assets/` (icon, splash placeholders)
- `index.ts` / entry point

## 2. Files to add or overwrite after the scaffold

All four are attached alongside this manifest — copy them in as-is, don't
retype them.

| File | Action | Why |
|---|---|---|
| `CLAUDE.md` | **new file**, project root | Engineering rules (SDD section 14), repo layout, layering rule, and the `/next-task` loop instruction. Claude Code reads this every session. |
| `tsconfig.json` | **overwrite** the generated one | Turns on `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and adds the `@/*` → `src/*` path alias used everywhere in the SDD's file layout. |
| `app.json` | **overwrite** the generated one | Sets the real name (Moraki), slug, bundle ID (`eu.codedesigns.moraki`) for both platforms, expo-router plugin, and typed routes. Replace the two placeholder colours (`#FAF7F2`) with your actual token values once P0-05 lands — it's a safe warm neutral for now, not a locked decision. |
| `.gitignore` additions | **append** to the generated `.gitignore` | Keeps `.env` and EAS/Supabase local state out of the repo from commit one. |

## 3. Files to convert from Expo Router's default structure

`create-expo-app --template blank-typescript` doesn't ship Expo Router's
file structure by default — after installing the packages above:

- Delete `App.tsx` (or the default entry) if the template created one.
- Create `app/_layout.tsx` — the root layout. For P0-01 this can be minimal:
  a `Stack` or `Slot` from `expo-router` with no real navigation logic yet
  (routes come in P1). This is deliberately thin per the CLAUDE.md rule
  that `app/` is "layout and wiring only."
- Create `app/index.tsx` — a placeholder home screen (can just render
  "Moraki" text) so `npx expo start` has something to boot into. Real
  content starts at P0-05/P1-06.
- In `package.json`, set `"main": "expo-router/entry"`.

## 4. Bring the docs into the repo

Copy these into the new project's `docs/` folder, so `docs/TASKS.md` and
the SDD exist in the repo Claude Code is actually working in, not just on
your machine:

- `01-research-and-poc-scope.md`
- `02-sdd-and-build-plan.md`
- `03-external-dependencies-checklist.md`
- `04-agent-loop-guide.md`
- `TASKS.md`
- `.env.example` — goes in the **project root**, not `docs/` (it's a template for the root `.env` a developer creates locally)

## 5. What P0-01 does *not* include

Don't let this commit grow past its scope — these are separate task IDs:

- ESLint/Prettier/Husky/commitlint → P0-02
- Jest → P0-03
- GitHub Actions CI → P0-04
- Design tokens and themes → P0-05
- UI primitives → P0-06
- i18next → P0-07
- Supabase folder/Docker → P0-08
- EAS build profiles → P0-09

If a task like this grows past ~400 changed lines (the rule in CLAUDE.md
rule 12), that's the signal something from the list above leaked in —
split it back out.

## 6. Verify before committing

```bash
npx expo start        # should boot with no red screen
npx tsc --noEmit       # should be clean under the new strict tsconfig
```

Then commit as one change: `chore: init expo app with typescript strict, expo-router, CLAUDE.md`.
