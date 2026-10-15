# Direction G: review notes

Open questions, judgment calls and deviations from the G build (docs/design/MAPPING_G.md section 8). Each entry says what was done and what changes if the owner disagrees.

## Decisions made without asking

- **Step 1, night `textSoft` is `#BBB0A2`, not `#B8AD9F`.** G draws soft text on the night feed tile (the Home hero's "Feed reminder at" line, the greeting badge). `#B8AD9F` on `#51432A` is 4.35:1, under AA 4.5:1. `#BBB0A2` is the nearest lighter step that passes (4.50:1), and it reads the same. `disabledText` keeps G's `#B8AD9F`, because on `disabledFill` it passes (6.6:1). If the owner disagrees: set `textSoft` back to `#B8AD9F` in `src/ui/tokens.ts`, and draw soft text on tiles in `onTileSoft` instead.
- **Step 1, card corners.** theme.ts says 28 for every card. The screens draw most cards at 26 and the hero and tiles at 28. Screens win: `radius.card` 26, `radius.tile` and `radius.hero` 28.
- **Step 1, kept token names.** Screens still read pre-G names. They now point at G values, so nothing breaks but the look moves to G right away:
  - `tabBar`/`onTabBar`/`tabActive`/`onTabActive` → `navBar`/`ink`/`navActive`/`navActiveIcon`. The tab bar turns white by day with a dark active button before step 6 restyles it.
  - `size.tabItemWidth`/`tabItemHeight` → 52 (`navButton`), `size.tabBar` → 68, `size.activityTile` → 132 (a minimum height, so tiles still grow).
  - `invalid` → `error`. `onTile` → `ink`. `onTileSoft` keeps its Stone values (it passes on every G tile).
  - `type.title` is now 30 (was 36). `type.display`, `heading` and `title` are weight 700 (were 800), the weight Comfortaa ships.
  - The steps that restyle each reader remove the kept names.
- **Step 1, screen-only values** added to `tokens.ts` with the screen they came from: `chartFeed`/`chartSleep` (tabs/trends), `switchOn` (tabs/settings; `#34A853` by day, ink `#F1EAE0` at night as the night file draws it), `navShadow` plus `shadow.nav` (0 6 24 at 10%; the night bar has none, so the night colour is transparent).
- **Step 1, Android adaptive icon** uses a background image, not `#EEEDE7`, so only the splash colour changed. MAPPING_G says brand files stay byte-identical.
- **Step 2, font loading holds the startup screen.** `app/_layout.tsx` loads the five faces with `useFonts` and passes `hold` to `DatabaseGate`, which keeps its blank opening screen until they load. If loading fails, the app goes on in the system font rather than staying blank. Only the five files are imported (subpaths), not every weight of each package.
- **Step 2, no `fontWeight` in type styles.** Each style names its weighted family (`Comfortaa_700Bold`, `Manrope_500Medium` …). Android takes the weight from the family name, and a `fontWeight` next to it could add a fake bold. `BarChart`'s "today" label used `fontWeight` from `bodyStrong`. It now spreads `type.tileLabel` (Manrope 800) at the caption size.
- **Step 3, icon stroke is 1.6, not 1.8.** The brief and MAPPING_G say 1.8. The icon set itself (`design/ui-icons/svg`, and `brand/ui-icons/svg` in the export) is drawn at 1.6, and the 23 shipped PNGs are 1.6. The inline screen SVGs use 1.8. The new icons are drawn at 1.6 so they match the icons beside them. If the owner wants 1.8, it should apply to the whole set: change `stroke-width` in the SVGs and render them again (see below).
- **Step 3, new icons:** `check` and `alert` reuse the screens' paths (consent-agreed, settings warning). `close`, `chevron`, `mail`, `stop`, `plus` and `minus` are new, drawn on the 24 grid with round caps. The clock and the thermometer were already in the set as `time` and `health`, so they weren't added again. The SVG sources go in `design/ui-icons/svg` (the Icon test keeps that folder and `assets/icons` in step). They were rendered to 256 px black-on-transparent PNGs with a small Swift script using AppKit, which draws SVG. Rendered the same way, the existing `time.svg` matches `assets/icons/time.png` to within anti-aliasing (mean alpha difference 0.4/255). No npm dependency was added. `design/ui-icons/png-ink` and `png-night` (the 96 px design exports) are not updated.
- **Step 3, `check`, `close`, `plus` and `minus` are now line icons, not text glyphs.** The names now point at PNG files, so the glyph entries went (the Icon primitive picks a glyph first). This visibly changes the "+" on the Home tiles and header and the showcase. `back` and `forward` stay glyphs. G itself draws ×, +, − and › as text, so if the owner prefers glyphs: put them back in `GLYPHS` and rename the icons.
- **Step 3, badge icon and tone on the activity modules.** `ActivityModule` now requires `icon` (a key of the UI icon set, as a plain string: `ACTIVITY_ICONS`) and `tone` (a palette name: `BADGE_TONES`). Every module fills them. This changes the contract that every module implements, but no module's behaviour, and the completeness test checks both. Tones come from G history: feeds butter, diaper blue, sleep pink, pump and health green. Weight is green and appointment blue, from the G cards. Milk stock (pump icon, green) and medication (health icon, green) have no G row, so I chose these. A UI test checks that each icon and tone resolves.
- **Step 4, Stepper number is 48, not heroNumber's 38.** Every sheet draws the stepper value at 48 (feed, pump, foundations) and the weight sheet at 32. Screens win: new type tokens `stepperValue` (48) and `stepperValueCompact` (32), picked with `size="compact"`. The unit is a nested soft span, so the text still reads "90 ml" as one string.
- **Step 4, Stepper buttons are 52 with a 6 hit slop.** G draws 52 round buttons. The old 64 one-handed target is kept through `hitSlop`, so the touch area is still 64. If the owner wants a 64 visual button, set `size.stepperButton` to 64.
- **Step 4, disabled steps at night.** Night `disabledFill` is the same colour as the chip box (`#2C2823`), so a stepper button at its bound keeps its card fill and shows a soft icon, and a disabled selected segment uses `line`. G has no disabled stepper or segment to copy.
- **Step 4, Chip `fill` prop.** Chips sit on cards in sheets (`chip` fill) and on the screen background in History (`card` fill, tabs/history). `fill="card"` gives the History look; the default is `chip`. The selected chip shows the `check` line icon where G draws a "✓" text glyph.
- **Step 4, TextField.** Label 13/600 (`type.small`, was 15), transparent fill (was the chip fill), 1.5 `inputBorder` edge, corner 16, 54 high (110 for multiline). The label-to-field gap is 4 (G: 6), from the spacing scale. New props: `icon`, `suffix`, `disabled`, `errorPrefix`, `testID`. `ui/` may not import i18n, so the "Error" word comes in as `errorPrefix` (and `InlineError`'s `prefix`); screens pass `t('common.error')` when they adopt it. Until then, error messages show without the prefix, as today.
- **Step 4, InlineError joins prefix and message as "Error: message"** in the component. Greek reads "Σφάλμα: …" the same way.

## Problems found

- **Chart bars are under 3:1 on white** (`#E9CF7A` is about 1.5:1 on the card). Each bar has its value printed above it, so the colour is never the only cue, and no contrast test covers the bars. Check on the device that short bars are visible.
- **Step 4, the feed sheet's stepper sits inside the old tile-coloured panel** until step 9 restyles the sheet, so the grey stepper box shows on yellow for a few PRs. Same for Settings and Baby, whose steppers now draw their grey box inside a white card (which is how G draws them).

## Things to check on the device

- The splash background change (`#F3F2EE`) needs a native build to show.
- Greek text in Comfortaa and Manrope, at 200% text size. Comfortaa line height is 1.15, so check that accents on capitals aren't clipped.
- The first launch shows no flash of system font. The startup screen stays blank until the fonts are in.
- Step 4: the Stepper and ChoiceButtons at 200% text. The 48 number may wrap to two lines on a narrow phone.

## Found while working
