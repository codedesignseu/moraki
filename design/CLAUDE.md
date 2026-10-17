# Moraki · design refresh brief for Claude Code

The Moraki app is already built. Its stack, data model and features are decided, and this brief doesn't change any of them. Your job is to apply the new Sage design to the app as it exists today.

The approved design lives in this folder. Some screens in it show features the app doesn't have, and some app features have no screen here. Restyle what exists. Don't build what doesn't.

## Ground rules

1. **The codebase decides what the app does.** The design only decides how it looks and reads.
2. **Don't add features, screens, fields, tables, API calls or packages** just because a design shows them. List them instead (see step 5).
3. **Don't remove or hide existing features** because the design has no screen for them. Style them with the same tokens and components.
4. **Don't change the stack.** Use the app's existing navigation, state, styling and i18n setup.
   - `guidelines/tokens/theme.ts` is written for React Native. Treat it as a source of values and port them into the theming the app already uses.
5. **Keep behaviour the same.** That means data flow, validation, sync, permissions and analytics events. Only layout, styling, icons, copy and visual states change.
6. **Ask before anything risky.** That includes any change touching the database, auth, the sync logic or a dependency. Ask first and wait for a yes.

## Step 1 · Map the app before you change anything

Read the project's root CLAUDE.md, README and package files first. Then write `design/MAPPING.md` with:

- The stack you found: framework, navigation, styling approach, theming, font loading, icon setup, i18n.
- Every screen and modal in the app, with its file path.
- For each one, the design screen that matches it from the table below, or "no match".
- **Design only:** design screens or elements with no matching feature in the app. These are left out.
- **App only:** app features with no design. These get styled from the kit.

Stop and show MAPPING.md to Makis before you edit any screen.

## Step 2 · Foundations

Do these once and reuse them everywhere:

- **Tokens.** Add the Sage day and night palettes, type scale, radius, spacing and sizes from `guidelines/tokens/`. Replace hard-coded colours and sizes across the app with tokens.
- **Night mode.** Day and night palettes follow the app's existing theme or appearance setting.
  - If the app has no setting yet, ask before adding one.
  - The design's default is Auto from 21:00 to 06:00, with On and Off.
- **Fonts.** Use Ysabeau Infant for all app text and Commissioner for the wordmark only. `fonts/README.md` has the install options. Load them the way the app already loads fonts.
- **Icons.** Replace the current icons with the set in `ui-icons/svg`: 24 grid, 1.6 stroke, using `currentColor`. Use the app's existing SVG approach.
  - If an icon the app needs is missing, draw it in the same style and add it to the set.
- **Shared components.** Build these from `guidelines/ui-kit.html`:
  - Main button (60 high, fully round, one per screen).
  - Outlined button.
  - Chip and segmented control.
  - Activity tile (corner 32).
  - Card and list row (corner 26).
  - Bottom sheet (32 top corners).
  - Floating tab bar (66 high, 30 from the bottom).
  - Icon button (46).
  - Text field.
  - Empty state.
- **App icon, splash and favicons.** Swap in the files from `app-icons/`, using the app's current config (`app.json`, Xcode assets, Android res or the equivalent).
  - Splash background is #E9EDE6 for day and #131814 for night.

## Step 3 · Restyle screen by screen

Work through MAPPING.md one screen at a time. For each screen:

1. **Open the design.** Use `screens/day/<id>.html` and `screens/night/<id>.html`. The inline styles give exact sizes, gaps and colours. Map every value to a token.
2. **Keep the app's data.** Keep its real data, fields and actions. Place them using the design's layout, hierarchy and components.
3. **Match field by field.** When the design shows a field the app lacks, leave it out. When the app has a field the design lacks, place it in the same visual style.
4. **Check both modes.** Compare the screen against the day and night PNGs in `screens/png/`. The PNGs use a fallback font, so judge layout from them and type from the HTML.
5. **Commit each screen on its own.**

## Design screens

The sample data is Elena, 12 days old, with parents Maria and Andreas. Never ship it. Use the app's real data, and keep the design's sentence patterns where the copy fits.

| id | Design screen | What it shows |
|---|---|---|
| 01-welcome | Welcome | Start a new log, or join with an invite |
| 02-household | Household | Create a household, or join one with a code |
| 03-baby-details | Baby details | Name, birth date, birth weight in kg or lb |
| 04-consent | Consent | Data terms that each parent agrees to |
| 05-home-empty | Home, first run | Log the first feed, invite your partner |
| 06-home | Home | Feed, sleep, diaper and pump tiles with a quick "+", a health row and "Coming up" |
| 07-home-timer | Home, alternative | Time since the last feed as the hero. Use it only if it suits the app's home better than 06. |
| 08-feed-bottle | Feed, bottle | Bottle, breast or both. Amount stepper and who is feeding. |
| 09-feed-breast | Feed, breast | Left and right timers, with the last side remembered |
| 10-diaper | Diaper sheet | One tap for wet, dirty or both, with undo and an earlier-time option |
| 11-sleep | Sleep running | Live timer and a stop button |
| 12-history | History | Day timeline with who logged each entry and a duplicate warning |
| 13-insights | Insights | 7 or 14 day bars, averages and a weight chart |
| 14-call-script | For the doctor | 24-hour summary |
| 15-milk-stock | Milk stock | Fridge and freezer, oldest first |
| 16-milk-adjust | Update stock sheet | Added, used, moved or thrown away |
| 17-appointments | Doctor visits | Next visit with questions, plus past visits |
| 18-appointment-add | Add visit sheet | Day, time, type, clinic, questions, reminders |
| 19-settings | Settings | Grouped settings and night mode |
| 20-caregivers | Caregivers | Roles, invite link, remove someone |

`guidelines/empty-states.html` has empty-state copy and layout for history, insights, milk stock and visits, plus two small confirmations.

## Rules that apply to every screen

- **One main button per screen.** It's the only dark button, and it sits in the bottom third.
- **Touch targets** are at least 44 × 44, and text scales with the phone setting up to 200 percent.
- **Colour never works alone.** Always pair it with an icon and a label.
- **Logging stays fast.** Where the app already saves on tap, keep it that way. Don't add confirm dialogs.
- **Keep the logo's own colours,** honey #E8A55A and ink #2A211C, in every theme. Never tint it sage.
- **Copy is warm and short.**
  - Use the baby's name.
  - Never say "normal" or "concerning".
  - Copy changes go through the app's existing i18n files. Add Greek strings next to the English ones if the app already has Greek.

## Done means

- Every screen in MAPPING.md is restyled in day and night.
- No hard-coded colours, fonts or radii remain outside the theme.
- No features were added or removed.
- The design-only and app-only lists in MAPPING.md are up to date, so Makis can decide what to design or build next.
