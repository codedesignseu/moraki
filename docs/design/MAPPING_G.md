# Direction G: mapping

Step 1 of the direction G redesign (`design/moraki-final-app/`). It records what exists, what G shows and how the two meet. No source file changes with it.

Sources: `design/moraki-final-app/` (CLAUDE.md, NOTES.md, tokens, 52 screens in day and night, 4 Greek, foundations), the root `CLAUDE.md` (which wins on any conflict), `docs/design/MAPPING.md` (the Sage mapping) and the code on `design/sage-refresh` at `142d603f`.

- **Location.** This file lives at `docs/design/MAPPING_G.md`, next to the Sage docs, rather than `design/MAPPING.md`. That follows the convention the Sage refresh set.
- **Branch.** The work happens on the integration branch `design/direction-g`, cut from `design/sage-refresh`. G builds on Sage's tab bar fix, tokens structure, icons and splash. Each step is a PR into `design/direction-g`. Main is not touched.

## 1. What G changes, in one list

| Area | Today (Sage layout, Stone colours) | G |
| --- | --- | --- |
| Palette | Stone. Background `#EEEDE7`, tiles `#F3DF8C` / `#ECD3CA` / `#CDD1F2` / `#CDE5DA` | Faded Stone. Background `#F3F2EE`, tiles `#F7EBC0` / `#F4E4DE` / `#E1E3F7` / `#E0EEE7`. Night tiles unchanged. |
| New tokens | — | `heroCircle`, `navButton`, `disabledFill`/`disabledText`, `toast`/`onToast`, `undo`/`onUndo`, `warning`, `errorSurface`, `skeleton`, `logo` per scheme |
| Night selected | `#3A352F` with light text | `#F1EAE0` with `#171411` text. Chips and segments now match, which settles last round's open question. |
| Fonts | System font | Comfortaa (headings, sheet titles, big numbers), Manrope (everything else). Two `@expo-google-fonts` packages, which the brief pre-approves. |
| Tab bar | Dark pill by day, light pill at night, 286 wide | White pill of four round 52 buttons, 30 above the bottom, shadow. Active is dark. At night the pill is `#23201C` and the active button is light. |
| Screen titles | Native header; Home shows the logo | No native header on tabs. Comfortaa 30 title inside the content. Home shows a greeting with the logo in a butter circle. |
| Log forms | `presentation: 'modal'` with a native header | A sheet over a dimmed Home: 32 top corners, grab handle, icon, title and subtitle at top left, round close at top right |
| Kind choices | `Segmented` | 64-high radius-20 buttons in tile colours. The selected one is dark. |
| Stepper | Bordered, 64 buttons | Grey box, round white 52 buttons, Comfortaa value with the unit as a separate span |
| Chips | White with an outline, ink ring when selected | Filled, no border. Selected is dark with a check icon. 48 high. |
| Errors | Message in the error colour | Error icon plus the "Error:" prefix, `role=alert` |
| Toast | Borrows the tab bar colours | Its own tokens. Day: ink pill with a butter Undo pill. Night: light pill with a dark Undo pill. |
| Brand files | — | **Unchanged.** Every SVG, logo, app icon and splash mark is byte-identical to the Sage export and to `assets/`. The UI icon PNGs differ in encoding only and are pixel-identical. The one real change is the day splash background, `#EEEDE7` to `#F3F2EE`. |

### Conflicts inside the export (screens win)

- `foundations.html` still shows the Sage type scale (36/22/20/18) and a dark tab bar. `theme.ts` and every screen use title 30, heroNumber 38, sheetTitle 20, cardTitle 17 and tileLabel 16/800, with a white bar.
- Values used in the screens but missing from `theme.ts`:
  - chart bars `#E9CF7A` / `#E3BFB2` by day and `#8A7438` / `#7A5560` at night
  - the switch's on colour `#34A853`
  - the nav shadow
  - card corners: 26 for most cards, 28 for the hero and the tiles
  
  They are added to `tokens.ts` with a comment naming the screen they came from.
- The Undo pill is 44 high in the design. It is built 48 high to meet the touch rule.
- The Greek files have half-translated accessibility labels ("Log τάισμα", "Tabs") and some English units ("3 h 00", "min"). These are not copied.

## 2. Every screen, matched to G

"Analogy" means G draws the screen, but it shows elements the app does not have. The app's own elements are kept and styled in the same way.

### Tabs and system

| App file | G file(s) | Changes |
| --- | --- | --- |
| `app/(tabs)/_layout.tsx` | nav in every tab file | Round 52 items, gap 8, padding 8, shadow. `headerShown: false`, so each tab draws its own title. |
| `src/features/home/HomeScreen.tsx` | `tabs/home`, `home-states`, `home-empty`, `home-viewer` | Greeting. Left-aligned hero with a 38 number, a "Since last feed" tag, a decorative circle, the feed icon in a dark circle and a "Log a feed" pill. 132-high tiles with a white icon circle, a "+" badge and a "Last 21:40" line. Health and Medication share one grouped card. Today shows four tinted cells. Appointment is one › row. Stock has one Adjust button and two cells. Recent rows get an icon badge. The duplicate and running-sleep cards are restyled. |
| `src/features/history/HistoryScreen.tsx` | `tabs/history`, `-empty`, `-filtered` | Borderless chips with a check when selected. Day label in 15 Comfortaa soft. Rows 66 high with a 44 type badge, "time · summary", the person underneath and ›. Empty state is a 64 white icon circle. |
| `src/features/insights/InsightsScreen.tsx` | `tabs/trends`, `trends-empty` | "Last 7 days" subtitle. Card titles as text with a unit line. Full-width bars with the value above and a colour per series. Averages in two grey cells. Weight moves to the bottom. |
| `src/features/weight/WeightCard.tsx` | weight card in `trends` | Birth / Latest columns. Gridlines with filled points for clinic and hollow for home, plus a legend. "5 Oct · Home" rows. Outlined Add weight. |
| `src/features/settings/SettingsScreen.tsx` | `tabs/settings`, `settings-out`, `greek/el-settings` | G order: Account, Sync, Privacy, Reminders, Night mode, Language, Report, Data export, then › rows (Baby details, Leave or delete, Feedback, About). Inline editing stays. |
| `src/features/startup/DatabaseGate.tsx` | `reports/startup`, `startup-fail`, `loading` | Opening state is blank, as today. The failure state gets the 64 mark, a 22 title and body. |
| `app.json` splash | `reports/splash` | Day background becomes `#F3F2EE`. Night `#171411` already matches. Needs a native build. |
| `src/features/undo/UndoToast.tsx`, `src/ui/primitives/Toast.tsx` | foundations toast | Its own tokens, as above. |

### Log sheets

| App file | G file(s) | Changes |
| --- | --- | --- |
| `src/ui/theme/sheet.ts` (all log routes and `entry/[id]`) | every sheet | The presentation change (decision G1) and a new `SheetHeader`: 46 icon circle, sheet title 20, 13 subtitle, 48 round close |
| `src/features/feed/FeedSheet.tsx` | `sheets/feed-bottle`, `-breast`, `-mixed`, `-error`, `greek/el-feed` | Kind as 64 buttons (Bottle in feed, Breast in sleep, Mixed in pump colours). Small labels above each field. Stepper in a grey box. Milk as a segmented control. The app's "Mixed" milk option and the 3-way from-stock choice with fridge/freezer amounts are kept and styled. `feed-error` can't happen, because `ML_MIN` is 10. |
| `src/features/diaper/DiaperSheet.tsx` | `sheets/diaper`, `diaper-time` | 132 tiles with a white 58 icon circle, centred. "Tap one. It saves right away." The time field is kept always visible (G hides it behind a link, decision G4). |
| `src/features/sleep/SleepSheet.tsx`, `SleepEditForm.tsx` | `sheets/sleep-idle`, `sleep-running` | Start card in the sleep colour. Running state shows a 54 live timer. The past-sleep panel keeps the app's minute steppers in the G stepper box, with an inline error. |
| `src/features/pump/PumpSheet.tsx` | `sheets/pump` | Destination as 64 buttons |
| `src/features/health/HealthSheet.tsx` | `sheets/health-note` | Chips in G style. The temperature field gets a °C suffix. Field order follows G (time, temperature, symptoms, note). The Jaundice tag and the counter are kept. |
| `src/features/health/MedicationSheet.tsx` | `sheets/medication` | G fields and placeholders. G's Note field is not added, because the payload has no note. |
| `src/features/weight/WeightSheet.tsx` | `sheets/weight` | Visible "Fine adjust" label, value at 32, inline error with an icon |
| `src/features/stock/StockSheet.tsx` | `sheets/milk-stock` | Place as 64 buttons. A "Now in the fridge … ml" row. Reason as single-select chips. |
| `src/features/appointments/AppointmentSheet.tsx` | `sheets/appointment` | One field per question with a round × remove. Outlined Add question. Labels without "(optional)". No "Now ·" subtitle, because a visit is in the future. |
| `app/entry/[id].tsx` | `sheets/edit-entry`, `not-editable` | "Edit feed" with a "Logged 21:40 · Parent 2" subtitle. Kind stays disabled on edit, as today. The time control stays "Move time". Delete is an outlined button with a trash icon. The not-editable view gets the grey card and keeps Delete. |

### Account, onboarding, household, reports

All of these drop the native header for an in-page header: a round 48 back or close button next to a 22 Comfortaa h1. Inputs are 54 high with a 1.5 border and corner 16. Secondary actions such as Resend and Change email become text links.

| App file | G file(s) | Changes |
| --- | --- | --- |
| `src/features/auth/SignInScreen.tsx` | `account/sign-in`, `-loading`, `-code`, `code-expired` | Mail icon in the email field. Outlined Apple and Google buttons. A spinner in the busy button. One code field, not six boxes, because the app accepts 6 to 10 digits. The expired and wrong-code messages stay combined, as the auth layer reports them. |
| `src/features/onboarding/HouseholdSetupScreen.tsx` | `account/setup` | "You" and "Baby" cards, a "g" suffix, Save pinned to the bottom. The app's relation list is kept, Caregiver rather than G's Nanny. |
| `src/features/household/JoinScreen.tsx` | `account/join`, `-signed-out`, `-already`, `-invalid` | G layout. The app's problem messages are kept. |
| `src/features/privacy/ConsentScreen.tsx` | `account/consent`, `consent-agreed`, `greek/el-consent` | One white card with 4 icon rows. **The text does not change** (decision G3). |
| `src/features/household/InviteScreen.tsx` | `account/invite` | Role as a segmented control. Code in 4+4 groups. Open invites as rows with Revoke. |
| `src/features/settings/BabyScreen.tsx` | `account/baby`, `baby-caregiver` | G layout. The caregiver read-only variant is design only (section 3). |
| `src/features/settings/ErasureScreen.tsx` | `account/leave` | Successor as chips. The inline confirm is kept. **Body text unchanged** (privacy statements). |
| `src/features/privacy/AboutScreen.tsx` | `account/about` | Disclaimer card and › rows. The app's paragraphs, support link and email are kept. |
| `src/features/feedback/FeedbackScreen.tsx` | `account/feedback`, `feedback-thanks` | G layout. The app's accurate metadata line and thanks text are kept. |
| `src/features/report/CallScript.tsx` | `reports/call-script` | 2-column stat tiles, the question list and a worry field. The app's extra figures are kept as tiles. |
| `src/features/report/ReportPreview.tsx` | `reports/report` | Stat tiles from the app's existing figures, and a days table in the G grid. |
| `src/features/report/reportHtml.ts` | `reports/pdf` | Logo top right, stat boxes, a grid table. Keeps the system font (decision G6) and the app's columns. |

## 3. Design only (left out unless decided otherwise)

| Element | Why it is left out |
| --- | --- |
| Welcome screen and first-run route | A new screen. The app opens on Home, and sign-in is reached from Settings. |
| Six OTP boxes, a distinct "code expired" state | Auth logic. Supabase reports both as `otp_expired`, and the app accepts 6 to 10 digits. |
| Consent titles, intro, shorter paragraphs, "Consent version 1.2", "You agreed on …" | Legal copy, and exposing `grantedAt` is consent logic |
| Baby details read-only for caregivers; Home viewer banner with disabled tiles | Role gating the UI doesn't have today |
| "Leave first" on join-already | New navigation |
| Report and PDF figures the app doesn't compute (weight and medication counts, total sleep) | New data |
| Call script Share button | New feature |
| Startup "Try again" | Re-running the database open is new behaviour |
| "From stock" as an on/off switch that always takes from the fridge | Loses the app's fridge/freezer choice |
| Past sleep as clock steppers; absolute time when editing | A semantic change to existing controls |
| Medication note, Nanny relation, no Jaundice tag | They conflict with the payload or data values |
| Settings: Withdraw on the screen, consent date, household name, an "Open reports" index, Move/Keep for foreign entries, a build number, sync and privacy cards when signed out | Data or screens the app doesn't have |
| Home empty state that hides Today, appointment, stock and recent | The app always shows them. G's empty hero copy is used. |
| Today strip that merges wet and dirty and drops breastfeeding time | Removes data the app shows |
| Insights: merged diapers column, no total row; Weight "Since last" | Removes data; changes the figure against birth weight |
| History "Clear filters" button | Needs a `clear()` (small, see decision G2) |
| Bell, Coming up, rings, nap card, Routine and Tips tabs | Already removed by the designer (NOTES.md) |

## 4. App only (styled with G components)

- **Home:** next-side line, "reminder was at", stock short warning, last-by line, "Add an appointment", "Nothing booked", breastfeeding minutes, wet/dirty split.
- **Feed:** Mixed milk, the 3-way from-stock choice with amounts, status pill.
- **Health:** Jaundice tag, character counters.
- **Medication:** the "Add a dose" heading and the prefill hint.
- **Appointment:** questions hint, draft question field.
- **Insights:** 7-day total lines, wet/dirty columns, total row, weight reference lines and day marks, the paediatrician note.
- **Settings:**
  - reminders on/off and the permission hint
  - the device language option
  - waiting count and refused rows
  - sign-out confirm
  - roles, export and setup hints
  - read-only reminders for non-owners
  - the Sentry test
- **Sign-in:** rate-limited, offline and server errors.
- **Join, Invite, Erasure, About, Feedback:** their extra hints and problem states.
- **Report:** section cards, the six-column table, appointment questions.
- **Developer showcases** `app/primitives.tsx` and `app/tokens.tsx`: updated to the new components.

## 5. Components

- **New in `src/ui/primitives`:**
  - `SheetHeader`, `ScreenHeader` (in-page title and back button), `ChoiceButtons` (64 kind buttons)
  - `HeroCard`, `Greeting`/`LogoBadge`, `PlusBadge`, `IconCircle`, `StatCell`
  - `InlineError`, `WarningCard`, `TextButton`, `PillButton`, `Skeleton` (only if decision G2 keeps a loading state), `Legend`
- **Changed:**
  - `ActivityTile` (rewrite), `TabBar`, `Toast`, `Card` (26/28, warning tone)
  - `ListRow`, `EntryRow`, `Chip`, `Segmented`, `Stepper`, `Button` (secondary 52, disabled tokens)
  - `EmptyState`, `BarChart` (colour prop), `PointChart` (hollow points, gridlines), `TimerText`, `TextField`, `DateTimeField` (input-shaped)
- **Icons:**
  - `check`, `alert`, `close`, `chevron` and `mail` are not in the set. They are drawn in the set's style (24 grid, 1.8 stroke) and added, as the Sage brief allowed.
  - Per-type badge icon and tone go on the activity modules (`domain/activities`), never in a `switch`.

## 6. Copy

- **English rewording, non-legal:** about 60 keys move to G's shorter wording. Examples:
  - "Stop sleep" → "Stop"
  - "Wet and dirty" → "Both"
  - "Adjust stock" → "Milk stock"
  - "Bottle milk" → "Bottle"
  - "mL" → "ml"
  - "Invite a caregiver" → "Invite someone"
- **New strings:**
  - sheet titles ("Log a feed" …)
  - subtitles ("Now · {{time}} · {{name}}")
  - "Close", "Hello, {{name}}", "Last {{time}}"
  - "Error:" as one shared `common.error` key
  - the trends and history empty states
- **Legal and privacy copy does not change:** consent, erasure, about disclaimer, the feedback metadata line. G's versions drop statements the app must make.
- **Greek wording:** G uses a different glossary from `el.json`:

  | | App (`el.json`) | G |
  | --- | --- | --- |
  | entries | εγγραφές | καταχωρίσεις |
  | phone | τηλέφωνο | κινητό |
  | owner | Διαχειριστής | Ιδιοκτήτης |
  | roles | Καταγράφει εγγραφές / Μόνο βλέπει | Φροντιστής / Θεατής |
  | freezer | Κατάψυξη | Καταψύκτης |
  | formula | Φόρμουλα | Σκόνη |
  | sync | Κοινή χρήση | Συγχρονισμός |

  G also mixes the formal and informal register, while the app is informal throughout (decision G5).
- **Durations:** "2 h 15 min", "1 h 05", "2 ώ 15 λ" replace the unlocalised "2h 15m". The formatting moves to i18n.

## 7. Decisions for Makis

| # | Decision | Proposed default |
| --- | --- | --- |
| G1 | Sheet presentation | Native `formSheet` (react-native-screens 4.26, no new dependency): 32 corners, swipe to dismiss, the grab handle drawn in JS. This is SAGE-F1, and it needs a device check of the keyboard and 200% text. Fallback: `transparentModal` with the existing JS `Sheet`, which matches the design exactly but has no swipe. |
| G2 | Small wiring that uses data the app already has | **Yes**: greeting name (`useCaregiverNames`), "Last 21:40" on tiles, "Log a feed" button, live 1 s sleep timer, "Today, 22:40 · now", localised durations, appointment doctor in the row, History "Clear filters", per-type badges. All derived and computed, none stored. |
| G3 | Anything in section 3 | Left out. Each one is a separate decision. |
| G4 | Diaper time field behind "Changed earlier?" | Follow G (the link reveals the field). Saving on tap is unchanged. |
| G5 | Greek glossary | Keep the app's informal register, and adopt G's terms only where they read better: κινητό, καταχωρίσεις, Φροντιστής / Θεατής. To be confirmed. |
| G6 | PDF fonts | Keep the system font in the PDF. Embedding Comfortaa and Manrope would add about 300 KB per share. |

## 8. PR order (each into `design/direction-g`, each under about 400 lines)

1. Tokens: G palette, new tokens, type scale, sizes. Contrast test updated.
2. Fonts: the two packages, a loader that holds the splash, and the type tokens wired in.
3. Icons: the five missing ones, plus badge icon and tone on the activity modules.
4. Primitives, part 1: Button, Chip, Segmented, Stepper, TextField, InlineError, ChoiceButtons.
5. Primitives, part 2: Card, ListRow, IconCircle, StatCell, PillButton, TextButton, WarningCard, Toast.
6. Tab bar and `ScreenHeader`.
7. Sheet presentation and `SheetHeader` (G1).
8. Home, in two PRs: hero and tiles, then the cards.
9. Feed. 10. Diaper. 11. Sleep. 12. History. 13. Trends and the weight card. 14. Settings, in two PRs.
15. Pump, Health, Medication, Weight, Stock, Appointment, Edit entry.
16. Sign in, Setup, Join, Consent, Invite, Baby, Leave, About, Feedback.
17. Call script, Report preview, PDF, startup failure, splash colour.
18. Copy: the English and Greek wording that is not already in a screen PR.
19. Review notes and an EAS preview build.

Each screen is checked against its day and night HTML before its PR. `lint`, `typecheck`, `npm run arch` and the tests pass on every PR.

## Decided (2026-10-16)

- **G1:** native `formSheet`.
- **G2:** yes, all the listed wiring.
- **G5:** a mix. Keep the informal register and Φόρμουλα, Κατάψυξη, Κοινή χρήση. Adopt κινητό, καταχωρίσεις, Φροντιστής / Θεατής.
- **G3, G4, G6:** the proposed defaults stand.
- **How the build runs:** all of section 8 as stacked PRs into `design/direction-g`. Nothing merges without the owner. One report at the end, with open questions in `docs/design/REVIEW_NOTES_G.md`.
