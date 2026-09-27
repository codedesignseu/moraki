# Data protection impact assessment

**Task:** P4-11. **Written:** 2026-09-26, against `809de78a` plus the branches open
that day. **Review due:** before the first household outside the developer's own
joins, and again before any public release.

**Not legal advice.** SDD 12.1 requires a Cyprus data protection lawyer to review
this before P5. It is written to be reviewed, not to stand in for the review.

---

## 1. Why a DPIA is required

Article 35(3) does not list this case outright, so the decision rests on the
Article 35(1) test and the criteria in WP248. Moraki meets several:

- **Special category data** — Article 9 health data: feeds, temperatures, medication, weight, free-text notes about a baby's condition.
- **Data concerning vulnerable data subjects** — a newborn, who cannot consent and whose parents consent for them.
- **Data processed on a large scale relative to the subject** — every few hours, for months, producing a detailed record of one infant's body and behaviour.
- **Innovative use** — a shared local-first record synchronised between several caregivers' phones.

Any one of the first two would justify it. Treating a DPIA as required is the
only defensible reading, which is what SDD 12.1 already says.

---

## 2. The processing, described plainly

A caregiver installs the app and logs what happens to a baby: feeds, diapers,
sleep, expressed milk, weight, temperature, medication, notes, appointments.
Everything is written to a local SQLite database first, so the app works with no
signal. When the phone has a connection, entries sync through a Supabase EU
project to the other caregivers in the same household, usually within seconds.

Nothing is inferred, scored, or compared to a norm. The app adds figures up and
shows them — 11 engineering rules and a lint rule exist to keep it that way
(SDD 12.2, 12.3, ADR-006), because interpreting those numbers would both
mislead a frightened parent and drag the app inside EU MDR.

Purposes, lawful bases, categories, recipients and security are set out in
[`records-of-processing.md`](./records-of-processing.md). Retention is in
[`retention.md`](./retention.md). Processors are in
[`processors.md`](./processors.md).

---

## 3. Necessity and proportionality

| Question                                     | Answer                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the processing necessary for the purpose? | Yes. A shared care record cannot exist without storing what happened and who logged it                                                                                                                                                                                                                                                                                                                    |
| Is health data necessary?                    | Yes, and it is the point. A parent asked to describe a feeding pattern on the phone to a clinic cannot do it from memory at 4am                                                                                                                                                                                                                                                                           |
| Is the amount minimised?                     | No location, no contacts, no photos, no advertising identifier, no analytics, no third-party SDK but the crash reporter. Display names rather than legal names. The baby's name is whatever the family types, usually a nickname                                                                                                                                                                          |
| Could it be less identifiable?               | The household's data could be end-to-end encrypted, which would prevent the controller reading it at all. Rejected for the POC: it breaks server-side validation (the consent gate and the immutable-column trigger both read rows), and key recovery for a sleep-deprived parent who reinstalls is a worse risk than the one it removes. Revisit at v1 — recorded as a design decision, not an oversight |
| Is consent freely given?                     | Yes. It is asked on its own screen, unbundled, with no pre-ticked box, and refusing leaves the app working locally. Withdrawal is one button and does not delete anything                                                                                                                                                                                                                                 |
| Is the retention justified?                  | A family's record of their newborn is what they came for, so entries are not trimmed on a schedule. Everything else has a period in `retention.md`                                                                                                                                                                                                                                                        |

---

## 4. Risks

Scored before mitigation, as **likelihood × severity to the data subject**.

### R1 — Someone joins a household they have no business in

_Medium × High._ An invite code is the only thing between a stranger and a
baby's health record.

Mitigated: 8 characters from a 30-character alphabet (~6.5 × 10¹¹
combinations), single use, 7-day expiry, revocable by the owner from the app
(P2-F8), and `accept_invite` runs as the caller under RLS. The invite message
carries a link a parent sends through their own messaging app.

Also mitigated as of 2026-09-27 (P2-F7): 20 attempts per rolling hour, per
user, enforced server-side and proven to survive every failed guess rather
than only counting the ones that happen to raise no exception — a genuine
constraint in Postgres/PostgREST this took real design work to get right, not
a rate limit bolted on top. An unthrottled endpoint was also a way to learn
whether a code exists; that channel is closed with it.

_Residual: Low._

### R2 — A phone is lost or stolen

_Medium × High._ The local database holds the household's full history in
plaintext SQLite, protected only by the platform's file encryption and the
device passcode.

Mitigated: the session token is in the OS keychain rather than the database; a
removed caregiver loses server access immediately (P4-07).

**Not mitigated:** no database encryption of our own — P5-03 is the decision on
SQLCipher, deliberately deferred. A phone with no passcode exposes everything to
whoever holds it. Removing a caregiver does not reach the copy already on their
phone, and cannot.

_Residual: Medium._ This is the largest residual risk in the app. It is stated
in the consent copy ("stored on your phone"), and P5-03 should be decided before
a public release rather than after.

### R3 — Health data leaks into a crash report

_Low × High._ A stack trace carries whatever the failing code was holding, and a
database error quotes the statement it failed on — a statement that can contain
a note a parent typed.

Mitigated thoroughly, and this is the one place the design is aggressive: the
scrubber is an allow-list that rebuilds each event field by field, so an unknown
field is dropped and a future SDK cannot widen what is sent. The user, IP
address, request and response bodies, console logs, route parameters and
stack-frame locals never leave. Text that does travel has quoted runs, JSON,
emails and UUIDs replaced, capped at 300 characters. 27 tests assert this
against events shaped like real failures; crash reporting is off entirely in any
build without a DSN.

_Residual: Low._

### R4 — Health data leaks into a notification on a lock screen

_Low × High._ A reminder appears on a locked phone that anyone nearby can read.

Mitigated: notification bodies are content-free by rule (rule 8) — "Next feed
may be due", never an amount or a temperature. A test walks every notification
string and fails on an interpolation that could carry a figure. Push
notifications (P4-02) are not built; when they are, the same rule applies to the
edge function, which is why SDD calls it "content-free".

_Residual: Low._

### R5 — A caregiver sees data they should not

_Low × Medium._ Households are the whole access model.

Mitigated: row level security on every table for every role, 336 pgTAP
assertions covering each cell of the access matrix, helper functions with an
empty `search_path`, a trigger making an event's household immutable so an
update cannot move a row, and a trigger preventing a household being left with
no owner. Health writes additionally require a current consent row, enforced in
the database rather than the client.

_Residual: Low._

### R6 — Free text contains more than anyone intended

_High × Medium._ `note`, `notes`, `questions` and a feedback message are typed by
a person and can contain anything — another child, a clinician's opinion, a
family member's diagnosis.

Mitigated: all of it is treated as health data. The feedback form asks
explicitly for health details to be left out and says what travels with the
message; the feedback table has no household or baby id, so nothing in it can be
joined to the health record.

_Residual: Medium._ Unavoidable in a notes field. Worth revisiting only if a
better pattern appears — a character limit is already in place (500 for a note,
2000 for feedback).

### R7 — A processor is breached

_Low × High._ Supabase holds everything.

Mitigated: EU region, RLS so a leaked anon key grants nothing, no secret key in
any client bundle (the env parser refuses one), and the publishable key is
public by design. Sentry holds only scrubbed reports, for 30 days. Supabase runs
in `eu-central-1` (Frankfurt), and its Data Processing Addendum is incorporated
into its Terms of Service, so it applies without a separate signature
(confirmed 2026-09-27). A dated copy of that statement is the evidence that
Article 28's written-contract requirement is met, so keep one.

_Residual: Low–Medium_, and partly outside the controller's hands, which is what
a DPA exists to allocate.

### R8 — A parent cannot get their data erased

_Certain × Medium._ Erasure is not implemented (P4-06).

Mitigated: export works today (P4-05); the consent screen was corrected so it no
longer promises deletion the app cannot do (P3-F6); a request is handled by hand
against the database and recorded here.

_Residual: Medium until P4-06 ships._ Acceptable for a beta of five households
where the controller can act within the Article 12(3) month by hand. **Not
acceptable at public scale**, and the reason P4-06 is reserved for a review
window rather than dropped.

### R9 — The app is read as medical advice

_Medium × High._ A parent with a feverish newborn will read anything as
guidance.

Mitigated hard, because it is both a safety and a regulatory question: no
interpretation, no ranges, no traffic-light colours on a figure, a disclaimer on
its own screen, and a lint rule plus a test that walks every string in both
languages and fails on words like "normal", "healthy", "too little", or the
Greek `φυσιολογικό`. The call script exists precisely so the numbers are read to
a clinician rather than judged by the app.

_Residual: Low_, and revisited whenever copy changes — which is enforced, not
remembered.

### R10 — A baby's record outlives the reason for keeping it

_Medium × Low._ Entries are kept for the life of the household, and the
inactive-household sweep described in SDD 12.1 does not exist (P4-F5).

_Residual: Low–Medium._ The intent is documented and the mechanism is not built;
`retention.md` says so rather than implying otherwise.

---

## 5. Where the risk sits overall

Nothing here is a reason not to ship to a small beta. Two things are still
reasons not to ship publicly without finishing them first — a third, invite
rate limiting, closed 2026-09-27 (R1):

1. **P4-06** — erasure (R8), and the consent copy corrected in the same release.
2. **P5-03** — decide on local database encryption (R2), with the decision recorded as an ADR whichever way it goes.

No paperwork blocks the beta: Supabase's DPA arrives with its Terms of Service
rather than needing a signature (R7, confirmed 2026-09-27). What remains before
P5 is the lawyer's review this document was written for.

## 6. Consultation

No data subjects were consulted: the only households so far are the developer's
own. Before the five-household beta, the onboarding should ask testers to read
the consent screen and say whether they understood what was being processed —
their answer belongs in this directory beside this file.

Prior consultation with the Cyprus Commissioner for Personal Data Protection is
not required: Article 36 applies where the residual risk stays high after
mitigation, and no residual above Medium is recorded here.

## 7. Sign-off

|                           |                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assessment carried out by | the developer, with Claude Code                                                                                                                     |
| Reviewed by a lawyer      | **not yet** — required before P5 (SDD 12.1)                                                                                                         |
| Decision                  | proceed to a beta of up to five households; do not release publicly before P4-06 and P5-03 are resolved (P2-F7 closed 2026-09-27)                   |
| Next review               | before the first outside household, and on any change to §4 — a new processor, a new category of data, push notifications, or analytics of any kind |
