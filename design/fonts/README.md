# Moraki fonts

| Use | Font | Weights | Licence |
|---|---|---|---|
| All app text | Ysabeau Infant | 500, 600, 800 | SIL OFL 1.1 |
| The wordmark only | Commissioner | 600 | SIL OFL 1.1 |

Both cover Latin and Greek, so "Moraki" and "μωράκι" render in the same font.

## Install in the app (Expo)

```
npx expo install expo-font @expo-google-fonts/ysabeau-infant @expo-google-fonts/commissioner
```

```ts
import { useFonts, YsabeauInfant_500Medium, YsabeauInfant_600SemiBold, YsabeauInfant_800ExtraBold } from '@expo-google-fonts/ysabeau-infant';
import { Commissioner_600SemiBold } from '@expo-google-fonts/commissioner';

const [ready] = useFonts({ YsabeauInfant_500Medium, YsabeauInfant_600SemiBold, YsabeauInfant_800ExtraBold, Commissioner_600SemiBold });
```

## Install on your computer (for Figma or Illustrator)

- https://fonts.google.com/specimen/Ysabeau+Infant
- https://fonts.google.com/specimen/Commissioner

Click "Get font", then "Download all", and install the files.

## For the web

Use `fonts.css` in this folder.

The font files are not in this zip. The export ran somewhere that couldn't reach Google Fonts, so install them with the commands above.
