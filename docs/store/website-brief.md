# moraki.app website: build brief

The owner's brief for turning the Claude Design export into the live site. The decisions below it override the brief where they differ.

## Decisions (owner, 2026-10-17)

- **Design source.** The home page (`index.html`, `el/index.html`) and `styles.css` come from `design/moraki-website-illustrated/`, which already has the home page illustrations (hero, the three steps, Made for 4am, Shared household, For the doctor, Privacy, the crib). The other pages come from the same folder; they match `design/moraki-website/`. The join and 404 illustrations are still to be drawn (Part 3).
- **Where it ships.** The site replaces the contents of `public/`, which moraki.app serves today (Apache, see `public/.htaccess`; `_headers` is kept for Netlify and Cloudflare). `design/` stays the reference and is never served.
- **Universal links.** Keep the existing `public/.well-known/apple-app-site-association` and `assetlinks.json`. They already hold the real app ID `285GZCH8W4.eu.codedesigns.moraki`. The brief's `TEAMID.app.moraki` placeholder does not apply.
- **Legal text.** Privacy, Terms and Support carry the existing draft text from the current `public/` pages, word for word, in both languages, in the new layout. Keep a visible "draft" marking until the lawyer review is done (SDD 12.1).
- **Support email.** `hello@moraki.app`, as a `mailto:` link everywhere the site shows an address. The current drafts say `info@codedesigns.eu`. The site switches to `hello@moraki.app` (the owner's choice), and the app's About screen follows in a separate PR.
- **Fonts.** Claude Code makes the five woff2 files from the OFL Comfortaa and Manrope fonts the app ships, subset to Latin and Greek.
- **App Store badge.** Apple's official artwork is the owner's to download. Placeholders stay until then.

## Brief

You're working on the static website for Moraki (moraki.app), a free iPhone app for the people looking after a newborn. It's a shared notebook: one parent logs a feed, a diaper, sleep or pumping, and every caregiver's phone shows it, even offline. The company is CE Code Designs Ltd in Cyprus. Data stays in the EU.

This folder holds the approved design, already built in plain HTML and CSS. Your job has three parts:

1. Make the site fully working and ready to deploy.
2. Add a light and dark mode switch.
3. Add warm, original baby and parent illustrations so the site feels more parent-friendly.

Read README.md, styles.css, index.html, el/index.html and join/index.html before you change anything. Then show me a short plan and wait for my OK.

### Ground rules

- **Keep the design.** Keep the same layout, colours, fonts, corner radii, spacing and copy. Don't redesign sections or rewrite text unless this prompt asks for it.
- **Static only.** Use plain HTML, CSS and a small amount of vanilla JavaScript. No frameworks, no build step, no npm packages in the shipped site.
- **No third-party requests.** No cookies, trackers, analytics, forms, external scripts, CDNs or Google Fonts. The site must make zero third-party requests.
- **Both languages.** Every page exists in English and Greek with the same layout. Greek lives under /el/. Any change you make to one language, make to the other.
- **Informal Greek.** Greek uses the informal "you" (εσύ), like the app.
- **No health judgement.**
  - Don't use "normal", "healthy", "too little" or "concerning".
  - Don't claim the app helps a baby sleep or feed better.
  - No traffic-light colours on numbers.
  - Keep the line "Moraki is a notebook, not medical advice. If you're worried about your baby, contact your doctor." where it is.
- **Accessibility** stays at WCAG AA in both themes: contrast, visible focus, alt text, semantic headings. It must still work at 200% zoom.
- **Mobile first.** It must look right at 390 px wide, then tablet, then desktop (content max width 1100 px).
- **New copy style:**
  - Active voice. Talk to the reader as "you".
  - Short plain words. No jargon, no marketing language, no clichés.
  - No em-dashes, semicolons, emojis or exclamation marks.

### Part 1. Make it fully working

Work through this list. Tick each item off in your final summary.

#### Assets I'll supply

These are things only I can provide. Check for them, and if one is missing, leave the placeholder in place and list it at the end.

- **Fonts.**
  - `fonts/` needs comfortaa-700.woff2, manrope-500.woff2, manrope-600.woff2, manrope-700.woff2 and manrope-800.woff2.
  - Each file must include the Greek subset.
  - Check that the `@font-face` rules and the `<link rel="preload">` tags match the real file names.
- **App Store badge.**
  - Swap the placeholders in images/ for Apple's official "Download on the App Store" artwork, keeping the same file names: black by day, white at night.
  - Don't draw or edit Apple's badge or logo yourself. If the official files aren't there, leave the placeholders and tell me.
- **Legal text and support email.**
  - Privacy and Terms keep their placeholder cards until I paste in the final text.
  - Replace [support email address] with a working mailto: link once I give you the address.

#### Things to build or fix

- **Theme switch.** See Part 2.
- **Illustrations.** See Part 3.
- **Invite page (/join/CODE).**
  - Test it with /join/K7Q4M2XP, /join/k7q4-m2xp, /join/?code=K7Q4M2XP, /join/ with no code, and a code holding junk characters.
  - The Copy button copies the code without the dash and announces "Code copied" to screen readers.
  - If the clipboard isn't available, select the code text so the visitor can copy it by hand.
  - The EN / ΕΛ buttons switch the language in place.
  - Without JavaScript, the page still shows the steps and the badge.
- **404 page.**
  - It works from any depth, because every asset path in it is absolute.
  - Unknown URLs return a real 404 status on the server configs in the README.
- **SEO basics.** Use static files only, nothing that phones home.
  - robots.txt and sitemap.xml covering both languages, with hreflang alternates.
  - Open Graph and Twitter card tags on every page, with a 1200×630 share image in images/ that you build as PNG from the brand colours and logo. Real text is fine on this one image, because it's for link previews only.
  - A `<title>` and meta description for every page in its own language.
  - Canonical and hreflang tags that match the real URLs.
- **Universal links.**
  - Add .well-known/apple-app-site-association (no file extension, served as application/json) for /join/*.
  - Use the placeholder TEAMID.app.moraki for the app ID and tell me to replace it.
  - Add the matching Content-Type rule to the README server notes.
- **Security and caching headers.** Add a _headers file (Netlify and Cloudflare) and the matching nginx and Apache lines in the README:
  - a strict Content-Security-Policy with default-src 'self' and no third-party origins,
  - Referrer-Policy: no-referrer,
  - X-Content-Type-Options: nosniff,
  - Permissions-Policy turning off camera, microphone and location,
  - long cache times for fonts/ and images/, and short ones for HTML.

  If the inline theme script needs it, allow it in the CSP with a hash, not 'unsafe-inline'.

- **Links.** Check every internal link and anchor on all eleven pages, in both languages. Fix any that are broken. The App Store link is https://apps.apple.com/app/id6819394944.
- **Clean HTML.** Check every page for valid HTML, with no duplicate ids and every heading level in order.

### Part 2. Light and dark mode

The site follows the phone's system setting right now. Keep that as the default and add a manual switch.

- **Three options:** Auto (follows the system), Light, Dark.
  - Put the switch in the header next to the EN / ΕΛ pill, in the same pill style.
  - On mobile, use one round 48 px icon button that cycles Auto, Light, Dark.
  - Show a sun, moon or half-circle icon.
  - Give it a text label for screen readers, like "Theme: Auto".
- **How it works.**
  - Set data-theme="light" or data-theme="dark" on `<html>`. Leave the attribute off for Auto.
  - In styles.css, the night colours apply under [data-theme="dark"], and under @media (prefers-color-scheme: dark) only when the page has no data-theme.
  - Everything that switches today with the media query must follow the attribute too:
    - the phone mock-ups (.phone-day and .phone-night),
    - the logo colour,
    - the App Store badge (`<picture>` sources can't read the attribute, so switch the badge with CSS or a tiny script),
    - the focus ring,
    - color-scheme,
    - theme-color.
  - Remember the choice in localStorage under one key, moraki-theme. It never leaves the device and isn't a cookie, so the privacy promise holds. Wrap every read and write in try/catch so private browsing still works.
  - No flash. Read the saved choice with a tiny inline script in `<head>`, before the stylesheet paints. Keep the rest of the switch code in one small shared file, theme.js, loaded with defer.
- **Colours.** Use the exact app values. Don't invent new ones.

  |             | Day     | Night   |
  | ----------- | ------- | ------- |
  | background  | #F3F2EE | #171411 |
  | cards       | #FFFFFF | #23201C |
  | ink         | #161412 | #F1EAE0 |
  | soft text   | #5C5852 | #B8AD9F |
  | lines       | #E4E2DA | #34302B |
  | feed tint   | #F7EBC0 | #51432A |
  | sleep tint  | #F4E4DE | #47343A |
  | diaper tint | #E1E3F7 | #33374D |
  | pump tint   | #E0EEE7 | #2F4238 |
  | logo        | #C9802F | #E8A55A |

- **Contrast rule.** Soft text #B8AD9F on the night feed tint #51432A only reaches 4.35:1. Use ink, not soft text, on night tints.
- The "Made for 4am" section stays dark in both themes, as it is now.
- Every page gets the switch, including privacy, terms, support, join and 404.

### Part 3. Baby and parent illustrations

Draw a small set of original illustrations that make the site feel warm and made for parents. Draw them yourself as hand-written inline SVG.

#### Style

- Soft and simple, in the same mood as the app: round shapes, generous curves, calm.
- Flat fills from the brand tints, with a rounded ink outline: a 2 to 2.5 px stroke at display size, with stroke-linecap and stroke-linejoin set to round.
- **People.**
  - Simple and friendly, with no detailed faces. A dot or a small curve for closed eyes is enough.
  - Show different kinds of caregivers: mums, dads, a grandparent, a nanny.
  - Use a range of skin tones and hair, drawn from a small set of muted warm and neutral fills that sit well next to the tints.
- **Babies.** Swaddled or in a simple sleepsuit. Asleep or calm, never crying.
- Use the honey logo colour only as a small accent, like a lamp glow or a blanket stripe.

#### Colours have to follow the theme

- Build every fill and stroke from CSS variables: var(--ink), var(--card), var(--feed), var(--sleep), var(--diaper), var(--pump), var(--deco), var(--logo).
- Add a few new variables for skin and hair tones. Give each a day value and a night value, so the illustrations dim gently at night.
- To read the variables, the SVGs must sit inline in the HTML, not in `<img>` tags.
- Keep one master copy of each illustration in images/illustrations/ as source. Inline the same markup on both language versions.

#### Where they go

| Place                | Illustration                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero                 | A parent sitting and holding a sleeping baby, with a phone in the free hand. Sits behind or beside the phone mock-up on the butter circle, without covering the app screen. On mobile, keep it small or crop it so the mock-up stays the focus. |
| How it works, step 1 | A thumb tapping a round tile.                                                                                                                                                                                                                   |
| How it works, step 2 | Two phones with a soft curved line between them.                                                                                                                                                                                                |
| How it works, step 3 | A phone with a small cloud and a check mark.                                                                                                                                                                                                    |
| Made for 4am         | A parent in an armchair at night feeding a baby with a bottle, a moon in the window and a lamp glowing honey.                                                                                                                                   |
| Shared household     | Three or four caregivers side by side: a partner, a grandparent and a nanny, one of them holding the baby.                                                                                                                                      |
| For the doctor       | A parent on a phone call, holding the baby, with a notebook on the table. No stethoscope, thermometer readings, charts or other medical imagery.                                                                                                |
| Privacy              | A baby asleep under a blanket, with a small rounded shield.                                                                                                                                                                                     |
| Final call to action | A baby asleep in a crib with a few small stars.                                                                                                                                                                                                 |
| Join page            | Two hands passing a small heart or a phone. Keep it small, above the title.                                                                                                                                                                     |
| 404 page             | A lost baby sock or a rattle on its own.                                                                                                                                                                                                        |

#### Rules for the illustrations

- No text, letters or numbers inside any illustration.
- Purely decorative ones get aria-hidden="true" and focusable="false". If one carries meaning, give it role="img" and a short label in the page's language.
- Don't draw a real person, a known character, a mascot or anything based on an existing brand or artwork. Everything must be your own.
- No stock-photo look, no 3D, no gradients heavier than a soft two-stop fill.
- **Size.** Each illustration stays under 10 KB. The whole set adds less than 80 KB to the home page. Use a few simple paths, not traced detail.
- They must never push text off screen at 390 px or at 200% zoom.
- **Motion.** If you add any, keep it to a slow fade-in or a gentle float on the hero only. Switch it off under prefers-reduced-motion.

### Check your work

Before you call it done:

- **Screenshots.** Serve the folder locally with a tiny static server that mimics the /join/* rewrite and the 404. Use Playwright to screenshot every page:
  - at 390, 768 and 1280 px,
  - in Light, Dark and Auto with the system set each way,
  - in English and Greek.

  Look at the screenshots yourself and fix what's off.

- **Network.** Confirm there are zero requests to any other domain. Confirm zero console errors, apart from missing fonts or badges I haven't supplied yet.
- **Contrast.** Check every text and background pair in both themes against WCAG AA, including text on the illustrations' backgrounds.
- **Keyboard.** Tab through each page. Check that focus is always visible and that the theme switch, language switch, copy button and every link work from the keyboard.
- **Theme switch.**
  - Set Dark, reload, and it stays dark with no flash.
  - Set Auto, and it follows the system again.
  - Block storage, and it still works for the session without errors.
- **Zoom.** Zoom to 200% at 1280 px and check nothing overlaps or gets cut off.
- **Wording.** Search all the HTML for "normal", "healthy", "too little", "concerning", em-dashes and semicolons in visible text. Greek question marks (;) are fine.

### When you finish

Give me a short summary:

- what you changed,
- the list of placeholders still waiting on me (fonts, badge, legal text, support email, Apple team ID),
- the screenshots of the home page in light and dark at 390 px and 1280 px.

Commit each part (working fixes, theme switch, illustrations) on its own.
