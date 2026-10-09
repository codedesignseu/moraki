# Moraki brand guidelines · v1.0 (Sage)

Moraki is one shared log for two parents and their newborn. It has to feel calm and warm, and it has to work at 3am with one hand.

Visual boards sit next to this file: `logo.html`, `app-icons.html`, `ui-kit.html` and `empty-states.html`, each with a PNG preview.

## Name

- Latin: **moraki**, always lowercase in the wordmark.
- Greek: **μωράκι**, always lowercase in the wordmark.
- In running text, write "Moraki".

## Logo · Together

Two equal arches hold one small dot. Two parents, one little one.

- **Construction:** drawn on a 100 unit square. Stroke 10 with round ends. Arch radius 13. Both gaps are 6 units. The mark mirrors exactly on the centre line.
- **Path:** `M16 76V48a13 13 0 0 1 26 0v28M58 76V48a13 13 0 0 1 26 0v28` plus `circle cx=50 cy=26 r=7`.
- **Wordmark:** Commissioner SemiBold 600, letter spacing -0.02em.
- **Clear space:** keep a margin around the logo at least as wide as the mark is tall.
- **Minimum size:**
  - Screen: mark 16 px, horizontal lockup 96 px wide. Below 16 px, use the mark alone.
  - Print: mark 5 mm, horizontal lockup 25 mm.
- **Colours:** Honey #E8A55A on Ink #2A211C, Honey deep #C9802F on light backgrounds, one colour Ink, reversed white.
- The logo keeps its own colours in every app theme. Never recolour it sage.

### Don't

- Stretch, tilt or outline the mark.
- Add gradients, shadows or glow.
- Move the dot or change its size.
- Set the mark in red, green, or pastel pink or blue.

## Colour · Stone

Stone replaced the Sage colours on 2026-10-09; layout, type, spacing and shape stay as Sage drew them. Day mode is warm stone and white with a near-black ink; night mode is deep warm brown with the same tiles turned down low, so a 3am feed never lights up the room. Night mode runs from 21:00 to 06:00 by default, and parents can set it to Auto, On or Off.

| Token | Day | Night | Used for |
|---|---|---|---|
| background | #EEEDE7 | #171411 | screen |
| card | #FFFFFF | #23201C | cards and sheets |
| ink | #161412 | #F1EAE0 | main text |
| text-soft | #5C5852 | #B8AD9F | details and times |
| line | #E4E2DA | #34302B | dividers |
| outline | #CFCCC3 | #4A443D | outlined buttons |
| chip | #EEEDE7 | #2C2823 | chips and inputs |
| selected | #161412 | #3A352F | selected states |
| on-selected | #FFFFFF | #F1EAE0 | text on selected states |
| button | #161412 | #F1EAE0 | the one main button |
| on-button | #FFFFFF | #171411 | text on the main button |
| tab-bar | #161412 | #F1EAE0 | tab bar |
| on-tab-bar | #FFFFFF | #171411 | icons on the tab bar |
| tab-active | #FFFFFF | #171411 | active tab |
| on-tab-active | #161412 | #F1EAE0 | icon on the active tab |
| feed | #F3DF8C | #51432A | feed tile |
| sleep | #ECD3CA | #47343A | sleep tile |
| diaper | #CDD1F2 | #33374D | diaper tile |
| pump | #CDE5DA | #2F4238 | pump tile |
| on-tile | #161412 | #F1EAE0 | text on tiles |
| on-tile-soft | #3E3A35 | #D3C8BA | detail text on tiles |

Selected states are dark by day (near-black with white text) and a dark fill with a light ink ring at night: text and icons on them use on-selected, never ink.

Every text and background pair in the table passes WCAG AA. One pair outside the table is close: text-soft on the night feed tile is 4.35:1, so detail text on tiles uses on-tile-soft. Colour never carries meaning on its own. Always pair it with an icon and a label.

## Type

| Style | Size / weight | Line height |
|---|---|---|
| Display | 54 / 800 | 54 |
| Title | 36 / 800 | 40 |
| Heading | 22 / 800 | 26 |
| Tile title | 20 / 800 | 24 |
| Row title | 18 / 800 | 23 |
| Body | 17 / 500 | 25 |
| Detail | 15 / 600 | 21 |
| Small | 13 / 600 | 18 |

- App font: Ysabeau Infant. Wordmark: Commissioner. Both are free (SIL OFL) and cover Greek.
- Text follows the phone's text size setting up to 200 percent.

## Shape and spacing

- **Screen edge:** 18. Gaps: 8, 12, 16, 24.
- **Corners:**
  - Activity tiles 32.
  - Cards and list rows 26.
  - Bottom sheets 32 at the top.
  - Buttons and chips fully round.
- **Buttons:** 60 high. Small buttons 50. Icon buttons 46.
- **Touch targets:** at least 44 × 44.
- **Tab bar:** floating, 66 high, sits 30 above the bottom edge.
- **Main action:** one dark button per screen, in the bottom third, where one thumb reaches it.

## Icons

- One line style: 24 grid, 1.6 stroke, round ends and joins, no fills except small dots.
- They use `currentColor`, so they follow the theme.
- Files are in `ui-icons/`.

## Voice

- Warm and short. Talk to the parent, use the baby's name.
- Say what happened and what's next: "Changed at 03:52", "Next feed around 05:44".
- Never judge. No "normal", "abnormal" or "concerning". The app logs, it doesn't diagnose.
- Undo beats confirm dialogs. Tap once and it's saved, with undo for a few seconds.

## Avoid

Medical crosses, baby clichés (storks, rattles, pacifiers), a pink and blue split, and nursery pastels.
