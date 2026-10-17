# Moraki · final app design (direction G)

Every page and state from the Moraki screens brief, drawn in the direction G look, in day and night.

## What's inside

```
CLAUDE.md        Brief for Claude Code: apply this design to the existing app
NOTES.md         What changed from the written brief, and why
screens/
  foundations/   Foundations board (colours, type, components, icons) and the notes board
  tabs/          Home, History, Trends, Settings, with their states
  sheets/        Feed, Diaper, Sleep, Pump, Health note, Medication, Weight, Milk stock, Appointment, Edit entry
  account/       Welcome, Sign in, Household setup, Join, Consent, Invite, Baby details, Leave or delete, About, Feedback
  reports/       Call script, Report preview, PDF page, startup, splash, loading
  greek/         Home, Feed, Settings and Consent in Greek (day)
  screens.json   Every screen with its title, section, size and files
tokens/          moraki-tokens.json, theme.ts, tokens.css, colours.csv
brand/           Logo files, app icons, splash marks and the 23 UI icons
```

Each screen comes as an HTML file and a PNG. The HTML has the exact sizes and colours.

## Fonts

- Headings and big numbers use Comfortaa.
- Body text uses Manrope.

Both are free Google Fonts (SIL Open Font License), and both cover Greek. The HTML files load them from Google Fonts, so they look right in any browser that's online.

The PNGs were made where Google Fonts couldn't load, so they show a fallback font. Use them for layout only.

In the app, install the fonts with:

```
npx expo install @expo-google-fonts/comfortaa @expo-google-fonts/manrope
```

## Counts

- 52 screens and states, each in day and night.
- 4 Greek screens.
- 1 PDF page, plus the foundations and notes boards.
