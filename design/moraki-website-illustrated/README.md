# moraki.app website

Plain HTML and CSS. No frameworks, no cookies, no trackers, no external requests. The only JavaScript is a few lines on the invite page.

## Pages

| Path | File |
|---|---|
| / | index.html |
| /el/ | el/index.html |
| /privacy/, /el/privacy/ | privacy/index.html, el/privacy/index.html |
| /terms/, /el/terms/ | terms/index.html, el/terms/index.html |
| /support/, /el/support/ | support/index.html, el/support/index.html |
| /join/CODE | join/index.html (needs the rewrite below) |
| any unknown URL | 404.html |

## Before you go live

1. **Fonts.** Add the five woff2 files to `fonts/`. See `fonts/README.md`.
2. **App Store badge.** `images/app-store-badge-black.svg` and `-white.svg` are placeholders. Download Apple's official badges from https://developer.apple.com/app-store/marketing/guidelines/ and save them under the same names. Black shows by day, white at night. Apple also offers a Greek badge if you want one on the /el/ pages.
3. **Legal text.** Paste the final Privacy and Terms text into the section cards, word for word, in both languages. Replace every `[date]` and `[ημερομηνία]`.
4. **Support email.** Replace `[support email address]` in support/index.html and el/support/index.html. Make it a `mailto:` link.
5. **Support answers.** Check that the button and menu names in the answers match the app.

## Server setup

The invite page has to answer for every `/join/<code>` path, and unknown paths need the 404 page with a 404 status.

**Netlify or Cloudflare Pages.** `_redirects` already handles /join/. Both serve 404.html for unknown paths on their own.

**nginx**

```
location /join/ { try_files $uri /join/index.html; }
error_page 404 /404.html;
```

**Apache (.htaccess)**

```
RewriteEngine On
RewriteRule ^join/[^/]+/?$ /join/index.html [L]
ErrorDocument 404 /404.html
```

The invite page also reads `?code=K7Q4M2XP`, so `/join/?code=...` works on hosts with no rewrites.

## Universal links

If the app handles `https://moraki.app/join/*` as a universal link, people with the app installed go straight into it. Add the `apple-app-site-association` file to `.well-known/` for that. The page here only shows for people without the app.

## How the page is built

- `styles.css` holds every colour as a CSS variable, with the night values under `prefers-color-scheme: dark`. Same tokens as the app.
- The phone mock-ups are the real app screens as HTML, scaled down. They carry a text description for screen readers, so no text sits inside an image.
- Every page follows the system light or dark setting.
