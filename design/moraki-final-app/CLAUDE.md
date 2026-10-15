# Moraki · final redesign brief for Claude Code

The Moraki app already exists. Its stack, data model and features stay exactly as they are. This folder is the approved final design (direction G). Apply it to the app's existing screens.

## Ground rules

1. The codebase decides what the app does. These designs decide how it looks and reads.
2. Don't add features, screens, fields, packages or API calls because a design shows them. The one exception is the two font packages named below.
3. Don't remove features that have no design. Style them with the same tokens and components.
4. Keep data flow, validation, sync, roles and permissions exactly as they are.
5. Ask before touching the database, auth, sync or any other dependency.

## Sources of truth

- `tokens/theme.ts` holds every colour (day and night), font, type size, radius and size. Port it into the app's theming. Never hard-code a hex value in a screen.
- `screens/**/<name>-day.html` and `-night.html` hold layout, copy and spacing. Read the inline styles for exact values. The PNGs show layout only, because they use a fallback font.
- `screens/foundations/foundations.html` shows every component in both themes.
- `NOTES.md` lists every place the design departs from the written brief.

## What makes it look like G

- **Fonts:** Comfortaa for headings, sheet titles and big numbers. Manrope for everything else. Install them with `npx expo install @expo-google-fonts/comfortaa @expo-google-fonts/manrope`.
- **Home:**
  - A greeting with the logo in a butter circle.
  - The butter "Since last feed" card, with a darker butter circle, the feed icon in a dark circle, and a "Log a feed" button.
  - Four tiles (Feed, Sleep, Diaper, Pump). Each has its own colour, a white icon circle, a small dark + badge, its name and the last time.
- **Tapping a tile:** the log opens as a sheet sliding up over a dimmed Home. The sheet has 32 top corners, a grab handle, the type icon, title and subtitle at the top left, and a round close button at the top right.
- **Choices in sheets:** big rounded buttons, 64 high. The selected one is dark and the others use the tile colours.
- **Steppers:** sit in a soft grey box, with round white − and + buttons.
- **Tab bar:** a white floating pill of four round 52 buttons, 30 above the bottom. The active button is dark. At night the pill is dark and the active button is light.

## Rules from the brief that still apply

- One dark main button per screen, 60 high. Touch targets are at least 48 high.
- Undo toast instead of confirm dialogs. Only household and account deletes use the inline confirm.
- Errors appear inline in the error colour, with an icon and the word "Error". Disabled controls keep their shape.
- No medical wording. Colour never carries meaning alone.
- Night mode is Auto (21:00 to 06:00), On or Off. Every screen has a night file.
- The logo keeps honey deep by day and honey at night.

## Steps

1. Map every app screen to its design in `screens/screens.json`. Write the map to `design/MAPPING.md` and show it to Makis before editing.
2. Port the tokens and fonts, then build the shared components from the foundations board.
3. Restyle in this order: Home, Feed, Diaper, Sleep, History, Trends, Settings, then everything else.
4. Check each screen against both its day and night file. Commit each screen on its own.
