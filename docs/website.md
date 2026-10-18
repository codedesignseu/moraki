# moraki.app: the website

`public/` is the whole site: plain HTML, CSS and a little vanilla JavaScript, no
build step. Copy the folder to the host as it is. `design/v2/` is the design it was
built from (brief: `docs/store/website-v2-brief.md`) and is never served.

## Pages

| URL                               | File                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `/`, `/el/`                       | `index.html`, `el/index.html`                               |
| `/features/`, `/el/features/`     | `features/index.html`, `el/features/index.html`             |
| `/age-guides/`, `/el/age-guides/` | `age-guides/index.html`, `el/age-guides/index.html`         |
| `/our-story/`, `/el/our-story/`   | `our-story/index.html`, `el/our-story/index.html`           |
| `/faq/`, `/el/faq/`               | `faq/index.html`, `el/faq/index.html`                       |
| `/privacy/`, `/el/privacy/`       | `privacy/index.html`, `el/privacy/index.html`               |
| `/terms/`, `/el/terms/`           | `terms/index.html`, `el/terms/index.html`                   |
| `/support/`, `/el/support/`       | `support/index.html`, `el/support/index.html`               |
| `/join/CODE`, `/join/?code=CODE`  | `join/index.html`, in both languages with an EN / ΕΛ switch |
| any unknown URL                   | `404.html`, with a 404 status                               |

Shared files: `styles.css` (the one stylesheet: every colour is a CSS variable,
and the phone mock-ups on Home and Features use one `.mN` class per element style,
because the CSP allows no inline style), `theme.js` (the light and dark switch),
`join.js` (the invite page), `404.js` (sends `/join/CODE` on to the invite page
on hosts with no rewrite), `fonts/` (Comfortaa and Manrope, Latin and Greek, OFL
licence in `fonts/OFL.txt`), `images/`, `robots.txt`, `sitemap.xml`.

Every asset path is absolute (`/styles.css`), so the 404 page works at any depth.

Every page has the main menu (Features, Age guides, Our story, FAQ, with
`aria-current="page"` on the current one) and the same footer links. The invite
page carries the menu and footer links in both languages, switched with the rest
of the page by `join.js`.

## Search

Every indexable page has its own title and description, a canonical URL, hreflang
links both ways (en, el, x-default), Open Graph and Twitter tags, and a 1200 × 630
share image in `images/og/` (`<page>.png`, `<page>-el.png`). A JSON-LD block at
the end of each `<head>` holds the Organization (CE Code Designs Ltd, brand
Moraki), the WebSite, the page and its BreadcrumbList, plus MobileApplication on
Home and Features, FAQPage on the FAQ (word for word from the page) and an
Article on Age guides and Our story. JSON-LD is a data block, so the CSP does not
need a hash for it. `sitemap.xml` lists every indexable page with its alternates.
The invite page and the 404 page are `noindex`, and `robots.txt` keeps crawlers
off `/join/`.

## Answer engines

`llms.txt` describes Moraki in two lines, lists the key facts and links every
page in both languages. `llms-full.txt` holds the full English text of Features
and the FAQ. Both are plain Markdown, written from the pages, so update them when
the page text changes. `robots.txt` allows GPTBot, ClaudeBot, PerplexityBot,
Google-Extended and Applebot-Extended, with a note on how to block them. Home and
Features end with a "Moraki at a glance" list of plain facts (a `<dl>`), and Age
guides and the FAQ show a "Last updated" date.

## What the server has to do

1. Serve `/join/<code>` with `join/index.html` (status 200).
2. Serve unknown paths with `404.html` and status 404.
3. Serve `/.well-known/apple-app-site-association` as `application/json`, with
   no redirect (Apple will not follow one, not even http to https or apex to www).
4. Send the security and cache headers below.

Without step 1 the site still works: `404.html` runs `404.js`, which sends
`/join/CODE` to `/join/?code=CODE`, and the invite page reads either form.

### Apache (moraki.app today)

`public/.htaccess` does all four. It needs `mod_rewrite` and `mod_headers`,
which every cPanel host has.

### Netlify and Cloudflare Pages

`public/_redirects` handles `/join/*`, `public/_headers` sets the headers. Both
hosts serve `404.html` for unknown paths with a 404 status on their own.

### nginx

```nginx
root /var/www/moraki.app;           # the contents of public/
index index.html;

location = /.well-known/apple-app-site-association {
  default_type application/json;
}
location /join/ {
  try_files $uri $uri/ /join/index.html;
}
error_page 404 /404.html;

add_header Content-Security-Policy "<copy the value from public/_headers>" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" always;
add_header X-Frame-Options "DENY" always;

gzip on;
gzip_types text/css text/javascript application/javascript application/json image/svg+xml text/plain application/xml;
# brotli on; brotli_types ...;   (same list, if the ngx_brotli module is installed)

location /fonts/  { add_header Cache-Control "public, max-age=31536000, immutable"; }
location /images/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location ~* \.(css|js)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location ~* \.html$ { add_header Cache-Control "public, max-age=300"; }
```

nginx drops server-level `add_header` lines inside a `location` that has its own,
so repeat the security headers in the `/fonts/` and `/images/` blocks, or use an
`include` file.

## Speed

The pages aim for Lighthouse mobile scores of 95 or more (Performance) and 100
(Accessibility, Best Practices, SEO), LCP under 1.8 s, CLS under 0.05, and under
300 KB per page with fonts.

- **Fonts.** Only Manrope 500 and Comfortaa 700 are preloaded. Each face has a
  local fallback (`Manrope fallback`, `Comfortaa fallback`, built on Arial) with
  `size-adjust` and ascent and descent overrides measured from the woff2 files,
  so the swap barely moves the text.
- **Caching.** Fonts, images, `styles.css` and the scripts are cached for a year
  (`immutable`), HTML and text for 5 minutes. The CSS and JS links carry a
  `?v=` query, the first 8 hex digits of the file's SHA-256, and the App Store
  badges carry `?v=1`. When one of these files changes, update its query in
  every page, or the change won't reach people who have the old copy:

  ```sh
  for f in styles.css theme.js join.js 404.js; do echo "$f $(shasum -a 256 public/$f | cut -c1-8)"; done
  ```

- **Drawing less.** Every section after the first screen has
  `content-visibility: auto`. The night copy of each phone mock-up is
  `display: none` until the night theme shows it. Badges are `loading="lazy"`,
  so the hidden one is never fetched.
- **Illustrations** stay inline SVG so they follow the theme. Numbers have at
  most one decimal, and the shared ink outline is one class, `.o`, in
  `styles.css`. Each is under 10 KB.
- **One stylesheet**, linked in the head. It is well under 14 KB compressed, so
  nothing is inlined.

## Content-Security-Policy

`default-src 'self'` with no third-party origin, no `'unsafe-inline'`. `connect-src` is `'self'` so tools like Lighthouse can read `robots.txt` from the page. The one
inline script is the few lines in each page's `<head>` that apply the saved
theme before the page paints. The CSP allows it by its SHA-256 hash. If that
script changes, the hash in `_headers` and `.htaccess` (and nginx) must change
with it, or the theme stops loading before paint:

```sh
python3 -c "import re,hashlib,base64;s=open('public/index.html').read();b=re.search(r'<script>(.*?)</script>',s).group(1);print('sha256-'+base64.b64encode(hashlib.sha256(b.encode()).digest()).decode())"
```

The HTML files are kept out of Prettier (`.prettierignore`) because reformatting
that script would change its hash.

## Before going live

- **App Store badge.** `images/app-store-badge-black.svg` and `-white.svg` are
  placeholders. Download Apple's official badges from
  https://developer.apple.com/app-store/marketing/guidelines/ and save them under
  the same names: black by day, white at night.
- **Legal text.** Privacy and Terms carry the current drafts, word for word, with
  a visible draft note. Remove the note when the lawyer review is done.
- **Mailbox.** The site gives `hello@moraki.app` as the contact address. It must
  exist and be read before the site goes live.

## Checking it

Serve `public/` with any server that mimics the rewrite and the 404, then check:
`/join/K7Q4M2XP`, `/join/k7q4-m2xp`, `/join/?code=K7Q4M2XP`, `/join/` with no code,
an unknown path at some depth, and `curl -sI https://moraki.app/.well-known/apple-app-site-association`
(it must say `content-type: application/json` and status 200).
