# Landing page: prompt for Claude Design

Paste the prompt below into Claude Design. Attach these files from the repo with it:

- **Colours and type:** `design/moraki-final-app/tokens/tokens.css`
- **Logo:** `design/moraki-final-app/brand/logos/mark/moraki-mark-honey-deep.svg` and `moraki-mark-honey.svg`
- **Lockups:** `design/moraki-final-app/brand/logos/lockups/moraki-horizontal-latin-full-colour-light.svg` and `...-greek-full-colour-light.svg`
- **App icon:** `design/moraki-final-app/brand/app-icons/ios/AppIcon-1024.png`
- **UI icons:** `design/moraki-final-app/brand/ui-icons/svg/` (feed, sleep, diaper, pump, private, eu-shield, invite, export)
- **App screens:** `design/moraki-final-app/screens/tabs/home-day.png`, `home-night.png`, `history-day.png`, `trends-day.png`, `sheets/feed-bottle-day.png`, `sheets/diaper-day.png`
- **Current pages:** `public/index.html`, `public/privacy/index.html`, `public/support/index.html`, `public/404.html`

When the design is ready, send Claude Code the export, or the link if it's an artifact. Claude Code ports it into `public/`, keeps the legal texts word for word and keeps the invite-link files working.

---

## Prompt

```text
Design the website for Moraki (moraki.app), a free iPhone app for the people looking after a newborn. It is a shared notebook: one parent logs a feed, a diaper, sleep or pumping, and every caregiver's phone shows it, even offline. The name is Greek, μωράκι, "little one". The company is CE Code Designs Ltd in Cyprus; data stays in the EU.

The website must look and feel like the app. Use the attached app screens, tokens, logo and icons as the source of truth:
- Faded Stone colours. Day: background #F3F2EE, cards #FFFFFF, ink #161412, soft text #5C5852, lines #E4E2DA. Activity tints: feed #F7EBC0, sleep #F4E4DE, diaper #E1E3F7, pump #E0EEE7. Night (prefers-color-scheme: dark): background #171411, cards #23201C, ink #F1EAE0, soft text #B8AD9F, tints feed #51432A, sleep #47343A, diaper #33374D, pump #2F4238.
- Logo: honey deep #C9802F by day, honey #E8A55A at night. Never recolour it.
- Comfortaa 700 for headings and big numbers, Manrope 500/600/700/800 for text. The fonts must be self-hosted woff2 files, not loaded from Google Fonts (privacy: no third-party requests).
- App shapes: cards with 26–28 px corners, fully round pill buttons, the dark main button (ink fill, white text), round icon circles, the four activity tiles with their tint and a white icon circle. Generous white space, calm and warm, one-handed-at-4am feeling. Phone mock-ups of the real app screens.

Pages (every page in English and Greek, same layout; Greek under /el/):
1. Home / landing (/ and /el/):
   - Hero: logo, headline, one-line subline, App Store badge, phone mock-up of the Home screen (day). Headline idea: "One shared notebook for your newborn" / Greek "Ένα κοινό τετράδιο για το μωρό σας" — keep the app's informal "you" (εσύ) in Greek.
   - How it works in three steps: log in two taps; everyone sees it; it works with no signal.
   - What you can log: the four tiles (Feed, Sleep, Diaper, Pump) plus a row for weight, temperature, medication, notes, appointments, milk stock in fridge and freezer.
   - Made for 4am: night mode (show the night Home screen), large text, one-handed.
   - Shared household: invite a partner, grandparent or nanny with a code; caregivers can log, viewers can only see.
   - For the doctor: a short call script and a PDF report of the last days.
   - Privacy: data stored in the EU, no ads, no data sold, no analytics, works without an account, export or delete everything in Settings. Link to the privacy policy.
   - Final call to action with the App Store badge; footer with Privacy, Terms, Support, language switch (EN / ΕΛ), © 2026 CE Code Designs Ltd.
2. Privacy policy (/privacy/, /el/privacy/), Terms (/terms/, /el/terms/), Support (/support/, /el/support/): a readable long-text layout in the same style (title, date, sections, card-like blocks). Use placeholder text; the real legal text is pasted in later, word for word.
3. Invite link page (/join/CODE): shown when someone taps an invite link on a phone without the app. Card with the logo, "You've been invited to a Moraki household", the code in large letter-spaced type (e.g. K7Q4-M2XP) with a Copy button, step-by-step "Install Moraki, open Settings, Join with a code", and the App Store badge. Also the not-found state for any other unknown URL (404).

Rules:
- Never say the app interprets health: no "normal", "healthy", "too little", "concerning", no claims that it helps a baby sleep or feed better, no traffic-light colours on numbers. It records and adds up; it is not a medical device. Add a small line: "Moraki is a notebook, not medical advice. If you're worried about your baby, contact your doctor."
- Accessible: WCAG AA contrast in both themes, real text (no text in images), alt text, visible focus, works at 200% zoom, semantic headings.
- Mobile first: perfect at 390 px wide, then tablet and desktop (max content width about 1100 px).
- Static only: plain HTML and CSS, at most a few lines of vanilla JavaScript (copy button, reading the invite code from the URL). No frameworks, no cookies, no trackers, no analytics, no forms, no external scripts or CDNs.
- Use Apple's official "Download on the App Store" badge (black by day, white at night), linking to https://apps.apple.com/app/id6819394944.
- Deliver one folder with the same paths: index.html, el/index.html, privacy/, terms/, support/ (and el/ versions), 404.html, a shared styles.css, fonts/ and images/. Images as SVG or optimised WebP/PNG.
```
