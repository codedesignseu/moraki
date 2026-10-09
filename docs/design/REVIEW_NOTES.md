# Sage refresh: review notes

Written during the overnight run (started 2026-10-09). Updated after every PR so it survives a lost session. Mapping is in [MAPPING.md](MAPPING.md), and gaps are in [DESIGN_GAPS.md](DESIGN_GAPS.md).

## Final EAS preview build: FAILED (not a design problem)

- **Command:** `eas build --profile preview --platform ios --non-interactive`, run once from `design/sage-refresh` at `2a5ad741` with a clean tree.
- **Log:** https://expo.dev/accounts/ce-code-designs-ltd/projects/moraki/builds/a648f007-a7ce-4792-950a-d6b69ef1d455
- **Error:** in the Xcode "Bundle React Native code and images" phase, `sentry-cli` stopped with `error: Auth token is required for this request.` The native project had been generated, and Xcode was archiving the app.
- **Cause:**
  - The Sentry plugin (P4-F4, #128) uploads source maps during the build.
  - The `production` profile sets `SENTRY_ALLOW_FAILURE=true`, but `preview` does not.
  - The EAS `preview` environment has no `SENTRY_AUTH_TOKEN`.
  - So any preview build fails, with or without the refresh.
- **Not retried:** the failure is not transient (network or queue).
- **Two fixes, both yours, both outside what this run may change (`eas.json`, env, secrets):**
  - add `SENTRY_AUTH_TOKEN` to the EAS `preview` environment, or
  - add `"env": { "SENTRY_ALLOW_FAILURE": "true" }` (or `SENTRY_DISABLE_AUTO_UPLOAD`) to the `preview` profile in `eas.json`.
- **What this means:** the new app icon, the splash (`expo-splash-screen`) and the Sage screens have not been seen on a device yet. After the fix, the same command is the first real test (section 7).

## 1. Status

All PRs target `design/sage-refresh` and use merge commits.

| PR | Branch | What | State | CI |
|---|---|---|---|---|
| #132 | `sage/01-mapping` | Step 1 mapping | merged | green |
| #133 | `sage/02a-tokens` | Tokens, `design/` export and exclusions | merged | green |
| #134 | `sage/02b-icons` | Icons and the `Icon` primitive | merged | green |
| #135 | `sage/02c-components` | New Sage components | merged | green |
| #136 | `sage/02d-app-icons` | App icon, splash, `expo-splash-screen` | merged | green |
| #137 | `sage/03a-onboarding` | Token aliases, primitive shapes, onboarding screens | merged | green |
| #138 | `sage/03b-home` | Tab bar, headers, Home | merged | green |
| #139 | `sage/03c1-sheets-feed` | Sheet styling, feed, diaper, sleep | merged | green |
| #140 | `sage/03c2-sheets-other` | Pump, weight, health, medication | merged | green |
| #141 | `sage/03d-history-insights` | History, Insights, weight card | merged | green |
| #142 | `sage/03e-settings` | Settings, caregivers, invite, baby | merged | green |
| #143 | `sage/03f-visits-stock-reports` | Appointment and stock sheets, call script, report, PDF | merged | green |
| #144 | `sage/03g-by-analogy` | About, feedback, leave or delete, startup | merged | green |
| #145 | `sage/04-final` | Final checks and docs | merged | green |
| #146 | `sage/04b-build-result` | Build result in the notes | merged | green |
| #147 | `sage/05a-tab-bar` | Tab bar fix | merged | green |
| #148 | `sage/05b-header-logo` | Home header logo | merged | green |
| _next_ | `sage/05c-stone` | Stone palette | in progress | |

## 2. Decisions made without asking

Each entry gives what was chosen, why, and the alternatives.

- **Merged #132 and #133 first.** Both were green in CI and locally, and the run rules allow it. Each later PR branches from the tip of `design/sage-refresh`.
- **Icons are 256 px PNGs rendered from the design's SVGs, not the 96 px PNGs (D1).**
  - Why: 96 px is sharp at 3x only up to 32 pt. The design draws tile icons at 42 pt (126 px at 3x) and empty-state icons at 84 pt (252 px at 3x), so 96 px would be visibly soft there.
  - How: rendered with headless Chrome from `design/ui-icons/svg`, the same artwork, black on transparent, with the C2PA metadata stripped. 23 files, 132 KB in total.
  - Still per D1: tinted with `tintColor`, no new dependency, one `Icon` component so SVG can replace it later.
  - Check sheet: `docs/design/icon-check.png`. Every icon at 24 pt and 42 pt at 3x, tinted ink on day and night backgrounds, all sharp.
  - Alternatives: use the 96 px PNGs as is (soft above 32 pt), or two sizes per icon (more files, and a size switch in `Icon`).
- **Back, forward, close, plus, minus and check are text glyphs.**
  - Why: the set has no files for them, and the design draws them as text glyphs (‹ › × + − ✓).
  - How: `Icon` renders them in the UI font, with `allowFontScaling={false}` so they keep their box like the PNG icons. Their buttons carry the accessibility label.
  - Alternatives: Ionicons, which is already installed (a different line style), or drawing new PNGs (invents artwork).

- **2c adds only new components. The existing primitives are restyled in 3a, not 2c.**
  - Why: the brief says nothing may look different in step 2 on screens that do not use new components. `Button`, `Card`, `Chip`, `Segmented`, `Stepper`, `TextField`, `Toast` and `EntryRow` are on every screen, so restyling them would change every screen at once.
  - What happens instead: they get restyled at the start of step 3 (PR 3a). From then on, screens of later groups show Sage controls inside the old layout until their own PR. That is a mixed look on the integration branch only.
  - Alternative: a per-component legacy or Sage switch, which is more code and gets deleted at the end anyway.
- **`Sheet` restyled in 2c.** Only the dev showcase uses it, so no app screen changes.
- **New in 2c:**
  - `ActivityTile` (the whole tile is one button; its "+" is drawn, not a second target)
  - `IconButton` (46 visible, hit area grown to 48)
  - `ListRow`
  - `TabBar` (floating, icon only)
  - `EmptyState`
  - `StatusPill`
  - all in the `/primitives` showcase in both schemes
- **The tab bar shows icons only, as the design does.** The labels remain as screen reader labels. The selected tab is a filled pill, so shape, not only colour, shows it. Alternative: icon plus small label, which the design does not show.

- **2d: `expo-splash-screen ~57.0.9` added in its own commit with `npx expo install`, as approved.**
  - `npx expo install` also re-registered the plugin and reformatted `app.json`; Prettier put the formatting back.
  - Your uncommitted `package.json` script change was stashed during the install and restored straight after. It was never committed.
- **2d icon and splash choices:**
  - iOS uses `ios.icon` with `light`, `dark` and `tinted` from `design/app-icons/ios`.
  - Android uses the adaptive foreground, background and monochrome layers. The background is now an image, not `#F4EFE7`.
  - Splash: `splash-mark-light/dark.png` with `imageWidth: 240` (the mark is about 31% of its canvas, so it shows about 75 dp wide), on `#E9EDE6` and `#131814`.
  - Alternatives: a smaller `imageWidth` (160 gives a mark about 50 dp wide).
- **2d also sets the Android notification icon.** `expo-notifications` gets `icon: ./assets/notification-icon.png`, which is white on transparent as Android requires. This changes no notification text. Alternative: leave the default icon.
- **The splash follows the phone's appearance, not Moraki's night mode.** The splash shows before any app code runs, so it can only follow the system light or dark setting (`userInterfaceStyle: automatic`). At 03:00 with the phone in light mode, the splash is day green, and then the app opens in night mode.
- **Not used from `design/app-icons`:**
  - `play-store-512.png` and `social-share-1200x630.svg`: store and marketing assets, not app config.
  - `apple-touch-icon-180`: the app has no web build to use it.
  - Icon Composer layers (`.icon` files for iOS 26 Liquid Glass): Expo SDK 57 takes them only through a separate `ios.icon` file path, so they are left for later.

- **3a: the pre-Sage token names now point at Sage values.**
  - Why: every screen, designed or not, shows Sage colours and type in day and night from this PR on, so no screen stays in the old style (step g).
  - Mapping (old name → Sage):
    - background → background
    - surface → card
    - surfaceSunken → chip
    - text → ink
    - textMuted → textSoft
    - accent → buttonPrimary
    - accentSubtle → selected
    - onAccent → onButtonPrimary
    - surfacePressed and divider → line
    - borderStrong → inputBorder
    - typography: display → title, title → heading, heading → tileTitle, bodyStrong → rowTitle, label → detail, caption → small
  - Step 4 moves the screens to the Sage names and deletes the aliases.
  - Alternative: restyle every style object screen by screen. That leaves the old look on any screen not reached and is far more churn.
- **3a: the shared primitives get the Sage shapes.**
  - main button 60 high and round
  - outlined secondary
  - round 50-high segments
  - round stepper buttons
  - round chip-filled inputs whose edge turns ink on focus
  - ink pill toast with a light Undo pill, raised clear of the floating tab bar
- **Consent (3a):** each of the four existing paragraphs sits in a tinted row with an icon: what → health, where → eu-shield, who → private, rights → export. Text, version, buttons and logic are unchanged.
- **Household setup (3a):** the "Born on {date}" line moves into the 03 feed-tinted note card. Same text.

- **3b: the tab bar is the default React Navigation bar, styled as the Sage pill, not the custom `TabBar` primitive.**
  - With the custom `tabBar`, one behaviour test (`src/sync/householdSettings.test.tsx`, "brings the baby's details back too") failed every time, but only when run after the three tests before it. It passed alone, in pairs, and with the default bar.
  - The default bar keeps press handling and accessibility exactly as before. It is drawn as the 66 pill, 30 above the edge, icons only, the active item a filled pill. The `TabBar` primitive stays in the showcase.
  - Alternative: find the test-harness timing issue. Recorded in section 3 instead.
- **3b, Home:**
  - Feed, Sleep, Diaper and Pump are activity tiles. The Feed tile shows the new title "Feed"; its accessible name stays "Log feed".
  - Health note and Medication are list rows. Medication uses the `health` icon; the set has no medicine icon.
  - The time-since-feed card is the 07 card on the feed colour, without the ring.
  - The running sleep, the duplicate question and the fridge and freezer tiles sit on tile colours.
  - Order and content are unchanged.
- **3b, tiles without detail lines.** The design shows "Last one 2 h ago" and similar on each tile. The tile row comes from `app/` and does not read the home data, and the timer card already shows the feed time. Alternative: pass the home view model into the tiles (a small `HomeScreen` API change).
- **3b, the header still says "Moraki".** The design uses the baby's name as the heading, but the home view model does not carry it. Left for later (DESIGN_GAPS has 05/06 headers).

- **D5: formSheet was not adopted; the fallback is used.**
  - D5 asked for a check with the keyboard open, at 200% text and on iOS and Android before adopting formSheet. None of that can run overnight without a device or a native build.
  - So the safe fallback applies: the platform modal stays, and the sheet, its header and content are on the card colour (`useSheetOptions` in `src/ui/theme/sheet.ts`, used by every log and edit route).
  - iOS draws its own modal corners, about 10, not 32. The design's 32 cannot be set on a plain modal.
  - To switch later, change `presentation: 'modal'` in `useSheetOptions` to `'formSheet'` and add `sheetCornerRadius: 32`, `sheetGrabberVisible: true` and `sheetAllowedDetents: [1]`. Then check the keyboard over the health note, the appointment questions and the weight field on both platforms.
- **3c-1: cards inside sheets.** The sheet is white, so a white `Card` inside it would vanish. The feed amount and breast blocks use the feed colour (08). The running sleep uses the sleep colour (11). The past-sleep block uses chip colour.
- **3c-1: the diaper time field moved under the three tiles**, as in 10 ("Changed her earlier? Pick time"). A tap on a tile still saves at once. Setting an earlier time still has to happen before the tap, as before.

- **3d, History:**
  - Each day's entries sit in one white card under the day heading. The list stays continuous, not paged by day.
  - The empty and filtered-empty texts use the Sage empty state with the existing copy as its title. No body line and no button: the History screen has no way to open a log sheet, so a button would be new behaviour.
- **3d, Insights:** cards keep their order and content and get icon headings: feed for the bottle and breast charts, insights for averages, time for days, weight for the weight card. Bars are ink, through the token aliases.

- **3e, Settings:** inline cards kept (D8). Each card heading gets a round badge on a tile colour with an icon:
  - account: invite
  - sync: time
  - privacy: private
  - reports: share
  - data: export
  - feedback: link
  - about: eu-shield
  - reminders: reminder
  - night mode: sleep
  - language: tab-settings
  - other account: private
  - local entries: export

  Feedback and language have no fitting icon in the set; see DESIGN_GAPS.
- **3e, caregivers** stay inside the Settings account card, restyled through the shared tokens and primitives. There is no separate 20 screen.

- **3f: `Card` takes an optional `tone`** (a tile colour). The call script uses it as 14 does: feeds on feed, diapers on diaper, and age on sleep. The rest stay white.
- **3f, PDF:** `reportHtml.ts` takes ink, soft text and line colours from `palette.light`, on white paper (`palette.light.card`), with the system font stack. It never uses night mode. The 5 hard-coded hex values are gone.

- **Step 4: the pre-Sage token names (`colors`, `typography`) stay as aliases.**
  - Moving about 330 references to `palette` and `type`, and changing the tests that read `colors.*`, is mechanical but wide. It changes nothing on screen.
  - Doing it in the middle of the night, right before the only build, was riskier than leaving it. Logged as SAGE-F2 in TASKS.md.

- **5a: tab bar width follows the design, not 18 pt margins.**
  - `design/screens/png/day/06-home.png` shows the pill 286 pt wide, centred, with about 52 pt margins on a 390 pt screen: four 64-wide items, 4 pt gaps, 9 pt inner padding. The brief said 18 pt margins "unless the design image clearly shows otherwise", and it does.
  - The bar keeps that natural width, centred, and never comes closer than 18 pt to the edge.
  - Alternative: 18 pt margins on both sides, giving a 354 pt pill with wider items.
- **5a: root cause of the phone screenshot.** Three causes in how the default React Navigation bar applies `tabBarStyle` and `tabBarItemStyle`:
  1. Its base style sets `start: 0, end: 0`. Logical `start` overrides `left`, so the bar sat at the left edge with my fixed `width`: off-centre, about two-thirds wide. Fix: set `start` and `end` themselves.
  2. `tabBarItemStyle` goes on an outer wrapper, but the active colour is painted by an inner pressable. That pressable has corner radius 0, padding 5 and `justifyContent: flex-start`, and only fills the wrapper through the `flex` taken from the item style. With `flex: 0` it was about 38 high inside a 48-high wrapper clipped to round corners, so the active pill looked cut at the bottom and at the left corner. Fix: `flex: 1` (the pressable fills the item; the wrapper's round, clipped corners give round ends), plus `tabBarLabelPosition: 'beside-icon'` (a centred row, so the icon sits in the middle).
  3. `sceneStyle.paddingBottom` ended every tab's content 96 pt above the bottom in a flat edge, which read as an opaque band. Fix: no scene padding; Home, History, Trends and Settings put `size.tabBarClearance` (66 + 30 + 24) at the bottom of their scroll content. The page shows around and under the pill.
  - Safe area: the bar's own `paddingBottom` (9) replaces the inset padding the default bar adds (34 on Face ID phones). Inside a 66-high bar, that inset was a second reason items could be squeezed or clipped.
- **5a, checked from the layout code:**
  - iPhone SE (375 pt): margins 44.5, the pill 286 wide; there is no home indicator, so 30 pt is clear of the edge.
  - iPhone 15 or 16 with Dynamic Island (393 / 402 pt): margins 53.5 / 58. The 30 pt offset sits above the home indicator (about 21 pt from the bottom).
  - Each item is about 64.5 × 48, at least the 48 touch target.
  - 200% text: the bar holds only icons, which do not scale, so its size does not change. The tab content scrolls fully clear above it.
  - A temporary probe test (not committed) confirmed the rendered styles:
    - bar: `start` and `end` set, 66 high, round;
    - item wrapper: 48 high, round, clipped;
    - inner pressable: `flex: 1`, centred row, active colour.

- **5b: logo assets rendered from the SVGs, not copied from the PNGs.**
  - The design's mark PNGs are 1560 × 1240, sharp but far larger than a 28 pt header needs.
  - `assets/logo/mark-day.png` (honey deep `#C9802F`) and `mark-night.png` (honey `#E8A55A`) are rendered from `design/logos/mark/*.svg` at 141 × 112. That is 4x for 28 pt and covers 3x (84 px). About 4 KB each.
  - The `Logo` primitive picks the asset by scheme and never sets `tintColor`. It is announced as a header with the label "Moraki".
  - On Home the header title is the mark, centred (`headerTitleAlign: 'center'` so Android centres it too). The other tabs keep their text titles.

- **5c: Stone palette, colour only.**
  - Every token is set on its own from the Stone table (no find-and-replace on hex), and `onSelected` is added.
  - Layout, type, sizes, icons, copy, token names and scheme names are unchanged.
  - Splash backgrounds: `#EEEDE7` by day and `#171411` at night. Logo colours and app icon files are unchanged.
- **5c: two values derived, since they are not in the Stone table:**

  | Token | Day | Night | Contrast |
  |---|---|---|---|
  | `inputBorder` | `#7C7973` | `#847E76` | Day 4.34 card, 3.70 chip and background. Night 4.04 card, 3.64 chip, 4.57 background. |
  | `invalid` | `#8E4434` | `#E2A693` | Day kept from Sage: 6.94 card, 5.92 background, at least 4.63 on every tile. Night changed from `#DDA08F`, which was 4.35 on the night feed tile: now 7.81 card, 8.83 background, 4.62 feed, at least 5.17 on the other tiles. |

  Both are warm neutral or clay, and both are tested.
- **5c: what changed because Stone's `selected` is dark:**
  - `Chip` (the only control drawing on `accentSubtle`, which was aliased to `selected`):
    - The selected fill is `palette.selected` and the label `palette.onSelected` (was ink, which would be dark on dark).
    - A 2 pt ink ring marks it: at night `selected` vs `card` is only 1.34:1, and the ring is 10+:1, so the state shows in shape, not only colour.
    - A pressed selected chip dims (opacity) instead of turning `line`, which would put a white label on a light fill.
  - The `accentSubtle` alias now points at `chip`. Its only other user is `Notice` (developer web banner), a soft tint behind dark text, not a selected state.
  - `ListRow` badges no longer accept `selected` as a fill. No screen used it, but it would put a dark icon on a dark fill.
  - Call script labels and "none" lines use `onTileSoft` instead of `textSoft`. Three of its cards sit on tile colours, and `textSoft` on the night feed tile is 4.35:1.
  - Checked and unchanged, because they already draw with their own on-colour:
    - Segmented selected (`buttonPrimary` / `onButtonPrimary`)
    - Tab bar active item and `TabBar` primitive (`tabActive` / `onTabActive`)
    - Toast Undo pill (`tabActive` / `onTabActive`)
    - Main button
    - Stepper (card-coloured buttons with ink symbols)
- **5c, unsure:**
  - **Chip vs Segmented at night.** A selected chip is a dark fill with an ink ring. A selected segment is the light `buttonPrimary` fill with dark text. Both are readable, but they look different. By day both are near-black with white text. To make them match, Segmented could use `selected`/`onSelected` too, which would be a design change.
  - **Segmented `selectedDisabled`** (feed kind while editing): a `line` fill with `textSoft` text, 5.45:1 by day and about 5.9 at night. It reads as disabled, not as the dark selected state, as before.

## 3. Problems found

These are recorded here only and not fixed, unless a PR says otherwise.

- **No splash plugin.** `app.json`'s `splash` key is read by nothing, and `assets/splash.png` is not in git. Details are in MAPPING.md section 1. PR 2d addresses it with `expo-splash-screen` (approved).
- **Preview builds cannot upload Sentry source maps.** See the build section at the top. This is a config issue already on main, not caused by the refresh.
- **Uncommitted owner change in the working tree.**
  - `package.json` scripts `ios` and `android` changed to `expo run:ios` / `expo run:android`, and a gitignored `ios/` folder exists. Both are the result of a local `npx expo run:ios`.
  - Not touched and never staged by this run.
  - For the final build, the change is stashed and restored afterwards, so the tree is clean (see section 1).
- **expo-doctor: 3 checks fail on main as well, and none is caused by this run.**
  - The `app.json` schema rejects `newArchEnabled`. It is the default in SDK 57; remove the key.
  - React Native Directory flags `expo-live-activity` as unmaintained and has no metadata for `expo-home-widget`. Both are local modules from the v1 cut; check whether they are still needed.
  - 10 Expo packages are one patch behind the SDK (`npx expo install --check`).
- **Prettier fails on main.** `npx prettier --check .` flags 6 files nobody in this run touches: `docs/01-research-and-poc-scope.md`, `docs/04-agent-loop-guide.md`, `docs/P0-01-manifest.md`, `public/404.html`, `public/el/terms/index.html`, `supabase/templates/sign-in-code.html`. CI does not run Prettier, so it never noticed. Fix: `npx prettier --write` on those 6 files, in a separate PR to main.
- **Stone pair outside the table that fails AA:** `textSoft` on the night feed tile, `#B8AD9F` on `#51432A`, is **4.35:1** (needs 4.5). Your value is kept. No screen draws `textSoft` on a tile now (call script moved to `onTileSoft`; tiles use `onTile` / `onTileSoft`). Nearest passing value: night `textSoft` `#BDB2A4` (about 4.6:1 on the feed tile; still above 7:1 on card and background). Alternatively, night `feed` `#4C3F27`.
- **Order-dependent behaviour test.** `src/sync/householdSettings.test.tsx`, test 5 ("brings the baby's details back too"), fails when Home uses a custom `tabBar` and the three earlier tests in the file have run (React logs "overlapping act() calls"). It passes alone or in pairs. The pull probably races the previous test's cleanup. Suggested fix: await the pull explicitly in that test, or isolate it in its own file. Not changed here; the tab bar uses the default component instead.
- **Outlined buttons.** Sage `outline` on `card` is 1.6:1 (night 1.57:1), below the 3:1 for a control's edge. The buttons always carry a text label. Fix if wanted: darken `outline` to about `#8A9586` (day) and `#6B776E` (night), which is a design decision.
- **Greek with names.** Existing strings put the baby's or a caregiver's name after `του/της`, `τον/την` or `Ο/Η` in the nominative. Listed in section 5.

### Final check (step 4)

- **Hard-coded values outside the theme:**
  - 0 hex values in TS/TSX outside `src/ui/tokens.ts`, including the PDF CSS.
  - 0 numeric radii.
  - 1 font stack in the PDF CSS (`-apple-system, Roboto, sans-serif`, the system fonts as approved).
  - 2 hex values in `app.json` (splash `#E9EDE6` / `#131814`; app config cannot read tokens).
  - Hex values in tests only (`Icon.test`, `contrast.test`, `settings.test`).
- **Sample names (Elena, Maria, Andreas, Eleni):** none added. They appear only in test fixtures and `docs/02-sdd-and-build-plan.md` that were already on main (for example "Eleni" in `householdSettings.test.tsx`).
- **No feature added or removed:**
  - The `app/` route files are identical to main.
  - The only dependency change is `expo-splash-screen` (approved).
  - `@expo/vector-icons` is no longer imported by app code, but stays installed: expo-router uses it.
- **`design/` is not in the bundle.** `npx expo export --platform ios` emits `assets/icons/*` and `node_modules` assets only, and the export log has no `design/` path. dependency-cruiser fails any import of `design/`.

## 4. Screens styled by analogy

| Screen | Modelled on | PR |
|---|---|---|
| Past sleep card and sleep edit form | 08 card and 11 header | 3c-1 |
| Edit entry (`/entry/[id]`) sheet colour and padding | Log sheets 08 to 11 | 3c-1 |
| Pump sheet | 08 stepper card on the pump colour; 16 choices | 3c-2 |
| Weight sheet | 03 weight field; 08 stepper | 3c-2 |
| Health note sheet | 18 fields; 12 chips; time in a status pill | 3c-2 |
| Medication sheet | 18 fields; time in a status pill | 3c-2 |
| Insights days table | 12 timeline card | 3d |
| History empty states (no design copy used) | `empty-states.html` History card | 3d |
| Settings sync, privacy, report, data, feedback, about, reminders, language cards | 19 grouped cards with badges | 3e |
| Settings other-account and local-entries cards | 19 card with badge (feed colour) | 3e |
| Caregiver roles and Remove (owner) | 20 member rows, via the account card | 3e |
| Report preview (`/report/[range]`) | 14 cards; 12 timeline for the days table | 3f |
| Call script notes, questions and worry field | 14 white cards | 3f |
| About | 19 grouped cards; disclaimer on the feed colour | 3g |
| Feedback | 18 fields; 19 segmented control | 3g |
| Leave or delete | 20 member cards; 19 lists; inline confirm kept | 3g |
| Startup screen and database failure | Page colour, matching the new splash | 3g |
| Undo toast, Sentry test toast | `empty-states.html` confirmation toast (3a primitive) | 3a |
| Home "Today" stats, appointment and milk stock cards | 06 cards and rows; 15 fridge and freezer tiles; 13 stat values | 3b |
| Home duplicate question | 12 duplicate warning (feed tint) | 3b |
| Home recent entries | 12 timeline card | 3b |
| Sign in (email, code, Apple, Google) | 01 welcome type and buttons; 03 inputs | 3a |
| Join, signed-out and already-in-household states | 02 join card; 01 for the plain states | 3a |

## 5. Greek

Rule (MAPPING.md section 6): the name stays in the nominative, as a label or after a colon or dash; no inflected name and no gendered article.

### New or changed strings

| Key | EN | EL | PR |
|---|---|---|---|
| `home.actions.feed` (new) | Feed | Τάισμα | 3b |

### Existing strings with a name inside a sentence (unchanged unless the screen's PR restyles them)

| Key | EL today |
|---|---|
| `home.duplicate.question` | Ο/Η {{name}} κατέγραψε επίσης τάισμα στις {{time}}. Το ίδιο τάισμα; |
| `settings.otherAccount.body` | … Μένουν χωριστά από το νοικοκυριό του/της {{name}} … |
| `settings.localEntries.body`, `_one` | … πριν μπεις στο νοικοκυριό του/της {{name}} … |
| `settings.roles.whatTheyCanDo` | Τι μπορεί να κάνει ο/η {{name}} |
| `settings.roles.remove` | Αφαίρεσε τον/την {{name}} |
| `join.alreadyIn` | Είσαι ήδη στο νοικοκυριό του/της {{name}} … |
| `erasure.*.what` (4 keys) | … για {{name}} … |

## 6. Deviations from the design

- **Design screens are still Sage.** The HTML and PNG files in `design/screens` show the Sage colours and are now a layout reference only. `design/guidelines/brand-guidelines.md` (colour section) and `design/guidelines/tokens/*` give the Stone values.
- **Fonts.** System font, not Ysabeau Infant or Commissioner (owner's brief). Weights follow the design: 500, 600, 800.
- **Icons.** 256 px PNGs with one stroke width. The design varies the stroke from 1.4 to 1.8 by size; here it scales with the icon.
- **Glyph icons.** Back, close and similar are text glyphs (section 2).
- **Touch target.** 48, not 44 (D7).
- **Input border.** Text inputs get a 2 px `inputBorder` edge (day `#717E75`, night `#7E8B81`, at least 3:1 on card, chip and background). The design draws inputs with no edge, which would leave a chip-coloured field nearly invisible on a white card (about 1.2:1). Focus turns the edge ink, like the design's focused field.
- **Order-dependent behaviour test.** `src/sync/householdSettings.test.tsx`, test 5 ("brings the baby's details back too"), fails when Home uses a custom `tabBar` and the three earlier tests in the file have run (React logs "overlapping act() calls"). It passes alone or in pairs. The pull probably races the previous test's cleanup. Suggested fix: await the pull explicitly in that test, or isolate it in its own file. Not changed here; the tab bar uses the default component instead.
- **Outlined buttons.** They use the design's `outline` colour (about 1.6:1). Their text label identifies them.
- **Stepper.** The value uses Sage `title` (36), not the design's 50 or 66, so the row fits at 200% text. The buttons stay 64 (the app's one-handed size) instead of 56.
- **Sheet corners.** About 10 (native iOS modal), not 32 (D5 fallback, section 2).
- **Feed amount.** The stepper keeps −/+ with the amount between them. The design's three tiles (−10, "same as last", +10) are not used, because "same as last" is design only.
- **Diaper tiles.** Three across in one row, label under the icon, no "+".
- **History rows** keep their divider line, so the first row of each day shows a line at the top of its card.
- **Join code field.** It uses the standard text field, not the design's letter-spaced 20/800 code style, because `TextField` takes no style override and adding one is out of scope.

- **Activity tile:** the design's "+" is its own button. Here it is drawn inside a single tile button, to avoid two nested targets doing the same thing.
- **Empty state:** corners are 32 (`radius.tile`), not the board's 36, which is not a token.

## 7. Things to check on the device

**Icons (2b)**
- Icons look crisp in day and night.
- Glyphs (‹ × +) sit centred in their buttons.

**Components (2c), on the dev screen `/primitives`**
- Tiles, rows, tab bar and empty state in day and night.
- Set the phone to the largest text size: tiles and rows grow, nothing is clipped.

**App icon and splash (2d): native, so only the EAS preview build shows them**
- The final EAS preview build is the first real test of the splash plugin and the new icons. The dev client cannot show them, and no local native build was run.
- Home screen icon: light, dark and tinted (long-press the home screen, then Edit, then Customize).
- Cold start with the phone in light mode: mark on pale sage `#E9EDE6`. With the phone in dark mode: mark on `#131814`.
- Android (if you build it): adaptive icon in round and squircle masks, the themed (monochrome) icon, and the notification icon in the status bar.
- To see them locally later without EAS: `npx expo run:ios` builds on your Mac. It rewrites the `ios`/`android` scripts in `package.json`, as happened before.

**Onboarding (3a)**
- Sign in: round email and code fields, a dark main button, outlined Apple, Google, Resend and Change email.
- Household setup: "Born on" in the pale green note card; chips wrap at 200% text.
- Join: link icon beside the intro, and the deep link `moraki.app/join/CODE` still opens the form with the code.
- Consent: four tinted rows with icons and the existing text in full. Agree, then Withdraw, still work.
- In every log sheet, the undo toast is an ink pill with a light Undo pill. It sits higher than before (clear of where the tab bar will float).

**Home and tab bar (3b)**
- The tab bar floats as a dark pill (light at night), centred, with no labels. The active tab is a light pill. VoiceOver reads Home, History, Trends and Settings.
- Content never hides behind the bar; scroll to the bottom of Home and Settings.
- The tiles open feed, sleep, diaper and pump. The health note and medication rows open their sheets.
- The timer card is pale olive, centred, with a large timer.
- Night mode: tiles turn deep olive, slate, green and brown; the text stays readable.
- At 200% text, tiles grow taller and nothing is cut off.

**Log sheets: feed, diaper, sleep (3c-1)**
- Each sheet opens as the usual modal, now white (night: dark green-grey).
- Feed: time in a pill at the top; the bottle amount, milk and stock choices on a pale olive card; Save at the bottom.
- Diaper: one tap on Wet, Dirty or Both saves, closes the sheet and shows Undo. Pick an earlier time first by scrolling down to the time field.
- Sleep running: pale slate card, moon, "since 03:12", dark Stop.
- Past sleep: grey card with both steppers and both time fields. Save is disabled when the end is before the start.
- Keyboard: none of these three sheets has a text field.
- 200% text: the diaper tile labels may wrap onto two lines; they must not be cut off.

**Pump, weight, health, medication (3c-2)**
- Pump: the amount and the fridge, freezer or fed choice on a pale brown card.
- Weight: type grams; the field edge turns ink while typing and clay with a message when out of range; Save disabled.
- Health note: the keyboard must not cover the note or temperature field; scroll works with the keyboard open.
- Medication: the name is prefilled from the last one; the time shows in a pill.

**History and Insights (3d)**
- History: days as white cards on the pale page; filters as round chips; tap an entry to edit.
- With no entries: a slate tile with the list icon and "Nothing logged yet".
- Insights: ink bars; each card has an icon; the weight chart marks clinic and home weights and shows its legend.

**Settings, invite, baby (3e)**
- Settings: each card starts with a coloured round badge and icon. Night mode Auto/On/Off still switches live.
- Owner: the roles switcher and Remove still work in the account card.
- Invite: the code shows large, letter-spaced, on a grey pill; Share opens the system sheet.
- Baby details: Save still disabled for a caregiver who cannot edit.

**Visits, stock, reports (3f)**
- Appointment sheet: fields, questions, add and remove question; the keyboard does not hide the question field.
- Stock sheet: fridge or freezer, add or remove, amount, reason.
- Call script: feeds card pale olive, diapers pale green, age pale slate; the worry field takes text.
- Share PDF: the PDF prints dark green-grey text on white, even at night.

**About, feedback, leave or delete, startup (3g)**
- About: the disclaimer on pale olive; links open.
- Feedback: kind, message, Send; the sent card.
- Leave or delete: each card's inline confirm, the successor picker and the "cannot undo" line, with no dialog.
- Cold start: after the splash, the startup screen is the same pale sage (night: deep green), not cream.

**Tab bar (5a)**
- The pill is centred with equal margins, with the page and the cards visible on both sides and below it.
- The active tab is a light pill with round ends on every side; all four icons are centred.
- On Home, scroll to the bottom: the "Σήμερα / Today" card and the cards after it scroll fully above the pill.
- History, Trends and Settings: the last item scrolls clear of the pill.
- Night: a light pill with a dark active item.

**Header logo (5b)**
- Home header: the mark alone, centred, about 28 pt high. Honey deep by day, lighter honey at night; never green or grey.
- VoiceOver on the header reads "Moraki, heading".
- History, Trends and Settings keep their text titles.

**Stone palette (5c), read from the code**
- Day pages are warm stone `#EEEDE7` with white cards and near-black text. Tiles are saturated: yellow feed, pink sleep, lavender diaper, mint pump. Check that the tile text (near-black) is comfortable on the yellow feed tile and the Home timer card.
- Night: deep warm brown, tiles muted olive, plum, indigo and pine with light text. The night feed tile is the darkest pair; its detail text uses `onTileSoft` (`#D3C8BA`, 5.8:1).
- Chips (History filters, relation chips in setup and join, health tags): selected is near-black with white text by day; dark with a light ring and light text at night. Press a selected chip: it dims and the label stays readable.
- Segmented controls (feed kind, milk, side, stock, night mode, language): selected is near-black with white text by day, light with dark text at night.
- Inputs: chip-coloured with a grey-brown edge that turns ink on focus. An error turns the edge and the message clay (night: lighter clay).
- Toast: dark pill with a white Undo pill by day; light pill with a dark Undo pill at night.
- Main button: near-black by day, light at night.
- Diaper sheet: three lavender tiles with dark icons.
- Tab bar: near-black pill, white active item by day; light pill, dark active item at night.
- Splash: `#EEEDE7` by day and `#171411` at night, with the honey mark.
- PDF: near-black text on white, whatever the night mode.
