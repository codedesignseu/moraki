# App Store screenshots

Six screenshots in English and Greek, 1320 × 2868 PNG (6.9" iPhone, portrait), sRGB, no alpha.

```
frame.html          the frame: tinted background, caption, sub-caption, plain black bezel
render.mjs          renders the screens and puts each in the frame
screens/en/*.html   copies of the approved G screens, edited to match the built app
screens/el/*.html   the same in Greek, with the app's strings from src/i18n/el.json
tools/edit-en.py    the edits that turned the design files into screens/en (for reference)
tools/make-el.py    builds screens/el from screens/en (string table inside)
```

Captions, sub-captions and background tints live in `SHOTS` at the top of `render.mjs`.
A `\n` in a caption forces a line break. Captions shrink to stay on two lines.

## Run it

Playwright is not a repo dependency. It is loaded from `~/.cache/moraki-web-check`:

```sh
# once, if that folder is missing
mkdir -p ~/.cache/moraki-web-check && cd ~/.cache/moraki-web-check && npm init -y && npm i playwright && npx playwright install chromium

# from the repo root
node design/app-store-screenshots/render.mjs                    # all 12
node design/app-store-screenshots/render.mjs --lang el          # one language
node design/app-store-screenshots/render.mjs --only 04          # one screen, both languages
node design/app-store-screenshots/render.mjs --out ~/Desktop/shots
```

Output goes to `~/Downloads/moraki-app-store-screenshots/{en,el}/01-home.png …`.
Fonts come from the app's own TTFs in `node_modules/@expo-google-fonts`, so run `npm install` first.
On macOS, `sips` flattens any alpha and tags the files sRGB.

## Use a real TestFlight screenshot

Take the screenshot on a 6.9" iPhone (or any phone with a 1320:2868 screen), then:

```sh
node design/app-store-screenshots/render.mjs --only 01 --lang en --raw ~/Desktop/IMG_0001.PNG
```

The PNG replaces the HTML screen inside the same frame and caption. Other ratios are cropped from the top.

## Editing a screen

Edit `screens/en/<id>.html` directly. To bring a Greek copy up to date, either edit `screens/el/<id>.html`
too, or add the new strings to `tools/make-el.py` and run `python3 design/app-store-screenshots/tools/make-el.py`
(it rewrites all of `screens/el`). Running `tools/edit-en.py` again needs fresh copies of the design files first;
see the top of that file.

## Sample data

Baby "Baby" (Greek "Μωρό"), viewed by Parent 1, with Parent 2 and Grandparent logging too.
Entries by Parent 1 read "You", as the app shows them. Day screens are set at Tue 13 Oct, 16:25. The night screen is at 04:02.
