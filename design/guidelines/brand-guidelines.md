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

## Colour · Sage

Day mode is soft green and white. Night mode is deep green with the same tiles turned down low, so a 3am feed never lights up the room. Night mode runs from 21:00 to 06:00 by default, and parents can set it to Auto, On or Off.

| Token | Day | Night | Used for |
|---|---|---|---|
| background | #E9EDE6 | #131814 | screen |
| card | #FFFFFF | #1E2520 | cards and sheets |
| ink | #1E2A23 | #E6ECE4 | main text |
| text-soft | #56615A | #A9B5AB | details and times |
| line | #DCE2D8 | #2A322C | dividers |
| outline | #C7CFC3 | #3A453D | outlined buttons |
| chip | #E9EDE6 | #2A322C | chips and inputs |
| selected | #CFE0D3 | #2E3830 | selected states |
| button | #1E2A23 | #CFE0D3 | the one main button |
| on-button | #FFFFFF | #131814 | text on the main button |
| feed | #E4E6CB | #353A28 | feed tile |
| sleep | #DAE1E3 | #2A3236 | sleep tile |
| diaper | #D4E3DA | #263630 | diaper tile |
| pump | #E3DFD1 | #353329 | pump tile |
| on-tile | #1E2A23 | #E6ECE4 | text on tiles |
| on-tile-soft | #3B463F | #C2CCC3 | detail text on tiles |

Every text and background pair passes WCAG AA. The lowest sits at about 5.3:1. Colour never carries meaning on its own. Always pair it with an icon and a label.

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
