# Fonts

The site loads these five files from this folder. Nothing comes from Google, so visitors make no third-party requests.

| File | Font | Weight |
|---|---|---|
| comfortaa-700.woff2 | Comfortaa | 700 (headings, big numbers) |
| manrope-500.woff2 | Manrope | 500 (body text) |
| manrope-600.woff2 | Manrope | 600 |
| manrope-700.woff2 | Manrope | 700 |
| manrope-800.woff2 | Manrope | 800 (buttons) |

They aren't included yet. Add them before you go live. Until then the site falls back to the system font.

## Where to get them

Both fonts are free under the SIL Open Font License, and both cover Greek.

1. Open https://gwfh.mranftl.com/fonts (google-webfonts-helper).
2. Pick Comfortaa. Tick the charsets latin and greek, and weight 700. Choose "Modern browsers" (woff2) and download.
3. Do the same for Manrope with weights 500, 600, 700 and 800.
4. Rename the files to the names in the table and drop them here.

Manrope ships as one variable font too. If you'd rather use that, put manrope-variable.woff2 here and change the four Manrope @font-face rules in styles.css to one rule with `font-weight: 500 800`.
