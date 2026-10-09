# Sage refresh: review notes

Written during the overnight run (started 2026-10-09). Updated after every PR so it survives a lost session. Mapping is in [MAPPING.md](MAPPING.md), and gaps are in [DESIGN_GAPS.md](DESIGN_GAPS.md).

Final EAS preview build: _not run yet_

## 1. Status

All PRs target `design/sage-refresh` and use merge commits.

| PR | Branch | What | State | CI |
|---|---|---|---|---|
| #132 | `sage/01-mapping` | Step 1 mapping | merged | green |
| #133 | `sage/02a-tokens` | Tokens, `design/` export and exclusions | merged | green |
| #134 | `sage/02b-icons` | Icons and the `Icon` primitive | merged | green |
| #135 | `sage/02c-components` | New Sage components | merged | green |
| #136 | `sage/02d-app-icons` | App icon, splash, `expo-splash-screen` | merged | green |
| _next_ | `sage/03a-onboarding` | Token aliases, primitive shapes, onboarding screens | in progress | |

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

## 3. Problems found

These are recorded here only and not fixed, unless a PR says otherwise.

- **No splash plugin.** `app.json`'s `splash` key is read by nothing, and `assets/splash.png` is not in git. Details are in MAPPING.md section 1. PR 2d addresses it with `expo-splash-screen` (approved).
- **Uncommitted owner change in the working tree.**
  - `package.json` scripts `ios` and `android` changed to `expo run:ios` / `expo run:android`, and a gitignored `ios/` folder exists. Both are the result of a local `npx expo run:ios`.
  - Not touched and never staged by this run.
  - For the final build, the change is stashed and restored afterwards, so the tree is clean (see section 1).
- **expo-doctor: 3 checks fail on main as well, and none is caused by this run.**
  - The `app.json` schema rejects `newArchEnabled`. It is the default in SDK 57; remove the key.
  - React Native Directory flags `expo-live-activity` as unmaintained and has no metadata for `expo-home-widget`. Both are local modules from the v1 cut; check whether they are still needed.
  - 10 Expo packages are one patch behind the SDK (`npx expo install --check`).
- **Prettier fails on main.** `npx prettier --check .` flags 6 files nobody in this run touches: `docs/01-research-and-poc-scope.md`, `docs/04-agent-loop-guide.md`, `docs/P0-01-manifest.md`, `public/404.html`, `public/el/terms/index.html`, `supabase/templates/sign-in-code.html`. CI does not run Prettier, so it never noticed. Fix: `npx prettier --write` on those 6 files, in a separate PR to main.
- **Outlined buttons.** Sage `outline` on `card` is 1.6:1 (night 1.57:1), below the 3:1 for a control's edge. The buttons always carry a text label. Fix if wanted: darken `outline` to about `#8A9586` (day) and `#6B776E` (night), which is a design decision.
- **Greek with names.** Existing strings put the baby's or a caregiver's name after `του/της`, `τον/την` or `Ο/Η` in the nominative. Listed in section 5.

## 4. Screens styled by analogy

| Screen | Modelled on | PR |
|---|---|---|
| Sign in (email, code, Apple, Google) | 01 welcome type and buttons; 03 inputs | 3a |
| Join, signed-out and already-in-household states | 02 join card; 01 for the plain states | 3a |

## 5. Greek

Rule (MAPPING.md section 6): the name stays in the nominative, as a label or after a colon or dash; no inflected name and no gendered article.

### New or changed strings

| Key | EN | EL | PR |
|---|---|---|---|

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

- **Fonts.** System font, not Ysabeau Infant or Commissioner (owner's brief). Weights follow the design: 500, 600, 800.
- **Icons.** 256 px PNGs with one stroke width. The design varies the stroke from 1.4 to 1.8 by size; here it scales with the icon.
- **Glyph icons.** Back, close and similar are text glyphs (section 2).
- **Touch target.** 48, not 44 (D7).
- **Input border.** Text inputs get a 2 px `inputBorder` edge (day `#717E75`, night `#7E8B81`, at least 3:1 on card, chip and background). The design draws inputs with no edge, which would leave a chip-coloured field nearly invisible on a white card (about 1.2:1). Focus turns the edge ink, like the design's focused field.
- **Outlined buttons.** They use the design's `outline` colour (about 1.6:1). Their text label identifies them.
- **Stepper.** The value uses Sage `title` (36), not the design's 50 or 66, so the row fits at 200% text. The buttons stay 64 (the app's one-handed size) instead of 56.
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
