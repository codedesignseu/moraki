# Two phones, one baby: the manual pass

SDD 11's manual row, for the end of Phase 2. Everything here is what no test
on a laptop can answer: two real phones, real airplane mode, a real app kill,
a real reboot.

Run it once per phase, and whenever sync changes. Record the date, the two
devices, and the app version, then tick each line or write what happened
instead. A line that fails is a task in `TASKS.md`, not a note here.

| Run | Date       | Phone A        | Phone B             | App version | Result                                                             |
| --- | ---------- | -------------- | ------------------- | ----------- | ------------------------------------------------------------------ |
| 1   | 2026-09-27 | iPhone (owner) | iPhone (2nd tester) | preview     | Pass, except §4 and §8's expectations — see notes below and P3-F13 |

## Before you start

- Two phones, each signed in as a different account, both in one household:
  A set it up (P2-05), B joined through the invite link (P2-06).
- Both on the same baby, both showing the same entries to begin with.
- Know where **Settings → Sharing** is: it says what is waiting, when the
  phone last sent, and anything the server refused.

## 1. Both offline, both logging

1. Put **both** phones in airplane mode.
2. On A, log 20 entries of different kinds: feeds, diapers, a sleep started
   and stopped, a health note with a temperature.
3. On B, log 20 of its own, overlapping in time with A's.
4. Check on each phone: every entry is on Home and in History, the today
   strip counts them, and Settings → Sharing says they are waiting.
5. Turn airplane mode off on both.
6. Within a few seconds, without touching anything: each phone shows the
   other's 20 entries, both lists match top to bottom, and Sharing says
   everything is sent on both.

- [X ] Both phones show all 40 entries, in the same order
- [ X] The today strip and the trends match on both
- [ X] Sharing shows nothing waiting, and no refusals

## 2. One offline, one logging

1. Airplane mode on **B only**.
2. On A, log five entries and edit one of them.
3. On B, log two entries and delete one of its own.
4. Take B off airplane mode.
5. Both phones agree again, including A's edit and B's deletion.

- [x] A's edit is on B, with the edited value
- [X ] B's deleted entry is gone from both, and does not come back
- [X ] Neither phone lost anything it logged while apart

## 3. An edit made offline, changed elsewhere

1. Airplane mode on **A**.
2. On A, change a bottle's amount, and clear a health note's temperature.
3. On B (online), change the **milk** on that same bottle.
4. Take A off airplane mode.
5. Both phones end with A's amount **and** B's milk, and the temperature
   stays cleared on both.

- [x ] A's amount survived
- [ x] B's milk change survived
- [ x] The cleared temperature did not come back

## 4. Undo, and a delete that has not been sent

1. On A, log a feed, then use **Undo** in the toast straight away.
2. The entry may briefly appear on B, then disappear within a few seconds.
3. On A, delete an older entry and wait for the toast to pass.
4. It disappears from both phones.

- [x] An undone entry may flash on the other phone before it goes -> confirmed
      2026-09-27: it reached phone B and disappeared ~2s later. Traced and
      correct, not a bug — only a _delete_ op carries the 6s undo hold
      (`UNDO_WINDOW_MS` in `src/db/repositories/events.ts`); a fresh insert has
      none, so it can sync before Undo is even tapped. Undoing it then queues a
      held delete, which is what disappears a moment later. Delaying every
      insert to match would slow ordinary sharing for everyone, which the app
      promises happens "usually within seconds" (About screen) — decided
      2026-09-27 to leave as built. Revisit only if this actually confuses a
      real caregiver.
- [x] A kept deletion reaches it

## 5. Killing the app

1. On A, start a sleep.
2. Force-quit A, wait a minute, reopen it.
3. The running sleep is still there, timing from the original start.
4. Stop it; B shows the finished sleep with the right length.

- [ x] The running sleep survives a kill
- [ x] Both phones agree about it afterwards

## 6. Reboot, and a cold start with no signal

1. Log two entries on B, then restart the phone with airplane mode **on**.
2. Open the app before turning the radio back on: every entry is there, the
   app works, Sharing says what is waiting.
3. Turn the radio on: the waiting entries go, both phones agree.

- [x ] Nothing was lost across a reboot
- [x ] The app was fully usable with no connection
- [ x] It caught up by itself once the connection returned

## 7. Signing in, with a history already on the phone

Use a **third** phone, or sign out of B and use a fresh account.

1. Before signing in, log five entries.
2. Sign in and join the household through an invite link.
3. Settings asks what to do with the five entries.
4. Choose **Add them to the household**: all five appear on the other phone,
   attributed to the new caregiver.
5. Repeat with **Not now** on another phone: nothing is shared, and the five
   entries stay on that phone, still visible.

- [x ] The question appears, once
- [x ] "Add them" keeps all five and shares them
- [ x] "Not now" leaves the phone exactly as it was

## 8. Roles

1. From A, invite someone as **View only** and accept on the other phone.
2. That phone shows the household's entries but cannot log or edit.
3. Sharing on that phone shows nothing refused (it never tried).

- [x] A demoted caregiver's edit reaches nobody -> confirmed 2026-09-27: the
      client has no role check anywhere (rule 1, local-first — nothing waits
      on the network to act), so a demoted or view-only person can always tap
      Log or Edit and see it on their own phone. The write never leaves that
      phone: Sharing correctly showed **"Not sent — this phone wasn't allowed
      to send it"**, and `can_write()` reads the live server-side role at
      push time (`security definer`, checked in the migration, not a client
      cache), so nothing reached the other phone. Not a security issue. What
      it lacks is a message _at the moment of editing_, rather than only in
      Sharing afterwards — decided 2026-09-27 to leave as built, revisit if a
      real caregiver finds the silence confusing.
- [ ] A viewer cannot log or edit -> covered by the line above; not separately
      timed, since editing was the thing tested
- [ ] No refusals appear from simply viewing -> not retested this run: still
      to check with the account actually set as viewer rather than demoted

## 9. Who logged what

1. Entries logged on A read as A's name on B, and "You" on A.
2. Home says "Last entry by …" when the newest entry came from the other
   phone.
3. Settings lists both caregivers and what each may do.

- [X ] Names, not ids, on every row
- [X ] The last-entry line names the other caregiver

## 10. A long time apart

1. Airplane mode on B for a few hours of real use on A (or set B's clock
   forward after reconnecting, whichever you can do honestly).
2. Reconnect B: it catches up in one go, in order, with nothing missing and
   nothing duplicated.

- [X ] B caught up completely
- [X ] No entry appeared twice

## Notes for the run

Write down anything surprising: how long a catch-up took, a screen that
flickered, wording that read wrong at 3am. Those become tasks.

**2026-09-27.** Sync itself was live and correct throughout — the one thing
that had looked broken beforehand was one phone's consent not yet agreed
(P3-09 blocks health writes from syncing with no consent row, by design; it
looks exactly like "sync doesn't work" until you check Settings → Privacy).

One real bug, found and fixed: an appointment booked weeks out showed on
Home's Recent list as "402 days ago" instead of a future date — P3-F13, PR
#97. Two things looked like bugs and turned out to be the architecture
working as designed, both decided to leave as built for now: an undo can let
a just-logged entry flash on the other phone before it's removed (§4), and a
role change takes effect on the server immediately but a demoted phone can
still edit locally, silently, until it checks Sharing (§8). Neither reaches
the other phone wrongly; both are logged on the board in case a real
caregiver finds either confusing.
