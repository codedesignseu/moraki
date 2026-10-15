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

## Problems found

- **Chart bars are under 3:1 on white** (`#E9CF7A` is about 1.5:1 on the card). Each bar has its value printed above it, so the colour is never the only cue, and no contrast test covers the bars. Check on the device that short bars are visible.

## Things to check on the device

- The splash background change (`#F3F2EE`) needs a native build to show.

## Found while working
