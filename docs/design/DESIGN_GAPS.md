# Sage design gaps

These are things the Sage design shows that the app does not do. None of them are built in the refresh. Each gets the existing screen, restyled without the item. The owner reviews this list after the refresh and decides what to design or build next.

The mapping lives in [MAPPING.md](MAPPING.md). This file is the live list and gets updated in every refresh PR.

Each item gives a size (S = under a day, M = a few days, L = a week or more) and the area of the app it would touch.

Status:
- **open** means not built.
- **needs legal review** means it must wait for the owner's lawyer before any build.

## Onboarding and consent

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| 01-welcome | Welcome screen with rotated activity tiles, "Let's start" and "I have an invite" | No welcome screen. The app opens straight on Home (local first). Sign in, household setup and join open from Settings. | A first-run route and a gate in navigation; changes the launch flow. **M**, medium risk (onboarding logic). | open |
| 02-household | One step to choose "Start a new one" or "Join with a code" | Two separate Settings buttons: "Set up household", "Join household" | A chooser route. **S**. | open |
| 02-household | Home-plus icon | none | Draw it in the set style (24 grid, 1.6 stroke). **S**. | open |
| 03-baby-details | Birth weight in kg or lb, with a toggle | Grams only | A unit preference (new device setting) and conversion on display. **M**; touches stored format, needs db review. | open |
| 03-baby-details | Birth date picker ("Born on") | "Born N days ago" stepper with the date shown | Date picker in place of the stepper. **S**. | open |
| 03-baby-details | "{name} is N days old today" note | Not on this screen | Copy and a pure age calculation. **S**. | open |
| 04-consent | Promise-row titles: "Kept in the EU", "Only your family sees it", "Never sold, no ads", "Take it with you" | Four existing paragraphs (what, where, who, rights), no titles | Four new copy strings on a legal screen. **S**, but they are new claims. | needs legal review |
| 04-consent | "Delete it any time / Two taps, and it is gone" row | No erasure promise on the consent screen | New legal copy. "Two taps" also does not match the app's inline confirm. **S**. | needs legal review |
| 04-consent | "I agree" checkbox before the Agree button | The Agree button is the explicit action | Consent flow change. Out of scope for the refresh. **S** to build, but legal and consent-logic risk. | needs legal review |
| 04-consent | Two-person "family" icon | none (`invite` is used instead) | Draw it in the set style. **S**. | open |

## Home

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| 05-home-empty | Avatar header, invite "+" circle, "Day N" chip, invite card with the code pill on Home | Home has no avatars, invite card or day count | Household and member reads on Home, plus a new card. **M**. | open |
| 06-home | Notifications bell button | Reminders exist, but there is no notifications screen | A notifications route. **M**. | open |
| 06-home | "Coming up" section with "See all" | Reminder line inside the timer card; next-appointment card | An aggregated upcoming view and its list screen. **M**. | open |
| 06-home | Overlapping caregiver avatars; greeting by time of day ("Good morning, …") | none | Member reads plus copy. **S**. | open |
| 07-home-timer | Progress ring toward the next feed | Text timer; reminder line | Needs `react-native-svg` (not installed) and a target interval on Home. **M**. | open |
| 07-home-timer | "Left next / Right" side picker and "Start breastfeed" | Next-side hint text; breast feeds are logged after the fact | Depends on the live breast timer below. **L**. | open |

## Log sheets

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| 08-feed-bottle | "= same as last" stepper button | Plain mL stepper | A read of the last bottle amount. **S**. | open |
| 08-feed-bottle | "You are feeding her / {partner} sees it too" row | none | Member reads plus copy. **S**. | open |
| 08-feed-bottle | "Other time" button | The time field is on the form itself | Layout only if wanted. **S**. | open |
| 09-feed-breast | Live left and right timers with Pause and "ON NOW" | Side and minutes stepper | A running-feed model like the running sleep. **L**; touches domain, db and sync. | open |
| 09-feed-breast | "She finished on the right at 01:00" | Next-side hint only | Copy from existing data. **S**. | open |
| 11-sleep | Progress ring | Text timer | Needs `react-native-svg` and a target. **M**. | open |
| 11-sleep | "N h of sleep since midnight" and a list of earlier sleeps | Not on the sleep sheet (24 h sleep is on Home) | Pure reads on the sheet. **S**. | open |
| 11-sleep | "Edit start" while running | Running sleep can be stopped, then edited from History | Edit of a running entry. **S** to **M**. | open |
| 16-milk-adjust | "Moved to freezer" as one action; "N ml left after this" | Add or remove plus a reason (discard, move, correction) | A combined move action (two stock changes) plus a calculation. **M**; touches stock domain. | open |
| 18-appointment-add | "Remind us the day before / one hour before" | No appointment reminders (reminders are feed reminders) | Notification scheduling for visits. **M**; touches notifications. | open |

## History and Insights

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| 12-history | One-day pager with ‹ › and a day summary line | One continuous list grouped by day | Paging and a per-day summary. **M**. | open |
| 12-history | Author avatar on each row | Who logged it is in the row's meta text | Avatar from member data. **S**. | open |
| 12-history | Pump filter chip | Filters: feeds, diapers, sleep, health, other (pump is in other) | A filter change. **S**. | open |
| 12-history | Share button | Reports are shared from Settings, then Report | A shortcut. **S**. | open |
| 12-history | Duplicate warning inside History | Duplicate warning is on Home | A placement change. **S**. | open |
| 13-insights | 7 or 14 day toggle | Fixed 7 days (`INSIGHT_DAYS = 7`) | A domain parameter and UI. **S**. | open |
| 13-insights | Stat cards: feeds a day, diapers a day, sleep a day | Averages card (bottle, interval) and a days table | Pure calculations. **S**. | open |
| 13-insights | "Day 10 to 14" band on the weight chart | Reference lines at a share of birth weight | Chart change; check against rule 10 (no interpretation). **S**. | open |

## Doctor, stock and visits

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| 14-call-script | Numbered sections; a sleep section | No sleep section | Pure sleep summary. **S**. | open |
| 14-call-script | "Share the 24 hour report" button | Sharing lives in the report preview | A shortcut. **S**. | open |
| 15-milk-stock | A milk stock screen with bags listed oldest first and "Use this one first" | Stock card on Home with fridge and freezer totals, oldest age and Adjust | A new route and a per-bag read model. **M**; touches stock domain. | open |
| 17-appointments | A doctor visits screen: date block, earlier visits list | Next appointment card on Home; past visits in History | A list route. **M**. | open |
| 17-appointments | Tick-off checkboxes on questions | Questions are a plain list | A new field on the appointment payload. **M**; db and schema. | open |

## Settings and caregivers

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| 19-settings | Drill-down › rows (Family, Milk stock, Doctor visits, Reports, Privacy); baby card with › | Inline cards (D8: kept, restyled only) | A settings navigation restructure. **M**. | open |
| 19-settings | "Everything synced at …" footer | Sync status card | A placement change. **S**. | open |
| 20-caregivers | A separate caregivers screen | Caregivers inside the Settings account card | A new route. **M**. | open |
| 20-caregivers | "Hand over owner" as its own action | Handover only through the leave flow's successor picker | Role change outside the leave flow. **M**; roles and RLS review. | open |
| 20-caregivers | A shareable invite **link** field | An invite code card with Share | Copy and layout; universal links exist. **S**. | open |

## Brand

| Design id | What it shows | App today | Building it would involve | Status |
|---|---|---|---|---|
| logos/lockups | Greek lockup (μωράκι) | Text wordmark "Moraki" | Asset only, but it needs Commissioner outlined. **S**. | open |
| guidelines | Ysabeau Infant for UI, Commissioner for the wordmark | System font (owner's brief: no custom fonts) | One-line `fonts.ui` change plus `expo-font` loading. **S**; bundle size and licence check. | open |
| app-icons/splash | Day and night splash screens | No splash plugin installed (see MAPPING.md, splash) | Needs `expo-splash-screen`, a new dependency. **S**; needs the owner's yes. | open |

## Icons the set does not have

The app uses the closest icon from the set for each of these.

| Needed for | Closest icon used | Status |
|---|---|---|
| Medication | `health` | open |
| Appointment | `visit` | open |
| Milk stock | `pump` | open |
| Back, close, chevron, plus, check | none in the set (the design draws them as text glyphs) | open; decided in PR 2b |
