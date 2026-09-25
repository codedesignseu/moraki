# Copy review against the never list

**Task:** P3-10. **Date:** 2026-09-23. **Reviewed:** every string in
`src/i18n/en.json` — 410 of them, the whole of the app's copy, since no
user-facing string may live outside i18n (rule 9, enforced by lint).

## The rules being applied

From SDD 12.3:

> **Allowed:** counts, times, durations, what a caregiver typed, "Ask your
> pediatrician about feeding intervals."
> **Never:** "normal", "healthy", "too little", "concerning", "your baby
> should", any traffic-light colour on a health number.

And ADR-006 / SDD 12.2: the app records and summarises, and interprets
nothing, which is also what keeps it outside EU MDR.

## What was found

| Key                           | Was                                                      | Now                      | Why                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `insights.none`               | "Not enough entries yet"                                 | "Nothing to average yet" | It sits where an average would be. The old wording reads as the entries falling short of a requirement; the new one says there is nothing to average, which is the fact. |
| `signIn.problem.rate_limited` | "Too many attempts. Wait a few minutes, then try again." | unchanged                | Matches `too many`, but counts sign-in attempts — the auth server refusing a request, not anything about the baby. Recorded as an exception in the test, by key.         |

Nothing else matched. In particular: no "normal", no "healthy", no
"concerning", no "should", no "recommend", no "diagnosis", no "treatment",
no grading word next to a figure.

## Where a judgement could have crept in, and what is there instead

| Place                         | What it says                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weight chart (P3-05)          | Points, 90% and 100% reference lines, day 10 and 14 marks, "Your pediatrician tracks this at check-ups." No colour, no shading, no verdict. A test asserts no judging word appears on the card. |
| Milk stock past empty (P3-03) | "More has gone out than went in. Check the count." — about the count, not the baby.                                                                                                             |
| Call script (P3-07)           | Labels and figures only. A test asserts no judging word appears on the screen.                                                                                                                  |
| The PDF (P3-08)               | Built from the same labels; a test walks the rendered document and checks every word came from a key or from something a person typed.                                                          |
| Notifications (SDD 6.2)       | No amount and no health figure in a body that shows on a lock screen; a test asserts no such placeholder appears in any notification string.                                                    |
| Temperature                   | Recorded and shown with its time. No range, no fever wording anywhere.                                                                                                                          |

## How this stays true

`src/i18n/copyRules.test.ts` walks every string on every run and fails on
the never list. Exceptions are listed by key with a reason, and two further
tests make sure an exception can't rot: the key must still exist, and it
must still match a pattern — an exception that stops being needed fails the
suite rather than lingering.

Adding a language means running the same test over the new file: the walk
takes the JSON, not the English.

## The disclaimer

`app/about.tsx`, reached from Settings, on its own screen rather than as a
line nobody reads at sign-up. It says the app is a notebook and not a
medical device, that it is not a substitute for a pediatrician, midwife or
nurse, that it never says what a number means and has no warnings, ranges or
colours on a figure, that the figures are for an appointment or a phone call,
and that a caregiver worried right now should contact a doctor or the local
emergency number rather than wait.

## The Greek pass (P4-04)

**Date:** 2026-09-25. **Reviewed:** every string in `src/i18n/el.json`, the
whole Greek translation, against its own never list in
`src/i18n/copyRules.test.ts`. A translation can break rule 10 while every
English string obeys it, so `describe.each` now runs the walk over each
shipped language with the patterns that language needs.

The Greek list is not the English one transliterated. What it bans:

| Pattern                            | Why                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `φυσιολογικ*`, `κανονικ*`          | How Greek says a measurement is "normal" — exactly the verdict this app never gives. `φυσιολογικό` is the one that matters most, and the English list has no equivalent to catch it. |
| `υγιής`, `υγιές`, `υγιειν*`        | Calls a figure healthy.                                                                                                                                                              |
| `πάρα πολλ*`, `πολύ λίγ*` and kin  | Judges an amount.                                                                                                                                                                    |
| `ανησυχητικ*`                      | Tells someone to be concerned. The verb (`ανησυχείς`) is not banned: a parent's own worry is theirs to name, as in `report.call.worry.title`.                                        |
| `θα πρέπει`, `συνιστούμε`          | Gives advice. Only the advice form: `log.sleep.backwards` says a sleep `πρέπει` to end after it starts, which is about the entry, not the baby.                                      |
| `διάγνωσ*`, `σύμπτωμα`, `θεραπεί*` | Reads as clinical.                                                                                                                                                                   |
| `ανεπαρκ*`, `υπερβολικ*`, `φτωχ*`  | Grades a figure.                                                                                                                                                                     |
| `πίσω/μπροστά από τον μέσο όρο`    | Compares to a norm.                                                                                                                                                                  |

One exception carries over by key: `signIn.problem.rate_limited`, "Πάρα
πολλές προσπάθειες", which counts sign-in attempts. The exception test
requires each exception to still match a pattern in **every** language, so a
Greek rewording that no longer needs it fails the suite.

Three further tests keep the two files honest with each other: every English
key exists in Greek (so no screen falls back mid-sentence), every `{{…}}`
survives translation (so no figure disappears from a sentence), and more than
90% of the strings actually differ from the English (so a partly copied file
cannot pass as a translation).
