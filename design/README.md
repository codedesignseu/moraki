# Moraki design export · Sage v1.0

Everything for the Moraki app and brand, in one folder.

Copy this folder into the app repo as `design/`. Then tell Claude Code to read `design/CLAUDE.md` and start with step 1. Keep the repo's own root CLAUDE.md as it is. This one only covers the design refresh.

```
CLAUDE.md          Design refresh brief for Claude Code. Restyles the existing app and adds no features.
screens/
  index.html       All 20 screens in one page, with a day and night toggle
  day/  night/     Each screen as its own HTML file, 390 × 844
  png/day  png/night   PNG previews of every screen (2x)
  screens.json     Screen list with titles and file paths
logos/
  mark/            The mark in 5 colours: SVG, PNG and PDF
  lockups/         Horizontal and stacked, Latin and Greek, 4 colour versions (SVG)
app-icons/
  ios/             AppIcon 1024 default, dark and tinted, plus Icon Composer layers
  android/         Adaptive layers, monochrome, Play Store 512, notification 96
  splash/          Splash mark for light and night
  web/             Favicons and the Apple touch icon
  social/          Share image 1200 × 630
ui-icons/
  svg/             23 app icons, 24 grid, 1.6 stroke, currentColor
  png-ink/         The same icons as 96 px PNG for day
  png-night/       The same icons as 96 px PNG for night
fonts/             Font names, licences and install commands
guidelines/
  brand-guidelines.md   Logo, colour, type, spacing, icons and voice rules
  logo.html / .png      Logo board: construction, clear space, sizes, don'ts
  app-icons.html / .png App icon board with platform notes
  ui-kit.html / .png    UI kit: colours, type, components, icons, spacing
  empty-states.html / .png
  tokens/               theme.ts, tokens.css, moraki-tokens.json, colours.csv
```

## Two things to know

1. **Fonts.** The font files aren't in the zip, because the export ran somewhere that couldn't reach Google Fonts. Both fonts are free. `fonts/README.md` has the one-line install for the app and the download links for your computer. The HTML files load the fonts from Google, so they look right in any browser that's online.
2. **Lockups.** The lockup SVGs and the share image use live text. Install Commissioner, open them in Figma or Illustrator, convert the text to outlines and save. The mark files have no text, so you can use them as they are.
