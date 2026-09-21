# Running Claude Code as a Repeating Build/Test/QA Loop

Goal: Claude Code works through the SDD's commit list continuously — pick a task, implement it, test it, open a PR, move to the next — without you sitting there prompting each one. A human gate stays in front of `main` and in front of anything security- or data-sensitive. That's not a compromise on "full time"; it's what makes full time survivable for a solo project.

---

## 1. The mental model

```
┌─────────────────────────────────────────────────────────┐
│  LOOP (automatic, runs continuously or on a schedule)     │
│                                                             │
│  pick next task → branch → implement → test → commit      │
│  → push → open PR → update task board → repeat            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  GATE (you, in seconds to minutes, not hours)              │
│                                                             │
│  CI is green already (loop won't open a PR otherwise)      │
│  you skim the diff, click merge — or reject with a note    │
└─────────────────────────────────────────────────────────┘
```

Everything left of the gate can run unattended. Nothing crosses the gate without your click. That single rule is what makes this safe to leave running overnight.

A few things never get automated at all, regardless of how well the loop is running:
- Database migrations touching RLS policies (P2 series) — read the diff yourself, every time.
- Anything in `supabase/migrations/` applied to staging or prod — CI applies to staging on merge, but *you* trigger the prod apply manually per the SDD's branching rules.
- App Store / Play Store submission.
- Real-device and manual test checklists (section 11 of the SDD) — the agent can't hold your iPhone.

---

## 2. The five pieces

### Piece 1 — A task board the agent reads and writes

Turn the SDD's commit table (section 10.3) into a literal checklist file the agent updates as it works. This is the single most important piece: without it, "pick the next task" has no ground truth and the agent will guess, drift, or redo work.

Create `docs/TASKS.md`:

```markdown
# Task Board

Status: pending | in_progress | blocked | done
Rule for the agent: work top to bottom within a phase. Skip anything
whose "depends" isn't done. Never mark something done without its
"done when" condition being actually true (tests passing, not "should work").

## Phase 0

- [ ] P0-01 chore: init expo app — depends: none
- [ ] P0-02 chore: eslint/prettier/husky — depends: P0-01
- [ ] P0-03 chore: jest setup — depends: P0-01
...
```

Generate the full file once from SDD section 10.3 (I can do this for you now if you want — say the word and I'll produce it from the doc directly rather than you retyping 60-odd rows).

### Piece 2 — A protected `main` and a PR-only workflow

On GitHub: Settings → Branches → add a rule for `main`:
- Require a pull request before merging.
- Require status checks to pass (lint, typecheck, unit, pgTAP — these exist once P0-04 lands).
- Do not allow direct pushes, including from you, ideally — it keeps the habit consistent.

This is what makes "CI is green" a real gate instead of a suggestion.

### Piece 3 — The loop instruction itself

This goes in `CLAUDE.md` (which P0-01 already creates) as a section the agent reads every session, or as a dedicated slash command at `.claude/commands/next-task.md` that you or a scheduler invoke to run exactly one iteration.

```markdown
## Autonomous task loop

When invoked with `/next-task`, do exactly one iteration:

1. Read docs/TASKS.md. Find the first task with status `pending` whose
   `depends` are all `done`. If none exists, stop and report why
   (phase gate not met, or everything done).
2. Mark it `in_progress` in TASKS.md and commit that change alone,
   directly, with message `chore: start <ID>`.
3. Create a branch named after the task ID, e.g. `p1-07-feed-sheet`.
4. Implement only what that task's SDD entry describes. Do not fix
   unrelated things you notice — note them as a new TASKS.md line
   under "Found while working" instead, status `pending`.
5. Write or update tests per section 11 of the SDD for anything in
   src/domain, src/db, or supabase/.
6. Run the full local check: lint, typecheck, unit tests, and pgTAP
   if the task touched supabase/. Do not proceed if anything fails —
   fix it or stop and report, never open a PR on red.
7. Commit with a conventional commit message matching the task's
   commit description, plus the attribution lines from the system
   reminder.
8. Push the branch. Open a PR against main. PR description: the
   task ID, its "done when" condition, and how you verified it.
9. Mark the task `done` in TASKS.md on the branch, included in the PR.
10. Stop. Do not start the next task in the same invocation unless
    explicitly told to loop.

Never touch: supabase/migrations/*.sql content for RLS policies
without flagging it clearly at the top of the PR description as
"SECURITY: review the policy change before merging." Never mark a
task done if its "done when" check wasn't actually run.
```

The "stop after one" rule in step 10 is deliberate. It's what turns this from an unsupervised agent into a fast, repeatable loop with a human still glancing at the throttle.

### Piece 4 — What actually triggers each iteration

Three options, increasing in throughput and in how much you have to trust it before you're comfortable:

**A. You trigger it.** Open Claude Code, type `/next-task`, walk away, come back to a PR. Repeat. Zero new infrastructure, full control, still fast — most of a phase's commits are 20 minutes to an hour each once you're not typing the brief yourself.

**B. Scheduled, still gated.** A GitHub Actions workflow on a timer runs Claude Code headlessly against the repo, does one `/next-task` iteration, opens the PR, stops. You wake up to PRs waiting for a merge click, not a codebase that changed itself.

```yaml
# .github/workflows/agent-loop.yml
name: agent-loop
on:
  schedule:
    - cron: "0 */3 * * *"   # every 3 hours — tune to your pace
  workflow_dispatch: {}       # lets you also trigger it by hand

jobs:
  next-task:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "/next-task"
          # restrict what it can do in CI — no push to main, PR only
```

Check the current `claude-code-action` docs for the exact input names before using this; the action's interface has been changing. The shape is right, the field names might drift.

**C. Auto-merge on green, for low-risk work only.** Once you trust the loop's judgement on a *category* of commit — pure UI work in `src/ui`, or domain logic with full test coverage — you could let CI auto-merge those specific PRs when checks pass, using a path filter so the rule only applies to that category. I'd hold off on this until you've watched 15 to 20 PRs come through manually and trust the pattern. Never apply it to anything in `supabase/` or `src/sync`.

Start with A for phase 0 and most of phase 1 — it's genuinely fast enough by hand, and it's how you'll notice if the loop instruction itself needs fixing before you scale it up. Move to B once the pattern feels boring, which is the correct sign to automate the trigger.

### Piece 5 — QA and release, specifically

"QA" in the loop means: unit tests, the pgTAP RLS suite, and lint/typecheck — all of which the agent runs on every task per step 6 above, no exceptions. It does **not** mean the Maestro E2E flows or the two-phone manual checklist from SDD section 11 — those need real devices in your hand. Have the agent flag in the PR description when a task's "done when" condition includes a manual check ("needs your iPhone: confirm notification fires at the right minute"), so it's visible rather than silently skipped.

"Release" stays entirely manual through the whole POC. EAS preview builds can be triggered by the loop at the end of a phase (that's already how P0-09, P1-18, P3-11 are written in the SDD), but production submission is a deliberate, separate action you take, never something a schedule fires off.

---

## 3. Setup order

1. Say the word and I'll generate `docs/TASKS.md` from the SDD's commit table now, so it exists before Claude Code's first session.
2. Protect `main` on GitHub (branch rule, require PR + status checks).
3. Add the loop section to `CLAUDE.md` at P0-01 — fold it into that same commit rather than a separate one.
4. Run the loop by hand (option A) through phase 0 and into phase 1. Watch what it produces.
5. Once it's boring, wire up option B for scheduled runs.
6. Reassess auto-merge (option C) only after that, and only for the narrow categories named above.

---

## 4. The one habit that matters most

Read every PR description before you merge, even once this is running on a schedule and even once it feels routine. The "done when" condition in the SDD is what stops "looks right" from quietly becoming "wasn't tested." The loop enforces that discipline on the agent's side; reading the PR is what enforces it on yours.
