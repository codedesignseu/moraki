#!/usr/bin/env node
// Renders the Moraki App Store screenshots: 6 screens × (en, el), 1320 × 2868 PNG.
//
//   node design/app-store-screenshots/render.mjs                 all 12
//   node design/app-store-screenshots/render.mjs --lang el       one language
//   node design/app-store-screenshots/render.mjs --only 03       one screen, both languages
//   node design/app-store-screenshots/render.mjs --only 01 --lang en --raw ~/Desktop/IMG_0001.PNG
//                                                                frame a real phone screenshot instead
//   --out <dir>   output folder (default ~/Downloads/moraki-app-store-screenshots)
//
// Playwright is not a repo dependency. It is loaded from ~/.cache/moraki-web-check
// (override with PLAYWRIGHT_DIR). See README.md.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const pwDir = process.env.PLAYWRIGHT_DIR ?? join(homedir(), '.cache/moraki-web-check');
const { chromium } = createRequire(join(pwDir, 'package.json'))('playwright');

// ---------------------------------------------------------------- the shots

const TINT = { feed: '#F7EBC0', sleep: '#F4E4DE', diaper: '#E1E3F7', pump: '#E0EEE7', night: '#171411' };

export const SHOTS = [
  {
    id: '01-home', bg: TINT.feed,
    en: ['See the last feed at a glance', 'How long since the last feed, and when the reminder is due.'],
    el: ['Δες το τελευταίο τάισμα με μια ματιά', 'Πόση ώρα πέρασε από το τελευταίο τάισμα και πότε είναι η υπενθύμιση.'],
  },
  {
    id: '02-feed', bg: TINT.sleep,
    en: ['Log a feed in two taps', 'Bottle, breast or mixed.\nIt starts from the last feed.'],
    el: ['Κατέγραψε ένα τάισμα\nσε δύο αγγίγματα', 'Μπιμπερό, θηλασμός ή μικτό.\nΞεκινά από το τελευταίο τάισμα.'],
  },
  {
    id: '03-history', bg: TINT.diaper,
    en: ['Everyone sees the same notebook', 'Each entry shows who logged it, on every phone.'],
    el: ['Όλοι βλέπουν το ίδιο τετράδιο', 'Κάθε καταχώριση δείχνει ποιος την έκανε, σε κάθε κινητό.'],
  },
  {
    id: '04-trends', bg: TINT.pump,
    en: ['Seven days at a glance', 'Bottle, breastfeeding, diapers and sleep, day by day.'],
    el: ['Επτά μέρες με μια ματιά', 'Μπιμπερό, θηλασμός, πάνες και ύπνος, μέρα με τη μέρα.'],
  },
  {
    id: '05-night', bg: TINT.night, theme: 'night',
    en: ['Made for 4am', 'Dim colours for night feeds.'],
    el: ['Φτιαγμένο για τις 4 το πρωί', 'Χαμηλά χρώματα για τα νυχτερινά ταΐσματα.'],
  },
  {
    id: '06-invite', bg: TINT.diaper,
    en: ['Invite the people who help', 'Share a code. Choose who can log and who can only look.'],
    el: ['Κάλεσε όσους βοηθούν', 'Στείλε έναν κωδικό. Διάλεξε ποιος καταγράφει και ποιος μόνο βλέπει.'],
  },
];

// ---------------------------------------------------------------- options

function parseArgs(argv) {
  const o = { langs: ['en', 'el'], only: null, raw: null, out: join(homedir(), 'Downloads/moraki-app-store-screenshots') };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--lang') o.langs = [next()];
    else if (a === '--only') o.only = next();
    else if (a === '--raw') o.raw = resolve(next().replace(/^~/, homedir()));
    else if (a === '--out') o.out = resolve(next().replace(/^~/, homedir()));
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n'));
      process.exit(0);
    } else throw new Error(`unknown option ${a}`);
  }
  if (o.raw && (!o.only || o.langs.length !== 1)) {
    throw new Error('--raw replaces one screen: pass --only <id> and --lang <en|el> with it');
  }
  if (o.raw && !existsSync(o.raw)) throw new Error(`no such file: ${o.raw}`);
  return o;
}

// ---------------------------------------------------------------- rendering

const FONT_CSS = [
  ['Comfortaa', 600, 'comfortaa/600SemiBold/Comfortaa_600SemiBold.ttf'],
  ['Comfortaa', 700, 'comfortaa/700Bold/Comfortaa_700Bold.ttf'],
  ['Manrope', 500, 'manrope/500Medium/Manrope_500Medium.ttf'],
  ['Manrope', 600, 'manrope/600SemiBold/Manrope_600SemiBold.ttf'],
  ['Manrope', 700, 'manrope/700Bold/Manrope_700Bold.ttf'],
  ['Manrope', 800, 'manrope/800ExtraBold/Manrope_800ExtraBold.ttf'],
]
  .map(([family, weight, file]) => {
    const url = pathToFileURL(join(repo, 'node_modules/@expo-google-fonts', file)).href;
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url('${url}') format('truetype');}`;
  })
  .join('\n');

/** The app screen as a 3× PNG (390 × 847 CSS px, the 1320:2868 ratio). */
async function renderScreen(browser, htmlPath) {
  const page = await browser.newPage({ viewport: { width: 390, height: 847 }, deviceScaleFactor: 3 });
  // The design files link Google Fonts; use the app's own TTFs instead, offline.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(pathToFileURL(htmlPath).href);
  await page.addStyleTag({ content: FONT_CSS });
  await page.evaluate(async () => {
    await Promise.all(
      ['600 16px Comfortaa', '700 16px Comfortaa', '500 16px Manrope', '600 16px Manrope', '700 16px Manrope', '800 16px Manrope'].map((f) =>
        document.fonts.load(f, 'Aaα'),
      ),
    );
    await document.fonts.ready;
  });
  const missing = await page.evaluate(() =>
    ['700 16px Comfortaa', '600 16px Manrope', '800 16px Manrope'].filter((f) => !document.fonts.check(f, 'Aα')),
  );
  if (missing.length) throw new Error(`${htmlPath}: fonts did not load: ${missing.join(', ')}`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 847 } });
  await page.close();
  return png;
}

async function renderFrame(browser, shot, lang, screenPng) {
  const page = await browser.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(here, 'frame.html')).href);
  const [caption, sub] = shot[lang];
  await page.evaluate((s) => window.setShot(s), {
    caption,
    sub,
    lang,
    bg: shot.bg,
    theme: shot.theme ?? 'day',
    screen: `data:image/png;base64,${screenPng.toString('base64')}`,
  });
  // Layout checks: the caption block must not overflow its box or crowd the phone.
  const problems = await page.evaluate(() => {
    const out = [];
    const copy = document.querySelector('.copy').getBoundingClientRect();
    const cap = document.getElementById('caption').getBoundingClientRect();
    const sub = document.getElementById('sub').getBoundingClientRect();
    const phone = document.querySelector('.phone').getBoundingClientRect();
    if (cap.top < copy.top || sub.bottom > copy.bottom) out.push('caption block overflows its box');
    if (sub.bottom > phone.top - 40 || cap.bottom > phone.top - 40) out.push('caption too close to the phone');
    const lines = Math.round(cap.height / parseFloat(getComputedStyle(document.getElementById('caption')).lineHeight));
    if (lines > 2) out.push(`caption wraps to ${lines} lines`);
    return out;
  });
  if (problems.length) console.warn(`  ! ${shot.id} ${lang}: ${problems.join('; ')}`);
  const png = await page.screenshot({ type: 'png', omitBackground: false });
  await page.close();
  return png;
}

/** Flatten (no alpha) and tag sRGB with macOS sips; elsewhere keep Chromium's output. */
function finish(file) {
  if (process.platform !== 'darwin') return;
  const srgb = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';
  const hasAlpha = execFileSync('sips', ['-g', 'hasAlpha', file], { encoding: 'utf8' }).includes('hasAlpha: yes');
  if (hasAlpha) {
    // A JPEG round trip at maximum quality drops the alpha channel.
    const tmp = `${file}.tmp.jpg`;
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', file, '--out', tmp], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'png', tmp, '--out', file], { stdio: 'ignore' });
    execFileSync('rm', [tmp]);
  }
  if (existsSync(srgb)) execFileSync('sips', ['-m', srgb, file], { stdio: 'ignore' });
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const shots = SHOTS.filter((s) => !o.only || s.id === o.only || s.id.startsWith(`${o.only}-`));
  if (!shots.length) throw new Error(`no screen matches --only ${o.only}`);
  const browser = await chromium.launch();
  try {
    for (const lang of o.langs) {
      if (!['en', 'el'].includes(lang)) throw new Error(`--lang must be en or el, not ${lang}`);
      mkdirSync(join(o.out, lang), { recursive: true });
      for (const shot of shots) {
        const screen = o.raw
          ? readFileSync(o.raw)
          : await renderScreen(browser, join(here, 'screens', lang, `${shot.id}.html`));
        const png = await renderFrame(browser, shot, lang, screen);
        const file = join(o.out, lang, `${shot.id}.png`);
        writeFileSync(file, png);
        finish(file);
        console.log(`  ${lang}/${shot.id}.png${o.raw ? `  (raw: ${o.raw})` : ''}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`done: ${o.out}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
