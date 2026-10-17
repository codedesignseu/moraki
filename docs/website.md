# moraki.app: the website

`public/` is the whole site: plain HTML, CSS and a little vanilla JavaScript, no
build step. Copy the folder to the host as it is. `design/moraki-website-illustrated/`
is the design it was built from and is never served.

## Pages

| URL                              | File                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `/`, `/el/`                      | `index.html`, `el/index.html`                               |
| `/privacy/`, `/el/privacy/`      | `privacy/index.html`, `el/privacy/index.html`               |
| `/terms/`, `/el/terms/`          | `terms/index.html`, `el/terms/index.html`                   |
| `/support/`, `/el/support/`      | `support/index.html`, `el/support/index.html`               |
| `/join/CODE`, `/join/?code=CODE` | `join/index.html`, in both languages with an EN / ΕΛ switch |
| any unknown URL                  | `404.html`, with a 404 status                               |

Shared files: `styles.css` (every colour is a CSS variable), `phone.css` (the
phone mock-ups on the home pages), `theme.js` (the light and dark switch),
`join.js` (the invite page), `404.js` (sends `/join/CODE` on to the invite page
on hosts with no rewrite), `fonts/` (Comfortaa and Manrope, Latin and Greek, OFL
licence in `fonts/OFL.txt`), `images/`, `robots.txt`, `sitemap.xml`.

Every asset path is absolute (`/styles.css`), so the 404 page works at any depth.

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

location /fonts/  { add_header Cache-Control "public, max-age=31536000, immutable"; }
location /images/ { add_header Cache-Control "public, max-age=2592000"; }
location ~* \.(html|css|js)$ { add_header Cache-Control "public, max-age=300"; }
```

nginx drops server-level `add_header` lines inside a `location` that has its own,
so repeat the security headers in the `/fonts/` and `/images/` blocks, or use an
`include` file.

## Content-Security-Policy

`default-src 'self'` with no third-party origin, no `'unsafe-inline'`. The one
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
