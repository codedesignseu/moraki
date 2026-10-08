# Sage refresh: review notes

Written during the overnight run (started 2026-10-09). Updated after every PR so it survives a lost session. Mapping is in [MAPPING.md](MAPPING.md), and gaps are in [DESIGN_GAPS.md](DESIGN_GAPS.md).

Final EAS preview build: _not run yet_

## 1. Status

All PRs target `design/sage-refresh` and use merge commits.

| PR | Branch | What | State | CI |
|---|---|---|---|---|
| #132 | `sage/01-mapping` | Step 1 mapping | merged | green |
| #133 | `sage/02a-tokens` | Tokens, `design/` export and exclusions | merged | green |
| _next_ | `sage/02b-icons` | Icons and the `Icon` primitive | in progress | |

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

## 3. Problems found

These are recorded here only and not fixed, unless a PR says otherwise.

- **No splash plugin.** `app.json`'s `splash` key is read by nothing, and `assets/splash.png` is not in git. Details are in MAPPING.md section 1. PR 2d addresses it with `expo-splash-screen` (approved).
- **Uncommitted owner change in the working tree.**
  - `package.json` scripts `ios` and `android` changed to `expo run:ios` / `expo run:android`, and a gitignored `ios/` folder exists. Both are the result of a local `npx expo run:ios`.
  - Not touched and never staged by this run.
  - For the final build, the change is stashed and restored afterwards, so the tree is clean (see section 1).
- **Prettier fails on main.** `npx prettier --check .` flags 6 files nobody in this run touches: `docs/01-research-and-poc-scope.md`, `docs/04-agent-loop-guide.md`, `docs/P0-01-manifest.md`, `public/404.html`, `public/el/terms/index.html`, `supabase/templates/sign-in-code.html`. CI does not run Prettier, so it never noticed. Fix: `npx prettier --write` on those 6 files, in a separate PR to main.
- **Outlined buttons.** Sage `outline` on `card` is 1.6:1 (night 1.57:1), below the 3:1 for a control's edge. The buttons always carry a text label. Fix if wanted: darken `outline` to about `#8A9586` (day) and `#6B776E` (night), which is a design decision.
- **Greek with names.** Existing strings put the baby's or a caregiver's name after `του/της`, `τον/την` or `Ο/Η` in the nominative. Listed in section 5.

## 4. Screens styled by analogy

| Screen | Modelled on | PR |
|---|---|---|

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

## 7. Things to check on the device

**Icons (2b)**
- Icons look crisp in day and night.
- Glyphs (‹ × +) sit centred in their buttons.
