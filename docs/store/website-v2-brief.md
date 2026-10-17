# moraki.app website v2: build brief

The owner's brief for bringing `design/v2/` into the live site. The decisions below override the brief where they differ.

## Decisions (owner, 2026-10-18)

- **Go ahead without a plan stop.** The owner said "proceed and create the pages". Put the plan in the PR description.
- **Branding.** Moraki is the product and should be visible almost everywhere. Show CE Code Designs Ltd only where someone looks for the company.
  - **Footers** read "© 2026 Moraki".
  - **Where the company appears:** privacy, terms and support, each saying "Moraki is a product of CE Code Designs Ltd" (Greek: "Το Moraki είναι προϊόν της CE Code Designs Ltd").
  - **The "Moraki at a glance" block** may list the company, because it answers "who makes this". Use "Made by: CE Code Designs Ltd, Cyprus".
  - **JSON-LD** keeps the Organization (CE Code Designs Ltd) as the publisher, with Moraki as the brand. JSON-LD is not visible text.
  - **design/v2** footers that name the company follow this rule.
- **App Store category.** Health & Fitness (`docs/store/app-store-listing.md`). In schema.org terms, `applicationCategory: "HealthApplication"`.
- **Already in the live site (main), so keep it.** The theme switch, the strict CSP with script hashes, the self-hosted fonts and `OFL.txt`, `.well-known/`, `join.js` and `404.js`, the legal pages corrected on 2026-10-18 (#187), and `hello@moraki.app`.
  - The legal text in privacy, terms and support stays as it is on main. Only the menu, footer and head tags change there.
- **Apple team ID.** It is real (`285GZCH8W4.eu.codedesigns.moraki`) and already in `.well-known`. It is not a placeholder.

## Brief

You're working on the static website for Moraki (moraki.app), a free iPhone app for the people looking after a newborn. It's a shared notebook: one parent logs a feed, a diaper, sleep or pumping, and every caregiver's phone shows it, even offline. The company is CE Code Designs Ltd in Cyprus. Data stays in the EU. The site launches first in Cyprus and Greece, in English and Greek.

design/v2/ holds the approved design for the whole site, built in plain HTML and CSS. It includes four new pages, each in English and Greek:

| Page | English | Greek |
| --- | --- | --- |
| Features | /features/ | /el/features/ |
| Age guides | /age-guides/ | /el/age-guides/ |
| Our story | /our-story/ | /el/our-story/ |
| FAQ | /faq/ | /el/faq/ |

It also adds a main menu to every page (Features, Age guides, Our story, FAQ), new links in the footer, and new illustrations.

Your job:

1. Bring these pages and changes into the live site.
2. Make every page on the site strong for search (SEO).
3. Make every page easy for AI answer engines to read and quote (GEO).
4. Make every page fast.

Read design/v2/ first, plus the current site files, and the README. Then show me a short plan and wait for my OK.

### Ground rules

- **Keep the approved design.** Use the same layout, colours, fonts, illustrations and copy as design/v2/. Port it, don't redesign it. If something in the live site is newer (for example a theme switch), keep that too.
- **Static only.** Plain HTML, CSS and a few small vanilla JavaScript files. No frameworks and nothing to build or install before deploying. A dev-only check script that never ships is fine.
- **Nothing from outside the site.** No cookies, trackers, analytics, forms, external scripts, CDNs or Google Fonts. The site must make zero third-party requests.
- **Two languages.** Every page exists in English and Greek with the same layout, and Greek lives under /el/. Any change to one language goes into the other. Greek uses the informal "you" (εσύ).
- **No health judgements.**
  - Never say the app judges health.
  - Don't use "normal", "healthy", "too little" or "concerning".
  - Don't claim it helps a baby sleep or feed better.
  - No traffic-light colours on numbers.
  - Keep this line on every page: "Moraki is a notebook, not medical advice. If you're worried about your baby, contact your doctor."
- **Accessibility.** WCAG AA in both themes, visible focus, alt text, headings in order, and everything works at 200% zoom.
- **Mobile first.** Get 390 px right first, then tablet, then desktop (content max width 1100 px).
- **Copy style for anything new you write:**
  - Active voice. Talk to the reader as "you".
  - Short plain words. No jargon, no marketing language.
  - No em-dashes, semicolons (Greek question marks are fine), emojis or exclamation marks.
- **Don't change the Our story text.** Makis checks every line himself. If something reads wrong, flag it to me instead of rewriting it.

### Part 1. Bring in the new pages

- **The four pages.** Copy them from design/v2/ into the live site, in both languages.
  - Keep the real-text phone mock-ups. Each one is marked role="img" with a text label, and its contents are aria-hidden and inert.
  - Keep the inline SVG illustrations. Their colours come from CSS variables, so they follow the theme.
- **Main menu.** Add it to every page, including privacy, terms, support, join and 404.
  - Mark the current page with aria-current="page".
  - On phones, the menu sits under the logo row. Check it never pushes the page sideways at 390 px.
- **Footer.** Add the four new links to every footer.
- **FAQ answers.** Use `<details>` and `<summary>`, so they open and close with no JavaScript. The answers must stay in the HTML, so search engines and AI tools can read them while they're closed.
- **Styles.** Merge the new CSS from design/v2/styles.css into the live styles.css:
  - Keep one stylesheet.
  - Remove duplicate rules.
  - Make sure every new colour follows the light and dark themes.
- **Internal links.**
  - Link Features to the FAQ and Age guides.
  - Link Age guides to Features.
  - Link the FAQ to Support and Privacy.
  - Link Our story to Features.
  - Use clear link text, never "click here".

### Part 2. SEO

Apply all of this to every page in both languages: home, features, age guides, our story, FAQ, privacy, terms and support. Join and 404 get noindex.

#### Titles and descriptions

Use these. Keep titles under 60 characters and descriptions between 140 and 160. If a Greek line runs long, shorten it without losing the main words.

| Page | English title | Greek title |
| --- | --- | --- |
| Home | Moraki: shared baby tracker for newborn parents | Moraki: κοινή εφαρμογή καταγραφής για νεογέννητα |
| Features | Features: feed, sleep and diaper tracker · Moraki | Λειτουργίες: τάισμα, ύπνος, πάνα · Moraki |
| Age guides | Your baby’s first year, stage by stage · Moraki | Ο πρώτος χρόνος του μωρού, βήμα βήμα · Moraki |
| Our story | Our story: why a dad built Moraki | Η ιστορία μας: γιατί ένας μπαμπάς έφτιαξε το Moraki |
| FAQ | Moraki FAQ: sharing, privacy and offline use | Συχνές ερωτήσεις για το Moraki |

Write a meta description for each page from its own lead text. Each one has to:

- say what the visitor gets,
- include the page's main search words (see the next table),
- mention "free on iPhone" on Home and Features.

#### Search words to work in

Work these into headings and body text where they read naturally. Never stuff them, and never change the meaning of the approved copy.

| Page | English | Greek |
| --- | --- | --- |
| Home | baby tracker, newborn tracker, shared baby log, feeding and sleep tracker | εφαρμογή για νεογέννητο, καταγραφή ταΐσματος, ημερολόγιο μωρού |
| Features | breastfeeding tracker, bottle feeding log, diaper log, pumping log | καταγραφή θηλασμού, μπιμπερό, πάνες, άντληση γάλακτος |
| Age guides | newborn first weeks, baby first year | πρώτες εβδομάδες νεογέννητου, πρώτος χρόνος μωρού |
| FAQ | baby tracker app privacy, share baby tracker with partner | κοινή χρήση με σύντροφο, απόρρητο |

#### Tags in every page head

- `<title>` and meta description in the page's own language.
- A canonical URL with a trailing slash, on https://moraki.app.
- hreflang links for en, el and x-default. They must point both ways on every page pair.
- Open Graph tags: og:title, og:description, og:url, og:type, og:locale (en_GB or el_GR, plus og:locale:alternate), og:site_name and og:image.
- Twitter card tags, set to summary_large_image.
- One share image per page, 1200 × 630 px, under 100 KB, saved in images/og/.
  - Build each one from the brand colours, the logo and that page's illustration.
  - The page title can appear on it as text, because these images are only used for link previews.
- theme-color for light and dark.

#### Structured data

Use JSON-LD in a `<script type="application/ld+json">` block. Every value must match what the page says. Don't invent ratings, reviews, download counts or awards.

- **Every page:**
  - Organization for CE Code Designs Ltd (name, url, logo, address country CY), referenced by @id.
  - WebSite with inLanguage.
- **Home and Features:** MobileApplication with:
  - name: Moraki,
  - operatingSystem: iOS,
  - applicationCategory: the same category Moraki uses on the App Store (ask me if you don't know it),
  - offers: price 0, priceCurrency EUR,
  - inLanguage: en and el,
  - the App Store URL: https://apps.apple.com/app/id6819394944,
  - publisher: the Organization.
  - No aggregateRating.
- **FAQ:** FAQPage, holding every question and answer word for word from the page.
- **Our story:**
  - AboutPage, with an Article inside it.
  - Author: a Person named Makis.
  - Publisher: the Organization.
  - datePublished and dateModified as placeholders for me to fill in.
- **Age guides:** Article, with hasPart listing the five stages by their section anchors.
- **Every page except Home:** BreadcrumbList.

Validate every block with a schema checker you can run locally. List any warnings.

#### Site files

- **sitemap.xml:**
  - every indexable page in both languages,
  - xhtml:link hreflang alternates,
  - lastmod dates.
- **robots.txt:** allow everything except /join/, and give the sitemap URL.
- Make sure 404.html returns a real 404 status on the server configs in the README.

### Part 3. GEO: make it easy for AI answer engines to quote

AI tools like ChatGPT, Claude, Perplexity and Google's AI answers quote pages that state facts plainly. Do this without changing the approved design.

1. **A short "Moraki at a glance" block.** Add it to Home and Features in both languages, just above the footer, styled like the existing cards. Use a `<dl>`, so each fact sits in its own term and value pair. It lists plain facts:
   - what Moraki is,
   - who it's for,
   - price (free),
   - platform (iPhone, with Android planned),
   - languages (English, Greek),
   - where data is stored (EU),
   - ads (none),
   - account needed (no),
   - company (CE Code Designs Ltd, Cyprus).
2. **One-sentence summary.** The first paragraph on every page must say in one sentence what the page covers and name Moraki. Check the existing lead text. If it already does this, leave it.
3. **Question-shaped headings.** Where a section answers a question, a question as the heading helps. Do this only on the FAQ and Age guides pages, and only where it reads naturally. Never on Our story.
4. **One name for each thing.**
   - Always "Moraki" (never "the Moraki app" in one place and "Moraki App" in another).
   - Always "caregiver" and "viewer", and "household" for the shared group.
   - Use the same Greek terms on every page: φροντιστής, θεατής, νοικοκυριό.
5. **llms.txt at the site root.** In plain Markdown, include:
   - a two-line description of Moraki,
   - the key facts from step 1,
   - links to every page in both languages, each with a one-line summary.
   
   Add llms-full.txt with the full text of the Features and FAQ pages in English.
6. **AI crawlers.** In robots.txt, allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended and Applebot-Extended. Put a comment above them saying I can block them later if I change my mind.
7. **Authorship and freshness.**
   - Show a visible "Last updated" date on the Age guides and FAQ pages. Use a placeholder for me.
   - Make sure the Organization details match everywhere they appear.

### Part 4. Performance

Targets on a mid-range phone over 4G, measured with Lighthouse in mobile mode:

| Measure | Target |
| --- | --- |
| Performance | 95 or more |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| LCP (largest content shown) | under 1.8 s |
| CLS (layout shift) | under 0.05 |
| INP (response to taps) | under 100 ms |
| Total transfer per page, fonts included | under 300 KB |

To get there:

- **Fonts.**
  - Preload only Manrope 500 and Comfortaa 700.
  - Subset the woff2 files to Latin and Greek.
  - Keep font-display: swap.
  - Add a fallback @font-face with size-adjust, ascent-override and descent-override tuned to Manrope and Comfortaa, so the swap doesn't shift the layout.
- **Phone mock-ups.** They're inline HTML, which is good for text but adds weight.
  - Add content-visibility: auto and a matching contain-intrinsic-size to every section below the first screen, so the browser skips drawing them until needed.
  - Each mock-up exists in a day and a night copy. Keep both, but check the hidden one isn't drawn (display: none already handles this, so just confirm it).
- **Illustrations.**
  - Keep them as inline SVG, so they follow the theme.
  - Strip any extra precision, so path numbers have at most one decimal place.
  - Remove duplicate attributes.
  - Make sure each one stays under 10 KB.
- **CSS.**
  - Keep one stylesheet, linked in the head.
  - Remove any rules that no page uses.
  - If the stylesheet ends up over 14 KB after compression, inline the rules the first screen needs and load the rest normally.
- **JavaScript.**
  - Load only the theme script and the join-page script.
  - Load both with defer, except the tiny theme line in the head that prevents a flash.
- **Images.**
  - Give every `<img>` a width and height.
  - Lazy-load everything below the first screen.
  - Load nothing that isn't used.
- **Server.** In the README and _headers:
  - turn on Brotli or gzip,
  - cache fonts, images and CSS for a year with immutable (add a version query to styles.css so updates show up),
  - cache HTML for a short time,
  - keep the security headers from before (CSP default-src 'self', no third-party origins).
- **Measure it.**
  - Serve the site locally.
  - Run Lighthouse in mobile mode on Home, Features, Age guides, Our story and FAQ, in both languages.
  - Fix anything below target and run it again.
  - Put the final scores in your summary.

### Check your work

- **Screenshots.** Use Playwright to screenshot every page:
  - at 390, 768 and 1280 px,
  - in light and dark,
  - in English and Greek.
  
  Look at them and fix what's off.
- **Network.** Confirm zero requests to other domains and zero console errors, apart from fonts or badges I haven't supplied yet.
- **Links.** Check every internal link and anchor in both languages, including the menu, footer and FAQ links.
- **hreflang.** Check every English page points to its Greek twin and back.
- **Structured data.** Validate every JSON-LD block. Confirm the FAQ data matches the page text exactly.
- **Wording.** Search the visible text for "normal", "healthy", "too little", "concerning", em-dashes and English semicolons.
- **Keyboard.** Tab through each new page. The menu, the FAQ answers, the stage links and every button must work from the keyboard with visible focus.

### When you finish

Give me:

- a short summary of what changed,
- the Lighthouse scores per page,
- the list of placeholders still waiting on me:
  - fonts,
  - Apple badge,
  - legal text,
  - support email,
  - Apple team ID,
  - App Store category,
  - dates for Our story and the "Last updated" lines.

Commit each part on its own: new pages, SEO, GEO, performance.
