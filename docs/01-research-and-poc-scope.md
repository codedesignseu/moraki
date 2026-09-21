# Newborn Tracker: Research Findings and POC Scope

Date: 20 September 2026
Status: for approval. The SDD (02) is written against this scope.

---

## 1. Decisions locked

| Decision | Call | Why |
|---|---|---|
| Product path | Personal tool first, then commercial | Same pattern as BriefEngine. You are household #1, so you get real usage data and a working demo before you productise |
| Platform | Expo (React Native) with TypeScript, one codebase to iOS and Android | Native push, widgets and Live Activities stay reachable. The reminder is the product, and web push on iOS can't carry it |
| Backend | Supabase in the EU region (Frankfurt): Postgres, row level security, Realtime, Auth, Edge Functions | Auth, access rules and live sync come ready made. With solo capacity you buy the sync layer, you don't build it |
| Local storage | expo-sqlite with an outbox queue | Offline first is non-negotiable at 3am with bad signal |
| Market | Cyprus and Greece first | You can reach beta households there. EU English follows |
| Language | English at POC, Greek at v1 | i18n wired in from the first commit, one locale shipped |
| Capacity | Solo, small shippable phases | Every phase ends in something you can install |

---

## 2. What the research says

### The first 40 days is a clinical window

This is the most important finding. In the first two weeks, pediatricians ask about exactly what this app records:

- Feeds: 8 to 12 per 24 hours, rarely more than 4 to 5 hours apart
- Wet diapers: rising day by day, 6 or more by day 5
- Stools: at least one per 24 hours in the first two weeks, moving off dark green by day 4
- Weight: a dip of 5 to 10% of birth weight, back to birth weight by day 10 to 14
- Red flags doctors name: more than 10% weight loss, no return to birth weight by two weeks, fewer than 6 wet diapers after day 5, fever of 38.0°C or higher under 3 months

Parents are told to phone with specific numbers ready: age in days, weight then and now, feeds in 24 hours, wet and dirty counts, temperature. That is a script, and no tracker on the market produces it.

What this means: the log isn't the differentiator. The output is. One screen, one tap, the exact numbers a nurse asks for, in the order she asks.

### The mental load is the real problem

- Mothers carry about 71% of household mental load, and fathers rate the split as more equal than it is (University of Bath, 3,000 parents, 2024)
- Daminger's research separates doing from managing. Splitting the tasks doesn't split the load. The load is who keeps track of whether the tasks got done
- Exhaustion is the most common emotion of year one at 61%, then overwhelmed at 48% and anxious at 32% (Owlet, 2024)
- Lack of sleep tops the list of challenges at 29%, with emotional stress second at 26% (Enfamil)

What this means: shared logging is table stakes. The value is taking the monitoring job off one parent. The app tells the second caregiver what's due, so the first caregiver never has to ask. Nobody in this market sells that.

### The market is crowded, and the leaders have specific holes

Huckleberry has over 5 million families and the strongest brand. Plus costs $11.99 a month or $58.99 a year, Premium $14.99 a month or $119.99 a year, and a one-off sleep plan $49.99.

Complaints that repeat across app store reviews and comparisons:

1. Paywall creep. Free features move behind new tiers, and parents who already paid feel cheated. This is the loudest complaint.
2. Sharing behind the paywall. In several apps, adding a second caregiver hits the wall. The feature parents need most is the one that costs.
3. Offline reliability. The apps that have it call it out as an edge, which tells you the leaders don't.
4. Too many taps. Every comparison scores logging speed first.
5. Switching cost. Six weeks of history makes a mediocre app beat a better one started today. You win parents early or not at all.

A caveat on sources: many of these comparisons come from competing apps and are marketing. The pattern across them still holds.

### Privacy is the open flank

- 80% of the pregnancy and baby apps Surfshark analysed share data with third parties, including health data, photos and video (May 2026)
- Huckleberry, Kinedu and Glow Nurture ship in-app AI without saying whether prompts train models or how long data is kept (same study)
- Consumer Reports rated six major trackers, and privacy and security scored lowest of every category across all of them
- Academic work now describes these apps as built to extract data (Pybus, Matheson and Lachmansingh, Internet Policy Review, 2026)

What this means: an EU hosted tracker with no third party sharing and no ad SDK is a real position. It's also a claim a Cyprus agency can make more believably than a US venture-funded app.

### Retention is where these apps die

Parents are told to stop detailed logging once feeding settles. So a tracker either owns the newborn window properly, or it has to keep earning attention for years. Trying both is how you end up with milestones, forums and a sleep coach bolted onto a timer.

Call: own the first 90 days completely. Don't build for year three.

---

## 3. Competitor gap map

| Need | Huckleberry | Baby Tracker (Nighp) | Nara | Gap for us |
|---|---|---|---|---|
| Fast logging | Good | Good | Good | Match them, it isn't an edge |
| Sleep prediction | Best in class, paid | No | No | Don't compete |
| Multi-caregiver sync | Yes | Paid tier | Free | Match, then win on attribution and "what's due" |
| Offline reliability | Weak | Good | Mixed | Real edge, cheap to win |
| Pediatrician output | Basic export | CSV | Basic | Open. The call script is unclaimed |
| Which breast next | Yes | Yes | Yes | Match |
| Pumping and milk stock | Partial | Partial | Yes | Match |
| Birth weight regain view | No | Growth curve only | No | Open, and it's the day 0 to 21 worry |
| Privacy posture | Flagged | Local first | Good | Open in the EU |
| Mother's own recovery | No | No | No | Open, but v1, not POC |

Three open lanes: the pediatrician call script, the birth weight regain view, and EU privacy. All three are cheap to build and hard for a US subscription app to copy without changing its business model.

---

## 4. Positioning

For parents in the first 90 days: the tracker that answers the pediatrician's questions for you, keeps both parents equally informed without either one asking, and never sells what it knows about your baby.

Not a sleep coach. Not a community. Not a milestone scrapbook.

---

## 5. POC scope

### In

1. Household and caregivers. One baby, several caregivers, invite by link or code. Roles: owner, caregiver, viewer. Every entry shows who logged it and when.
2. Offline first logging. Feed (breast with side and duration, bottle with mL and milk type), diaper (wet, dirty, both), sleep (start, stop, manual), pump with fridge and freezer stock. Two taps for the common case.
3. Home screen. Time since last feed, which breast is next, next feed countdown, today's feeds and diapers, milk stock, who logged the last thing.
4. Reminder engine. Always counts from the latest feed by any caregiver. Scheduled as a local notification on each device so it fires with no signal, and rescheduled on every sync.
5. Undo, edit, delete on every entry, with attribution kept. Duplicate warning when two caregivers log a feed within a few minutes.
6. Night mode. Auto between 9pm and 6am.
7. Weight log with the regain view. Birth weight, the dip, the day 10 to 14 marker. Factual, no interpretation.
8. Call script and visit summary. 24 hour, 3 day and 7 day, in the order a pediatrician asks, shareable as PDF.
9. GDPR core. Explicit Article 9 consent, recorded with a version. Full export, one tap household deletion, EU hosting, no analytics that leave the EU, no ad SDK.

### Out of the POC

Sleep prediction or any AI coach. WHO growth percentiles. Milestones, photos, journal. Vaccinations. Community. Widgets, Apple Watch, Live Activities. Several children in the UI (the schema allows it). Mother's recovery module. Any payments.

### Never

Diagnosis, symptom interpretation, or anything that reads as medical advice. The app shows numbers and what the parent recorded. Nothing else.

---

## 6. Success and kill criteria

POC succeeds if, after 14 days of real use in your household, both caregivers log in the app, neither falls back to notes or WhatsApp, and the call script gets used at a real appointment.

Go commercial if, across 5 beta households, 70% are still logging at day 21, and at least one asks unprompted whether someone else can use it.

Kill it if logging drops off in week two in your own house. If it doesn't survive the people who built it, it won't survive strangers.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| iOS notification reliability | Local scheduled notifications for the feed reminder. Server push only for caregiver events |
| Sync conflicts between caregivers | Append-only events with client-made UUIDs, last write wins per field, soft delete. Duplicates flagged to the user, never merged automatically |
| Time maths bugs | Store UTC, show local, test across daylight saving and timezone changes. The most valuable test suite in the project |
| Scope creep into sleep coaching | The out-of-scope list above is a contract |
| GDPR exposure | DPIA done before the first outside beta household, not before launch |
| Nobody pays | Personal use first. No payments work until the beta group retains |

---

## 8. Open decisions for you

1. ~~Name and domain.~~ Decided: **Moraki** (μωράκι, "little one"). moraki.app registered.
2. Greek at POC or v1? Recommendation: v1, with i18n in from the first commit.
3. Beta households. Who are the five? Recruit them now, it takes weeks.
4. Apple and Google developer accounts: $99 a year and $25 once. Needed by phase 4. Start enrolment now, since verification from Cyprus takes time.

---

## Sources

- Surfshark, Pregnancy and baby trackers turn parenting into data, May 2026: https://surfshark.com/research/chart/baby-trackers-privacy
- Pybus, Matheson and Lachmansingh, Extraction-by-design, Internet Policy Review 15(1), 2026 (cited in the Surfshark study)
- Consumer Reports, Best Baby Tracking Apps, January 2024: https://www.consumerreports.org/babies-kids/baby-tracking-apps/best-baby-tracking-apps-a6067862820
- Owlet, State of Parenting Report, September 2024: https://www.businesswire.com/news/home/20240924164491/en/New-State-of-Parenting-Report-Spotlights-Universal-Parental-Struggles-Reveals-Exhaustion-As-The-Most-Common-Emotion-Parents-Feel-In-A-Babys-First-Year
- Enfamil, Parenthood's Biggest Challenges: https://www.enfamil.com/articles/parenting-challenges/
- MomBloom summary of mental load research including the University of Bath study: https://mom-bloom.com/articles/invisible-mental-load-moms-carry-every-day
- Touchpoint Pediatrics, Newborn First-Week Checklist: https://www.touchpointpediatrics.com/the-newborn-first-week-checklist-feeding-weight-jaundice-and-sleep.html/
- Happy Bun Pediatrics, Newborn Weight Gain Milestones: https://www.happybunpeds.com/child-development/newborn-weight-gain-milestones-whats-normal-and-when-to-call-your-pediatrician/
- Momcozy, Newborn Weight Loss, call script and thresholds: https://momcozy.com/blogs/babycare/newborn-weight-loss-after-birth-whats-normal
- Huckleberry, App Store listing and reviews: https://apps.apple.com/ca/app/huckleberry-baby-tracker/id1169136078
- Realm Labs, Best Baby Tracker Apps compared, July 2026: https://www.realmlabs.app/mamabee/articles/best-baby-tracker-apps-compared
- Momentum, GDPR consent requirements for health data: https://www.themomentum.ai/blog/gdpr-consent-requirements-health-data
- ICO, DPIAs for services involving children's data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/2-data-protection-impact-assessments/
