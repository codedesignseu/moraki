# Open decisions

Choices made while you were away, each with what was built in the meantime and
what changes if you decide otherwise. Anything here can be reversed cheaply;
that is the point of writing it down rather than burying it in a PR.

Closed decisions live in the PR that settled them and in `TASKS.md`.

| #   | Decision                                                                  | Where | Status |
| --- | ------------------------------------------------------------------------- | ----- | ------ |
| D1  | A joiner with local entries is asked, and syncs nothing until they answer | P2-11 | open   |
| D2  | Moving local entries also rewrites who logged them                        | P2-11 | open   |

---

## D1 — A joiner with local entries is asked, and syncs nothing until they answer

**The situation.** Someone used the app alone for a while, then joined the
other parent's household. Their own history may overlap what the household
already has: the same feeds, logged twice, once on each phone.

**What you already decided (P2-06):** join now, ask later. Joining changes
nothing on the phone, and P2-11 asks once.

**What is open:** what "later" does to a phone that hasn't answered yet.

**What P2-11 does now.** Settings shows one question with two answers:

- _Add them to the household_ — the entries move: they are rewritten to the
  household and baby, attributed to this account, and sent. From then on the
  phone syncs normally.
- _Not now_ — nothing is touched and the phone keeps working exactly as it
  did: its own entries, its own ids, no syncing in either direction. The
  question stays in Settings until answered.

**Why not link first and move later.** The app lists entries for the baby the
phone belongs to. Linking without moving would make every earlier entry
vanish from Home and History while still sitting in the database. Better to
keep the phone whole and unsynced than to show a caregiver an empty history.

**If you'd rather.** Two alternatives, both small changes: move a joiner's
entries automatically, like a household creator's (simplest, but duplicates
show up for both parents); or link and sync the household while leaving the
old entries hidden until P4 gives them a home. The asking screen and the
migration itself stay either way.

---

## D2 — Moving local entries also rewrites who logged them

**The situation.** Entries made before signing in are attributed to the local
placeholder user that migration 0001 seeded. When they move into a household,
that id means nothing to anyone else.

**What P2-11 does now.** It rewrites `created_by` and `updated_by` on those
entries to the signed-in account, so they read as "You" on this phone and as
that person's name on the other one (P2-12). Entries pulled from the server
are left alone: only rows still carrying the placeholder are touched.

**Why.** The alternative is to send them with an unknown author, which the
server refuses (an insert must be authored by the caller), so they would all
land in sync errors. Rewriting is what makes the history survive at all.

**If you'd rather.** The entries could keep a note that they were made before
sharing, shown as "Logged before sharing" rather than as this person. That is
a copy and schema change, not a sync change.
